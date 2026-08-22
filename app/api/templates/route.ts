import { requireApiUser } from "../../../lib/access-control";

import cronogramaTemplate from "../../../plantillas/04-curva-s-mensual.csv?raw";
import cxpCategoriasTemplate from "../../../plantillas/09-cxp-por-categoria.csv?raw";
import cxpVencimientosTemplate from "../../../plantillas/10-cxp-vencimientos.csv?raw";
import costesTemplate from "../../../plantillas/11-desglose-de-coste.csv?raw";
import anticiposTemplate from "../../../plantillas/12-anticipos.csv?raw";
import proyeccionFinancieraTemplate from "../../../plantillas/14-proyeccion-financiera.csv?raw";
import financiacionTemplate from "../../../plantillas/15-financiacion.csv?raw";
import cubicacionTemplate from "../../../plantillas/16-cubicaciones.csv?raw";
import ventasTemplate from "../../../plantillas/17-ventas-por-modelo.csv?raw";
import balanceFideicomisoTemplate from "../../../plantillas/18-balance-fideicomiso.csv?raw";
import resultadosFideicomisoTemplate from "../../../plantillas/19-resultados-fideicomiso.csv?raw";
import flujoMensualTemplate from "../../../plantillas/20-flujo-mensual-finanzas.csv?raw";

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
  cxp_categorias: {
    content: cxpCategoriasTemplate,
    fileName: "ARAYA-plantilla-cxp-categorias.csv",
  },
  cxp_vencimientos: {
    content: cxpVencimientosTemplate,
    fileName: "ARAYA-plantilla-cxp-vencimientos.csv",
  },
  costes: {
    content: costesTemplate,
    fileName: "ARAYA-plantilla-costes.csv",
  },
  anticipos: {
    content: anticiposTemplate,
    fileName: "ARAYA-plantilla-anticipos.csv",
  },
  proyeccion_financiera: {
    content: proyeccionFinancieraTemplate,
    fileName: "ARAYA-plantilla-proyeccion-financiera.csv",
  },
  financiacion: {
    content: financiacionTemplate,
    fileName: "ARAYA-plantilla-financiacion.csv",
  },
  balance_fideicomiso: {
    content: balanceFideicomisoTemplate,
    fileName: "ARAYA-plantilla-balance-fideicomiso.csv",
  },
  resultados_fideicomiso: {
    content: resultadosFideicomisoTemplate,
    fileName: "ARAYA-plantilla-resultados-fideicomiso.csv",
  },
  flujo_mensual_finanzas: {
    content: flujoMensualTemplate,
    fileName: "ARAYA-plantilla-flujo-mensual-finanzas.csv",
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
