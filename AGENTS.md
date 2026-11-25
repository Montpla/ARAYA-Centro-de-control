# ARAYA Centro de Control — guía para asistentes de IA

Este archivo es la puerta de entrada para cualquier asistente (Claude, ChatGPT/Codex,
Gemini, Copilot, Cursor…) que continúe el trabajo. Léelo entero antes de tocar nada.
El estado más reciente y el historial están al principio de `HANDOFF.md`.
Para cambiar de asistente o de LLM, `CONTINUAR.md` contiene el punto de entrada;
el bloque canónico inicial de `HANDOFF.md` distingue lo publicado de lo pendiente.
Antes de proponer cambios, explica al usuario qué has entendido del estado actual.

## Normas que no se rompen

- **Idioma:** responde y escribe siempre en **español de España** (código comentado,
  commits, PR, issues y mensajes al usuario). Nunca en inglés.
- **Nunca imprimas ni escribas importes de dinero** (montos, saldos, facturas,
  cubicaciones en pesos o dólares) en registros, commits, PR, issues ni documentación.
  Sí se pueden citar nombres de clave, motivos, fechas y porcentajes de avance.
- **Nunca escribas secretos** (tokens, PIN, claves) en el repositorio ni en el chat.
  Viven en GitHub → Settings → Secrets y en los secretos del Worker de Cloudflare.
- **Datos personales:** no copies el correo ni datos personales del dueño en
  documentación, commits ni peticiones a servicios externos.
- **No modifiques datos de producción a mano** (SQL contra D1, llamadas a la API que
  publiquen o borren) salvo con los scripts y workflows previstos. Todo arreglo va por
  código + prueba + PR.
- **No hagas `git push --force`** ni reescribas historia de ramas compartidas.
- **No desactives ni debilites pruebas** para que pasen.
- El dueño vive en España (Europe/Madrid); la obra está en República Dominicana.
  Quiere que el programa funcione solo, sin estar pendiente.

## Qué es

Panel de control de la obra ARAYA (77 edificios representados, 26 con avance
publicado en el último corte comprobado; urbanismo, Curva S, seguridad y finanzas).
El equipo sube archivos (Excel, PDF, PowerPoint, Gantt HTML, Project `.mpp`, planos
DWG); el programa los lee, publica sus datos como "datos vivos" y el panel recalcula
solo gráficos, colores de edificios y porcentajes.

Los apartamentos tienen porcentajes derivados del edificio/Project: su presencia
en el plano no acredita una medición individual. El alcance y la procedencia
deben conservarse al interpretar, mostrar o actualizar un avance.

- **Producción:** https://araya-centro-control.grupobricket.workers.dev
- **Repositorio:** `Montpla/ARAYA-Centro-de-control` (rama principal `main`).
- **Pila:** Cloudflare Workers con vinext (Next.js sobre Vite), React 19, D1 (SQLite)
  con Drizzle, R2 para los originales, notificaciones push propias.
- **Lectura de documentos:** lectores deterministas para hojas de cálculo y Project;
  lectura asistida con IA (OpenAI, modelos "luna" y "terra" para escalar) para PDF y
  presentaciones.

## Mapa del código

- `app/api/files/route.ts` — recepción de cargas, lectura, publicación automática,
  motivos de descarte (`datos_descartados`) y disparos a GitHub Actions.
- `lib/ingestion.ts` — clasificación, `detectPeriod` (fecha de corte) y lectores
  deterministas (cubicación, Curva S, edificios…).
- `lib/ai-document-extraction.ts` — lectura asistida con IA y sus protecciones
  (urbanismo y oficios por nombre, nunca por posición).
- `lib/live-data.ts`, `lib/live-data-contract.ts`, `lib/effective-live-data.ts` —
  modelo de datos vivos, contrato de cada clave y qué valor gana.
- `lib/source-precedence.ts` + `.github/claude/reglas-de-prioridad.md` — **reglas de
  prioridad entre fuentes** (decisiones del dueño).
- `lib/upload-verification.ts`, `lib/panel-coherence.ts`,
  `app/api/files/verification/route.ts` — verificación automática de cada carga.
- `app/dashboard-client.tsx` — el panel; `app/tv/` — modo TV.
- `lib/gantt-html.ts`, `lib/gantt-data.ts`, `app/gantt-schedule-panel.tsx` —
  cronogramas documentales, sin ejecutar el HTML de los archivos recibidos.
- `lib/masterplan-layout.json`, `lib/site-plan-layout.ts` — geometría del plano;
  `lib/unit-progress.ts` — avances derivados de apartamentos y alineación visual.
