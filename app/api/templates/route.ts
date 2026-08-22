import { requireApiUser } from "../../../lib/access-control";

import cronogramaTemplate from "../../../plantillas/04-curva-s-mensual.csv?raw";
import cubicacionTemplate from "../../../plantillas/16-cubicaciones.csv?raw";
import ventasTemplate from "../../../plantillas/17-ventas-por-modelo.csv?raw";

export const runtime = "edge";

const templates = {
  cubicacion: {
    content: cubicacionTemplate,
    fileName: "ARAYA-plantilla-cubicacion.csv",
  },
  ventas: {
    content: ventasTemplate,
    fileName: "ARAYA-plantilla-ventas.csv",
  },
  cronograma: {
    content: cronogramaTemplate,
    fileName: "ARAYA-plantilla-cronograma.csv",
  },
} as const;

function blankCurrentValues(content: string) {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      if (!line) return line;
      if (index === 0) return "clave,valor,descripcion";
      return line.replace(/,[^,]*$/, "");
    })
    .join("\r\n");
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  if (!(kind in templates)) {
    return Response.json({
      error: "Plantilla no reconocida.",
      templates: Object.keys(templates),
    }, { status: 400 });
  }

  const template = templates[kind as keyof typeof templates];
  return new Response(`\uFEFF${blankCurrentValues(template.content)}`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${template.fileName}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

