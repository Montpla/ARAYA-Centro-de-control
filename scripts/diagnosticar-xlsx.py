#!/usr/bin/env python3
"""Muestra solo la estructura de obra relevante de un XLSX privado.

Se usa desde el workflow administrativo de reproceso. No vuelca el libro: solo
las filas que contienen etiquetas de avance/cubicacion/edificio/TH-76/TH-77 y
dos filas vecinas, suficientes para adaptar un lector sin sacar el original de
su almacenamiento protegido.
"""

from __future__ import annotations

import re
import sys
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
TRIGGER = re.compile(
    r"\b(?:avance|progreso|ejecutad\w*|cubicacion|edificios?|obra\s+(?:realizada|ejecutada))\b"
    r"|\bth\s*[-.]?\s*0?(?:76|77)\b|\b(?:76|77)\b",
    re.I,
)


def normalized(value: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    ).lower()


def text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return "".join(node.itertext()).strip()


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return [text(item) for item in root.findall(f"{{{MAIN}}}si")]


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    kind = cell.attrib.get("t", "")
    if kind == "inlineStr":
        return text(cell.find(f"{{{MAIN}}}is"))
    raw = text(cell.find(f"{{{MAIN}}}v"))
    if kind == "s" and raw.isdigit():
        index = int(raw)
        return shared[index] if index < len(shared) else ""
    formula = text(cell.find(f"{{{MAIN}}}f"))
    return f"={formula} -> {raw}" if formula else raw


def workbook_sheets(archive: zipfile.ZipFile) -> list[tuple[str, str]]:
    book = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        rel.attrib["Id"]: rel.attrib["Target"].lstrip("/")
        for rel in relationships.findall(f"{{{PKG_REL}}}Relationship")
    }
    result: list[tuple[str, str]] = []
    for sheet in book.findall(f".//{{{MAIN}}}sheet"):
        target = targets.get(sheet.attrib.get(f"{{{REL}}}id", ""), "")
        if target and not target.startswith("xl/"):
            target = f"xl/{target}"
        result.append((sheet.attrib.get("name", "Hoja"), target))
    return result


def inspect(path: Path) -> None:
    with zipfile.ZipFile(path) as archive:
        shared = shared_strings(archive)
        printed = 0
        for sheet_name, target in workbook_sheets(archive):
            if not target:
                continue
            root = ET.fromstring(archive.read(target))
            rows: list[tuple[int, list[tuple[str, str]]]] = []
            for row in root.findall(f".//{{{MAIN}}}row"):
                number = int(row.attrib.get("r", len(rows) + 1))
                values = []
                for cell in row.findall(f"{{{MAIN}}}c"):
                    value = cell_value(cell, shared)
                    if value:
                        values.append((cell.attrib.get("r", "?"), value[:160]))
                rows.append((number, values))
            selected = {
                number + offset
                for number, values in rows
                if TRIGGER.search(normalized(" ".join(value for _, value in values)))
                for offset in (-2, -1, 0, 1, 2)
            }
            relevant = [(number, values) for number, values in rows if number in selected and values]
            if not relevant:
                continue
            print(f"   [hoja] {sheet_name} · {len(rows)} filas con contenido")
            for number, values in relevant[:80]:
                compact = " | ".join(f"{ref}={value}" for ref, value in values[:20])
                print(f"     fila {number}: {compact}")
                printed += 1
                if printed >= 160:
                    print("   [diagnostico acotado a 160 filas]")
                    return


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("uso: diagnosticar-xlsx.py archivo.xlsx")
    inspect(Path(sys.argv[1]))