- `lib/narrative-update-scope.ts`, `lib/ingestion-change-set.ts` — alcance de
  resúmenes mensuales e identidades estables de los bloques descubiertos.
- `scripts/` — diagnóstico y mantenimiento (se ejecutan desde GitHub Actions).
- `tests/` — batería de pruebas (`node --test`), más de 500 casos.

## Cómo trabajar

Para descubrir código, preferir las herramientas MCP del grafo cuando estén
disponibles: `search_graph`, `trace_path`, `get_code_snippet`, `query_graph` y
`get_architecture`. El proyecto local indexado es `araya-auditoria-20261119`;
indexarlo si falta o está desactualizado. Usar búsquedas habituales para literales,
configuración y documentos, o si el grafo no ofrece resultados suficientes.

1. Parte de `main` actualizado y crea una rama propia.
2. Antes de subir: `npm run typecheck`, `npm run lint` y `node --test tests/*.mjs`
   (o `npm test`, que además compila; algunas pruebas revisan el código compilado).
3. Abre un PR contra `main`. La CI (`ci.yml`, trabajo `verificar`) es **obligatoria**
   para fusionar. Se fusiona con squash.
4. Al fusionar en `main`, `deploy.yml` despliega solo (typecheck, compilación,
   pruebas, `wrangler deploy` y verificación contra producción). Si falla por red,
   se puede relanzar a mano.
5. Diagnóstico de producción sin credenciales locales: lanzar
   `comprobar-cargas.yml` (entrada `detalle`: `0`, `auditoria-flujo`,
   `migrar-cortes`, `presentacion`…) y leer su registro.

## Automatización de cargas (no la rompas)

Cada archivo subido sigue este circuito, todo en GitHub Actions:

1. `lib/upload-verification-trigger.ts` lanza `verificar-carga.yml` al subirlo.
2. `verificar-carga.yml` espera al procesamiento, verifica el archivo y la
   coherencia del panel, y avisa al dueño en el panel y el móvil
   ("✔ Integrado" / "⚠ Revisar carga").
3. Si hay anomalía, Claude (con el secreto `CLAUDE_CODE_OAUTH_TOKEN`, suscripción
   del dueño) la revisa siguiendo `.github/claude/arreglar-carga.md`: arregla con
   código + prueba + PR; el workflow lanza la CI sobre la rama, fusiona, despliega,
   reprocesa el archivo y avisa. Ante conflictos entre fuentes decide con las reglas
   de prioridad y avisa cómo deshacerlo.
4. `responder-carga.yml`: el dueño responde en la incidencia de GitHub con `/A`,
   `/B`, `/deshacer` o `/decido <frase>`; se convierte en un encargo y la decisión
   se apunta como regla nueva.
5. `reintentar-verificaciones.yml` (cada 3 h): cargas sin verificar, revisiones de
   Claude sin terminar y PR de arreglo abiertos sin fusionar (máx. 3 reintentos).

Otros workflows automáticos: `convertir-mpp.yml`, `convertir-dwg.yml`,
`convertir-xls.yml` (Excel antiguo → `.xlsx`), `comprimir-pdf.yml` (PDF > 15 MB),
`reintentar-subida-diferida.yml`, `auditoria-nocturna.yml`, `backup-produccion.yml`.
Si una tarea programada falla, abre una incidencia
(`.github/actions/avisar-fallo-cron`).

Limitaciones conocidas: el token de los workflows no puede modificar
`.github/workflows/`; los PR que abre un workflow no lanzan la CI solos (por eso
`verificar-carga.yml` la lanza a mano); los cron de GitHub a veces se retrasan
horas.

## Secretos (sólo nombres, nunca valores)

GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEPLOY_VERIFY_EMAIL`,
`DEPLOY_VERIFY_PIN` (cuenta del dueño para leer producción desde los workflows),
`CLAUDE_CODE_OAUTH_TOKEN`. Worker: `GITHUB_ACTIONS_TOKEN` (para lanzar workflows),
`OPENAI_API_KEY`, claves VAPID de las notificaciones.

## Decisiones del negocio vigentes

Ver `.github/claude/reglas-de-prioridad.md`. Lo esencial: el **avance global y el
ejecutado de la Curva S** los fija el **Excel de la curva reprogramada** («EJECUTADOS
MES …»), nunca la cubicación (25/11/2026); la **cubicación** manda en edificios,
oficios y urbanismo (por encima de Project y del Informe Ejecutivo); un corte
anterior nunca pisa uno posterior; la foto de Seguridad es la del reporte semanal
más reciente.
