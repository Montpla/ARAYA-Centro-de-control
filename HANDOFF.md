# ARAYA Centro de Control — Estado de continuidad

Actualizado: 22/08/2026
Zona horaria del usuario: Europe/Madrid

## Plataforma única confirmada (22/08/2026)

- Fuente canónica: GitHub `Montpla/ARAYA-Centro-de-control` (`main`).
- Producción única: `https://araya-centro-control.grupobricket.workers.dev`.
- Sites queda cerrado al propietario, sin dominio personalizado y desconectado
  del repositorio. Railway y el antiguo dominio corporativo quedan fuera del
  proyecto y no deben reactivarse.
- La configuración vive en `wrangler.deploy.jsonc`. Se eliminaron
  `.openai/hosting.json` y el plugin de empaquetado de Sites para que otra sesión
  o LLM no vuelva a publicar allí por accidente.
- Auditoría Railway del 22/08/2026: `bricket-obra-produccion`,
  `charismatic-respect` y `selfless-enthusiasm` están eliminados. No queda
  ningún proyecto activo en la cuenta. Antes del borrado se verificaron y
  guardaron respaldos locales en `Railway_Backup_bricket-obra_2026-08-22` y
  `Railway_Backup_MontAI-CRM_2026-08-22`, fuera de este repositorio.

## Legibilidad y tabla semanal de seguridad (22/08/2026)

- Se corrigieron los textos dañados `Evolución de seguridad` y la flecha entre
  fechas, junto con los mensajes afectados de `/api/live-data`.
- La serie semanal dejó de depender de `.compact-row` sin columnas: ahora es
  una tabla HTML de cinco columnas, con datos a 13 px, fechas a 11 px, cifras
  tabulares, encabezado estable y desplazamiento horizontal en móvil.
- La suite incluye una guarda específica contra la regresión de estructura y
  codificación. Verificación local: TypeScript, build y **353/353** pruebas.
- El plan para elevar contraste, tamaño y acabado corporativo sin cambiar la
  navegación está en `docs/PLAN-LEGIBILIDAD-IDENTIDAD-CORPORATIVA.md`.

## Secciones dinámicas autónomas (22/08/2026)

- Los conceptos nuevos ya no quedan relegados a un bloque provisional del
  Centro de datos. `DynamicAreaSections` los presenta también dentro de su área:
  Dirección, Planificación, Diseño/Implantación, Obra/Edificios, Urbanismo,
  Compras/Proveedores, Seguridad/Legal o Finanzas según corresponda. Comercial
  conserva su bloque protegido propio.
- `buildDynamicSectionBlock` genera una representación duradera (`kpi`, barras,
  línea, tabla o lista), conserva fuente/evidencia/confianza y convierte también
  los textos primitivos en una fila visible. La identidad de una sección
  recurrente se conserva: la siguiente semana/mes actualiza el mismo bloque.
- El contrato vivo permite que una sección histórica vacía reciba filas y
  metadatos visuales más tarde, pero sólo en las rutas dinámicas autorizadas.
  Las demás matrices vacías continúan cerradas y no se amplía la superficie de
  escritura general.
- El estado `adaptado` se asigna después de comprobar que el dato quedó
  publicado o ya coincidía. Si una validación lo impide, queda `pendiente` con
  explicación y puede reintentarse; nunca vuelve a aparecer como publicado sin
  estar visible.
- Se materializaron en producción las dos secciones omitidas del informe de
  Seguridad de Semana 2: **ACTOS SEGUROS** (5 registros) y **Tema** (1 registro),
  revisión 79 y corte real 18/07/2026. Se corrigió además el corte de Semana 1
  a 11/07/2026. El script idempotente y auditable es
  `scripts/materialize-dynamic-sections-2026-08-22.sql`.
- Validación local: TypeScript y build en verde, ESLint sin errores (20 avisos
  históricos) y suite completa **352/352**.

## Entrega financiera sin bloqueos (22/08/2026)

- Se separaron tres permisos: `financeUploadAccess` para entregar documentos,
  `financeAccess` para consultar cifras y `financeApproveAccess` para resolver
  excepciones. Los usuarios actuales conservan sus capacidades y la entrega
  financiera queda habilitada por defecto sin conceder lectura.
- La carga web archiva primero el original y responde `202 accepted`; el
  análisis continúa con `waitUntil` sobre el mismo expediente. Hay tres
  intentos trazados (`processing_attempts`, `next_retry_at`,
  `last_processing_error`) y una red de seguridad programada cada 15 minutos.
- Un duplicado financiero ya no devuelve 403 al remitente: confirma que el
  original existe sin revelar cifras. Cada persona dispone de **Mis cargas** y
  ve el estado de sus entregas protegidas, pero no puede abrirlas ni descargarlas
  si no tiene permiso de lectura.
- El remitente recibe una notificación privada al terminar o cuando hace falta
  atención. Los reintentos intermedios no generan avisos repetidos.
- El administrador puede conceder validación financiera sin dar permisos
  administrativos generales. La revisión operativa no financiera sigue
  reservada al administrador.
- El formulario incorpora un acceso rápido a **Informe financiero** y seis
  plantillas deterministas opcionales: CxP por categoría/vencimiento, costes,
  anticipos, proyección y financiación. PDF, Excel, PowerPoint y demás formatos
  admitidos siguen procesándose sin obligar a usar una plantilla.
- Migración: `drizzle/0026_uneven_wallow.sql`. Verificación local: TypeScript,
  build y suite completa **343/343** en verde.
- Publicado en `github/main` con el commit **`3ca6e2d`**. Despliegue
  **`32565157084`** y diagnóstico autenticado **`32565309088`**, ambos en verde.
  Producción conserva 19/19 expedientes resueltos, 0 pendientes, 0 propuestas,
  0 discrepancias, avance físico 22,71 %, cronograma 22,37 %, fin previsto
  03/06/2027 y 26 edificios con avance publicado.

## Automatización documental cerrada (22/08/2026)

- La clasificación inicial por nombre deja de ser un bloqueo: cuando el área
  llega en automático o pendiente, `inferUploadAreaFromContent` vota con el
  tipo documental, las raíces vivas extraídas y las áreas sugeridas. Una
  selección expresa se conserva y cualquier señal financiera sigue elevando
  la privacidad.
- Cualquier usuario activo puede aportar un original de Finanzas o Ventas. La
  carga no concede lectura: el documento, sus cifras, el expediente y los
  avisos continúan protegidos, pero el agente puede procesarlos y el cargador
  recibe un resultado sin importes.
- La carga ya no termina en un aviso fugaz: presenta un recibo persistente con
  área, datos publicados, coincidencias, entradas aisladas, secciones nuevas,
  advertencias y siguiente paso. Se cierra de forma explícita.
- El propio formulario ofrece plantillas autenticadas de cubicación, ventas y
  cronograma. Se entregan sin valores vigentes y sólo hay que rellenar `valor`.
- PDF escaneado usa la lectura visual asistida cuando está disponible. Si no
  produce hechos, el mensaje pide un escaneo nítido. XLS antiguo indica guardar
  como XLSX y ZIP cifrado identifica la contraseña y explica cómo retirarla.
- `CURRENT_INGESTION_VERSION` pasa a `2026-08-22.1`. El workflow programado está
  activo, dispone de sus secretos y relee lotes idempotentes cada quince minutos.
- Los conceptos sin campo ya se convierten automáticamente en secciones
  visuales trazables; no vuelven a crear una cola indefinida de propuestas.

## Auditoria integral y saneamiento de produccion (21/08/2026)

Esta seccion sustituye las notas anteriores que decian que la rama adaptativa,
la migracion 0025 o el backlog de Seguridad/Finanzas seguian sin aplicar.

- Se exporto una copia completa de D1 y se ensayo el saneamiento dos veces
  sobre una base local aislada. Resultado idempotente: **19 expedientes
  canonicos, 19 aprobados, 0 propuestas pendientes y 0 discrepancias abiertas**.
  Nueve versiones redundantes pasan a `superado/historico`, pero sus originales,
  eventos e historia se conservan; no se elimina ningun objeto R2.
- `scripts/production-cleanup-2026-08-21.sql` documenta y reproduce toda la
  operacion. Concilia los siete expedientes canonicos pendientes (cuatro partes
  de Seguridad, BCE, CxP y el Excel financiero de julio), cierra 35 propuestas
  de archivos ya retirados y conserva como secciones visibles las buenas
  practicas y el tema de charla de la semana 1.
- El avance fisico permanece en **22,71 %**, frente a **26,61 %** planificado;
  no se modifica ningun avance de edificio, apartamento ni urbanismo. La Curva
  S guarda como `null` los ceros de formula posteriores a julio, por lo que el
  corte real no puede volver a saltar a 0 %.
- Seguridad dispone de `safetyWeeklySeries` S1-S4 y muestra valores semanales y
  acumulados por separado. El consolidado vigente sigue siendo 01/08/2026:
  134 personas, 192 horas-persona, 24 observaciones, 19 reuniones, 20
  inspecciones y 2 acciones. Una recarga tardia de S1/S2 ya no pisa S4: el
  ganador efectivo se ordena primero por fecha de corte y despues por revision.
- CxP conserva el total RD$20.921.175,00 y recupera los centavos del Excel de
  autoridad: corriente RD$19.747.897,22, menor de un mes RD$1.003.815,37 y
  anterior RD$169.462,41. El resumen de costes ya se deriva de
  `antonelyCostAccounts`, de modo que ejecutado, periodo y restante siguen el
  ultimo libro en vez de quedarse congelados en junio.
- Las 23 conciliaciones estaticas pasan a llamarse **observaciones de
  conciliacion**. La unica critica se convirtio en accion gestionable: corregir
  la formula del flujo de proveedores que omite RD$4.095.000, manteniendo el
  total auditado RD$202.373.400,47.
- La Sala operativa y el registro de archivos excluyen las versiones
  `superseded` antes de contar/paginar. Las discrepancias proceden unicamente de
  propuestas pendientes de la generacion vigente, no de acumulados historicos.
- El journal remoto estaba desalineado: produccion tenia todos los objetos de
  0019-0024 pero no sus registros. Tras comprobar tablas, columnas, trigger e
  indices, `scripts/reconcile-production-migrations-2026-08-21.sql` registro
  esas migraciones y Wrangler aplico normalmente `0025_yellow_bullseye.sql`.
- Verificacion antes de publicar: TypeScript verde, build Vinext verde, ESLint
  0 errores (20 avisos historicos) y suite completa verde, incluida la prueba
  de precedencia temporal, derivacion financiera y serie semanal de Seguridad.
Idioma de trabajo: español

## Cierre más reciente: paleta viva de avance espacial (20/08/2026)

- La fuente canónica está en `github/main`, commit **`caa6eb3`**
  (`Mejora la paleta de avance espacial`). La copia local de `main` y
  `github/main` quedaron exactamente en ese SHA antes de abrir esta rama
  documental de relevo.
- GitHub Actions publicó y verificó ese commit correctamente en la ejecución
  **`32387219462`**. Producción respondió en
  `https://araya-centro-control.grupobricket.workers.dev`; el control de humo
  confirmó 77 edificios posicionados, 462 apartamentos interactivos, acceso
  privado a documentos, notificaciones disponibles y coherencia de la Curva S.
- `lib/progress-palette.ts` es ahora la única escala cromática común para
  edificios y apartamentos. No volver a crear condiciones de color separadas
  en cada vista. Los tramos son:
  - `progress-0`: 0 %, grafito;
  - `progress-1-20`: 1–20 %, terracota;
  - `progress-21-40`: 21–40 %, ámbar;
  - `progress-41-60`: 41–60 %, oliva;
  - `progress-61-80`: 61–80 %, verde azulado;
  - `progress-81-99`: 81–99,99 %, esmeralda;
  - `progress-100`: 100 %, verde bosque;
  - `progress-none`: valor ausente, crema con borde discontinuo.
- El relleno expresa exclusivamente el avance. `is-blocked` añade un contorno
  rojo sin sustituir el relleno y la clase `active` conserva un contorno oscuro
  separado para la selección. No usar rojo como banda porcentual ni volver a
  mezclar selección, bloqueo y avance en una sola clase.
- La escala se aplica al plano visual y técnico, a los seis indicadores de cada
  edificio, al selector ampliado, a las pestañas de edificios, a las fichas de
  apartamentos, a sus paneles de detalle y a las barras del explorador general.
  La leyenda del plano es interactiva: filtra por tramo atenuando los elementos
  restantes, sin ocultarlos ni modificar sus datos.
- Los colores se recalculan desde el dato vivo en cada render. Cuando la
  sincronización de cinco segundos recibe un nuevo porcentaje, mapa, fichas y
  barras cambian juntos sin reglas manuales adicionales.
- Limitación conocida: el contrato actual guarda los avances de edificios y
  apartamentos como números y convierte la ausencia histórica en `0`. Por eso
  los 51 edificios futuros se muestran correctamente como 0 % y no como “Sin
  datos”. `progress-none` ya está preparado para valores nulos futuros, pero no
  inferir ausencia a partir de un cero ni cambiar el modelo sin migración y
  evidencia explícita.
- La suite completa quedó en **297/297**, además de TypeScript, build Vinext y
  ESLint focalizado sin errores. `tests/progress-palette.test.mjs` vigila todos
  los límites, el contraste WCAG AA y la coexistencia de avance, bloqueo y
  selección. `tests/rendered-html.test.mjs` ya no exige la antigua lógica
  binaria `done/active/pending`.
- La estética siguió la pauta editorial existente: colores apagados, superficies
  cálidas, jerarquía legible, sin gradientes ni sombras pesadas. No mover las
  coordenadas de `lib/site-plan-layout.ts` al retocar esta paleta.

## Implantación completa de los 77 edificios (20/08/2026)

- El modelo base ya contiene los **77 edificios TH-01 a TH-77** y sus **462
  apartamentos** (seis por edificio). Los 26 que ya tenían medición conservan
  sus avances y su orden histórico; los 51 restantes se añaden después, con
  avance y disciplinas al 0 %, para no alterar las claves vivas existentes.
- Las coordenadas de los dos fondos del plano están centralizadas en
  `lib/site-plan-layout.ts`: cada edificio tiene posición en la implantación
  visual y en el plano técnico. No volver a mantener mapas parciales dentro de
  `app/dashboard-client.tsx`. En el plano visual las alturas son individuales,
  no comunes por fila: la perspectiva hace que las cubiertas —especialmente
  TH-37 a TH-45— suban de izquierda a derecha.
- Los 77 edificios y los 462 apartamentos son interactivos desde el primer día.
  El color del edificio responde a su avance vivo y los seis indicadores de
  apartamento responden al estado/avance de sus disciplinas. Al publicar nuevos
  datos, el refresco normal de cinco segundos los recolorea sin redibujar el
  plano.
- La medición de Project sigue documentando sólo los 26 edificios iniciados; no
  inventar avance para los otros 51. Que una ficha exista al 0 % no significa
  que su obra haya comenzado.
- `scripts/deploy.mjs` comprueba en producción que `/api/control-room` devuelva
  77 edificios integrados y posicionados, 462 apartamentos y cero edificios
  pendientes. Un despliegue que vuelva a recortar el plano queda bloqueado.

## Reanudación desde GitHub (20/08/2026)

- Fuente canónica confirmada por el usuario: GitHub,
  `Montpla/ARAYA-Centro-de-control`. No continuar ni publicar por Sites salvo
  que el usuario lo solicite expresamente en una sesión posterior.
- La copia local se avanzó limpiamente hasta `github/main` en el commit
  `caa6eb3` (`Mejora la paleta de avance espacial`). Su
  despliegue automático de GitHub Actions terminó correctamente en la ejecución
  `32387219462`.
- Producción vigente: `https://araya-centro-control.grupobricket.workers.dev`.
  El pipeline activo sigue siendo GitHub Actions → Cloudflare Workers.
- Los últimos cambios de `main` conservan la conversión robusta de `.mpp`, la
  separación del 22,71 % físico y el cronograma, los 77 edificios/462
  apartamentos, las coordenadas ajustadas y la nueva paleta viva común.
- Existe una rama remota todavía no integrada,
  `claude/programa-continuacion-1tgsaq` (`ecd036e`), que añade al workflow una
  vista previa del avance, edificios y fin previsto cuando se ejecuta en modo
  simulación. No asumir que esa mejora forma parte de `main` ni mezclarla sin
  revisarla y validarla.
- Si el grafo de conocimiento de código de otro entorno no muestra el commit
  `caa6eb3`, reindexarlo antes de confiar en sus rutas; el repositorio y este
  documento son la referencia final.

## Instrucción para el próximo LLM

Continuar sobre este proyecto existente. No reconstruir el dashboard desde cero,
no sustituir su arquitectura y no inventar datos. Antes de modificar el código,
leer este documento completo, `AGENTS.md` del workspace si existe, y la sección
siguiente sobre la plataforma de despliegue vigente (léela antes que el resto:
corrige algo que el resto del documento da por hecho y ya no es así).

El usuario trabaja de forma iterativa: normalmente entrega archivos, capturas o
indicaciones visuales y espera que el dashboard se actualice, se compruebe y se
publique en el mismo enlace. Es una persona no técnica y trabaja en español:
conviene explicar el porqué de las cosas sin jerga, y decir con claridad cuándo
algo no se puede hacer o no ha funcionado.

Además del aviso de plataforma que viene a continuación, leer las **Normas de
publicación de datos** (justo debajo) y la sección fechada más reciente
(19/08/2026) antes de tocar la ingesta, el contrato de datos o las
notificaciones: recogen varias trampas silenciosas —datos que se extraen bien y
aun así no se publican, un solo dato dudoso que bloquea el informe entero, una
lista mezclada con sus filas que impide publicar, PDF que se leen como basura
sin que nada avise, claves que se borran solas en el siguiente despliegue— que
ya costaron un fallo real cada una.

### Normas de publicación de datos (invariantes — no romper)

Estas reglas existen porque cada una costó un fallo de «los datos no se
actualizan». Están sostenidas por código y por pruebas; al tocar la ingesta o
añadir un lector, respétalas:

1. **La ingesta automática nunca es todo-o-nada.** Un solo dato que no encaje
   no puede tumbar el informe entero. La normalización cae con red dato a dato
   (`normalizeIngestedUpdatesResilient`) y la publicación automática decide dato
   a dato (`batchPreconditions` + `updateIsAutoPublishable`). La bandeja de
   revisión manual sí es estricta; no la relajes.
2. **No mezclar una lista entera con una fila suya en el mismo lote.** La
   publicación lo rechaza (`publicationKeyConflict`). La ingesta lo resuelve
   antes de publicar quedándose con la fila (`resolvePublicationKeyConflicts`).
   Un lector debe emitir **o** la lista entera **o** sus filas por ruta hija,
   nunca ambas; y la IA de relleno no aporta una lista si el lector ya da sus
   filas (`complementoChocaConLector`).
3. **Un lector propio debe marcar siempre `area` y `cutoff`** en cada dato, o la
   publicación automática lo descarta en silencio.
4. **Al mejorar un lector, reprocesa los archivos ya subidos** (workflow
   *Reprocesar*, `reprocess`/`reemplazar`): no se re-analizan solos.
5. **Si algo queda en «observado», súbelo con `debug=1`** para ver el error
   exacto. Nunca imprimas valores de negocio en los logs: sólo nombres de clave,
   estados y metadatos.

La sección fechada del 19/08/2026 explica cada una con su historia.

## Aviso importante: plataforma de despliegue vigente (leer antes que nada)

La única plataforma de ejecución es **Cloudflare Workers**. GitHub es la fuente
canónica y su workflow publica en Cloudflare. No existe una vía alternativa de
despliegue dentro de este repositorio:

- URL de producción verificada en este cierre, con sesión real de navegador:
  `https://araya-centro-control.grupobricket.workers.dev`.
- Despliegue: `npm run deploy` (un solo comando: typecheck, build, pruebas,
  `wrangler deploy --config wrangler.deploy.jsonc` y verificación real
  contra producción — ver "Publicación con Cloudflare Workers" más abajo).
  `wrangler.deploy.jsonc` ya está commiteado.
- D1: `araya-centro-control-d1` (binding `env.DB`). R2:
  `araya-centro-control-files` (binding `env.FILES`).
- Migraciones: `npx wrangler d1 execute araya-centro-control-d1 --remote
  --file=drizzle/<archivo>.sql`. La cadena de `drizzle/meta/_journal.json`
  llega hasta `0020_notify_unmapped_field_candidate_created.sql`; no omitir
  ninguna entrada al desplegar sobre una base nueva.
- `OPENAI_API_KEY` **sí está configurada** en este entorno de Cloudflare. La
  extracción semántica normal de PDF, PPT/PPTX, DOC/DOCX e imágenes usa
  `gpt-5.6-luna`; Terra se reserva para escalados de baja confianza. XLS/XLSX
  reconocidos se resuelven sin IA. Las
  notas de este documento y de `OPERATIONS.md` que dicen lo contrario se
  refieren al entorno de Sites, no a este.
- Antes de dar por buena cualquier corrección visual o de datos, verificar
  con una sesión real de navegador contra la URL de arriba (Playwright sirve:
  login por `POST /api/auth/login` con `email` y `pin` de un administrador,
  extraer la cookie `araya_session`, `context.addCookies([...])`). Comprobar
  `npm run build`/`tsc --noEmit` nunca es suficiente por sí solo: el HTML de
  hidratación SSR siempre contiene el valor estático de arranque de
  `app/demo-data.ts` hasta que el cliente sincroniza con `/api/live-data`;
  un `grep` del bundle puede dar un falso positivo o negativo si no se
  distingue el JSON de hidratación (invisible al usuario) del DOM realmente
  renderizado.
- No volver a crear configuración, remoto ni workflow de Sites o Railway.

## Proyecto y publicación

- Proyecto: Centro de Control ARAYA — Grupo Bricket.
- Directorio local:
  `C:\Users\Usuario1\OneDrive\Desktop\ARAYA_Transformacion_Digital\12_Dashboard_Obra`
- Producción: `https://araya-centro-control.grupobricket.workers.dev`.
- Repositorio: `https://github.com/Montpla/ARAYA-Centro-de-control`, rama
  `main`, remoto local `origin`.
- Cada push a `main` ejecuta `.github/workflows/deploy.yml`, valida el proyecto
  y despliega a Cloudflare. El agente permanece como `ARAYA Asistente`.
- El contenido continúa protegido por inicio de sesión, `app_users` y permisos
  server-side.

## Estado funcional

El dashboard conserva catorce vistas funcionales, presentadas en cinco grupos:

1. `Resumen ejecutivo`, acceso directo.
2. `Obra`: Planificación, Implantación general, Edificios, Apartamentos,
   Urbanismo, Proveedores y Seguridad y permisos.
3. `Finanzas`: Finanzas y Ventas y cobranza.
4. `Datos`: Centro de datos, Cronología y Usuarios y accesos; esta última sólo
   aparece para administradores.
5. `Agente IA`, acceso directo a ARAYA Asistente.

`navItems` continúa siendo el catálogo de vistas para títulos, búsquedas y
enlaces cruzados. `navigationGroups` es la fuente única del orden agrupado que
alimentan el acordeón lateral de ordenador y los cinco accesos de tablet y
móvil. No mantener
listas duplicadas con orden diferente.

El acceso al Centro de Control requiere una identidad verificada de ChatGPT y
un alta activa en la tabla `app_users`. Bricket no almacena ni gestiona
contraseñas propias:

- El administrador inicial se aprovisiona desde la variable de producción
  `BOOTSTRAP_ADMIN_EMAIL`.
- Sólo un administrador puede crear, editar, activar, desactivar, eliminar,
  restaurar o promover usuarios desde `Usuarios y accesos`.
- La edición se realiza por identificador estable y permite cambiar nombre,
  correo, perfil, área, Finanzas y estado. El correo propio, el rol propio y el
  acceso propio están protegidos para evitar autobloqueos.
- `Eliminar acceso` es un archivado seguro: deja `active=false`, conserva la
  trazabilidad histórica, limpia la fotografía de R2 y permite restaurar la
  ficha. Una condición atómica impide eliminar o degradar al último
  administrador activo.
- Cuando una sesión abierta recibe `401` o `403` en la sincronización, borra
  cualquier caché heredada y la credencial biométrica local y vuelve a validar
  el acceso.
- Cada usuario tiene un área principal. El resumen ejecutivo adapta su bloque
  de prioridad y ordena las alertas para Dirección, Planificación, Obra,
  Urbanismo, Comercial, Finanzas, Compras, Seguridad, Legal o Diseño.
- El permiso `financeAccess` se concede o revoca individualmente. Los
  administradores lo reciben siempre.
- Sin ese permiso, Finanzas muestra una pantalla de acceso restringido y las
  API de cifras, archivos y respuestas financieras devuelven `403`; no es sólo
  una pestaña ocultada en el navegador.
- `access_audit` conserva alta, edición, eliminación y restauración con estados
  anterior y posterior.
- Cada usuario puede pulsar su avatar para cargar o sustituir su fotografía.
  El administrador puede hacerlo para cualquier persona desde `Usuarios y
  accesos`. Si no existe foto, la interfaz conserva las iniciales.
- Las fotografías admiten JPG, PNG, WebP y AVIF hasta 5 MB. Los bytes se guardan
  en R2, los metadatos en `app_users` y la descarga requiere un usuario
  autorizado. Un usuario normal sólo puede modificar su propia fotografía.

Dirección dispone además de un botón global `Crear informe`:

- Permite elegir `Informe semanal` con fecha inicial y final o `Informe
  mensual` mediante selector de mes.
- Genera una vista previa que reúne resumen ejecutivo, Curva S, producción,
  urbanismo, comercial, finanzas, seguridad, permisos y acciones prioritarias.
- Respeta el selector global USD/DOP.
- Se puede imprimir o guardar como PDF desde el navegador.
- El corte consolidado de arranque continúa siendo 30/06/2026. Cada informe
  toma la versión viva disponible al generarse; si el periodo elegido no está
  cubierto, muestra una advertencia y usa la última evidencia disponible sin
  interpolar ni inventar cifras.

La Curva S dispone de un control `Pantalla completa` en todas sus apariciones:

- Abre la gráfica como una vista superpuesta de todo el viewport sin modificar
  las series ni el corte mostrado.
- El mismo control cambia a `Cerrar`; la tecla `Esc` también restaura el tamaño
  normal.
- Mientras está ampliada se bloquea el desplazamiento del dashboard de fondo.
- En tablet y móvil conserva el desplazamiento horizontal para no comprimir ni
  recortar los 27 meses de la gráfica.

El selector de promocion activa contiene hoy una sola: `ARAYA`, el proyecto
real, con sus datos documentales y todas las funciones.

`MIRADOR DEL PARQUE` era un proyecto ficticio de demostracion (14 edificios, 84
apartamentos, urbanismo, planificacion, cronologia, proveedores y fuentes
simuladas) que servia para ensenar el programa. **Se retiro el 14/08/2026 por
peticion expresa**: la aplicacion ya esta en uso real y un proyecto simulado
conviviendo con el de obra confunde mas de lo que ayuda. Con el se fueron su
componente de contenido, sus datos de ejemplo, la rama de busqueda que los
recorria y unas 50 reglas de CSS que quedaron huerfanas.

**La estructura multipromocion se conserva entera a proposito** —el tipo
`ProjectId`, el registro `projects`, el selector y el distintivo
`PROYECTO DEMO`—, porque la intencion es ir dando de alta promociones nuevas
segun las pida el cliente. Desmontarla obligaria a rehacerla.

### Antes de dar de alta una promocion nueva

Anadir una entrada a `projects` y ampliar la union `ProjectId` hace aparecer la
promocion en el selector, pero **no le da datos propios**: de las 23 tablas,
solo `uploaded_files` y `notification_events` llevan `project_id`. Los datos
vivos —avances, cifras, edificios, apartamentos, urbanismo, curva S— son
globales, asi que una promocion nueva mostraria exactamente las mismas cifras
que ARAYA.

Darla de alta de verdad exige antes segmentar esos datos por promocion:
anadir `project_id` a las tablas de datos vivos y a sus indices, filtrar por el
en `readEffectiveLiveData` y en la publicacion, y decidir que hacer con el
historico ya publicado (que es de ARAYA). Es un trabajo de calado, no una linea
de configuracion. La advertencia esta tambien junto a `type ProjectId` en
`app/dashboard-client.tsx`, que es donde la va a leer quien lo intente.

La carga documental colaborativa está disponible en todas las pestañas de
ARAYA mediante `+ Cargar archivo` y también dentro del chat del agente:

- La carga es R2-first: el original se persiste primero en la vinculación
  privada `FILES`; después D1 confirma el expediente. Las rutas de recuperación
  resuelven respuestas ambiguas sin duplicar ni perder el objeto.
- D1 registra usuario autenticado, área, sección, descripción, moneda de
  origen, fecha de corte, tamaño, SHA-256, versión, estado y motivo de
  clasificación.
- Los duplicados exactos se detectan por SHA-256 y no se vuelven a almacenar.
- Cada archivo muestra una cola de cuatro fases: recepción, clasificación,
  normalización y sincronización. La clasificación se completa al cargar; la
  sincronización llega al 100% únicamente cuando una revisión viva vinculada
  publica datos, evitando afirmar que un original ya fue interpretado.
- El Centro de datos abre una página reciente de 75 expedientes, con máximo 200
  por petición, agrupada por año y mes. `Cargar archivos anteriores` recorre el
  histórico con cursor estable sin perder páginas ya abiertas. Cada 5 segundos
  un feed incremental trae sólo cambios y reconcilia bajas o reclasificaciones
  de IDs que el usuario ya conocía; el resumen global se calcula en D1 sobre
  todo el conjunto visible.
- El original de toda carga aparece inmediatamente con estado técnico
  `pendiente_revision`, mostrado como `En normalización`.
- Cuando el contenido se normaliza mediante el contrato de datos vivos, se
  publica una revisión que actualiza automáticamente gráficas, cifras,
  porcentajes, cronograma, avance, informes y respuestas del agente.
- Las contradicciones no se sustituyen silenciosamente: conservan la
  procedencia y quedan observadas para conciliación.
- Límite actual: 50 MB. Se pueden archivar Excel, CSV, JSON, PowerPoint, PDF,
  Word, MPP, DWG, imágenes y ZIP. De todos ellos sólo MPP y DWG se quedan en
  archivo sin leer; el resto se interpreta (los dos primeros grupos de forma
  determinista, las imágenes y los PDF escaneados con IA).

Rutas y persistencia:

- `app/api/files/route.ts`: listado, carga y descarga privada.
- `lib/file-routing.ts`: áreas, clasificación y normalización de nombres.
- `uploaded_files`: metadatos del archivo.
- `file_activity`: auditoría de eventos.
- `drizzle/0001_milky_jamie_braddock.sql`: migración correspondiente.
- `drizzle/0002_dry_black_knight.sql`: añade `source_currency`; los registros
  previos y las cargas sin moneda explícita quedan como `DOP`.
- `drizzle/0003_luxuriant_thaddeus_ross.sql`: añade las revisiones y puntos de
  datos vivos.
- La cadena operativa completa llega hasta
  `drizzle/0016_outstanding_stark_industries.sql`; esta última añade los índices
  compuestos de creación/actualización usados por la paginación y el feed. No
  omitir ninguna entrada de `drizzle/meta/_journal.json` al desplegar.

### Capa de datos vivos

Regla permanente del producto: todo valor variable se lee desde un único
contrato versionado. La base documental integrada sigue siendo el valor de
respaldo; cualquier actualización normalizada prevalece en pantalla sin
necesidad de recompilar o volver a desplegar.

- `GET /api/live-data`: devuelve valores, procedencia por clave, revisión,
  último evento y frecuencia de refresco.
- `POST /api/live-data`: publica hasta 250 cambios normalizados por revisión.
  Cada cambio exige una clave permitida y conserva área, archivo fuente,
  fecha de corte, moneda de origen, responsable y fecha de actualización.
- `live_data_events`: cabecera de auditoría de cada revisión.
- `live_data_points`: caché materializada por clave; la lectura canónica se
  reconstruye desde el historial de eventos publicados y no confía en una
  revisión `preparing` o compensada.
- `live_data_history`: conserva cada valor publicado, revisión, fuente, corte,
  moneda, responsable y fecha; no se limita al último valor.
- `lib/live-data.ts`: contrato, claves admitidas y aplicación de valores vivos
  sobre los modelos existentes.
- `app/dashboard-client.tsx`: consulta `/api/live-data` y `/api/dashboard` cada
  5 segundos y vuelve a renderizar todas las vistas.
- `app/api/agent/route.ts`: materializa la misma versión viva antes de
  responder, incluso cuando funciona con el motor local sin clave de OpenAI.
- La cinta global muestra conexión, revisión y última fuente aplicada.
- El mismo contrato gobierna la implantación: edificios, apartamentos y áreas de
  urbanismo se crean o actualizan desde sus colecciones vivas. El estado visual
  de cada apartamento se deriva de su avance (`100%` terminado, `>0%` en curso,
  `0%` pendiente, salvo bloqueo explícito) y actualiza color, contadores y
  fichas.
- Los nuevos edificios o puntos urbanos pueden incluir `mapCoordinates` para
  `visual` y `technical`. Sin coordenadas continúan apareciendo en sus listados
  y métricas, pero no se inventa una posición en el plano.
- Las alertas del resumen se recalculan con los modelos vivos y se priorizan
  por el área del usuario sin ocultar los controles transversales.

Importante: se interpretan de forma **determinista**, sin IA de por medio,
CSV/JSON conforme al contrato vivo, el XML de Project (MSPDI), XLS/XLSX, las
tablas de DOC/DOCX y PPT/PPTX, el texto de un PDF digital y el contenido de un
ZIP (se abre y se procesa lo que lleva dentro). Las **imágenes** y los **PDF
escaneados** —que son fotografías, no texto— requieren `OPENAI_API_KEY` en
Sites para su interpretación semántica; sin esa clave el original queda seguro
y pendiente de revisión. **DWG y MPP** se archivan pero no se interpretan: para
el `.mpp` la salida buena es exportarlo a XML desde Project, y la que no depende
de nada es la pantalla de actualización manual (Usuarios → «Actualizar
porcentajes a mano»), que publica por el mismo camino que una carga. Sólo una
revisión publicada modifica cifras, gráficos o elementos espaciales, y se
propaga en un máximo de cinco segundos.

La aplicación exige identidad ChatGPT y pertenencia activa a `app_users` antes
de renderizar el dashboard. Desde el 11/08/2026 Sites está en modo `public`, de
modo que cualquier persona puede alcanzar el inicio de sesión sin depender de
una segunda lista externa. El contenido sigue cerrado por la autenticación y el
allowlist de D1 de la propia aplicación; sólo los administradores gestionan ese
directorio.

La implantación general incluye:

- Plano visual arquitectónico como vista predeterminada.
- Plano técnico original como vista alternativa.
- 26 edificios interactivos.
- 156 apartamentos interactivos, seis por edificio.
- Colores de estado para terminada, en curso, pendiente y bloqueada.
- Fichas individuales de apartamento.
- Cada ficha admite superestructura, albañilería, instalaciones, acabados,
  responsable, incidencias, fuente y última actualización. Los campos sin
  evidencia se muestran como pendientes y nunca se rellenan por inferencia.
- Fichas conjuntas de edificio.
- Seis puntos interactivos de urbanismo.

El cronograma se representa con líneas:

- Línea cian para el plan operativo y línea dorada para el ejecutado real,
  siguiendo la última captura de referencia aportada por el usuario.
- Un punto por cada mes del plan.
- Puntos ejecutados únicamente en meses con datos reales.
- Eje vertical de 0% a 100% con divisiones de 10 puntos.
- Fechas completas `YYYY-MM` inclinadas desde 2025-06 hasta 2027-08.
- Cada punto muestra su valor y el bloque inferior resume el corte de junio.
- No extender ni inventar valores ejecutados futuros.

### Experiencia tablet, móvil y aplicación instalable

La versión 26 mantiene el escritorio sin cambios estructurales y añade una capa
específica para pantallas de hasta 1.100 px:

- El menú lateral se sustituye por una barra inferior táctil con Inicio, Plano,
  Apartamentos, Datos y Más.
- `Más` abre un panel con selector de proyecto, todas las secciones, usuario,
  cierre de sesión y acciones rápidas para cargar archivos, consultar al agente
  y crear informes.
- La implantación dispone de zoom de 100% a 225%, desplazamiento táctil y modo
  de pantalla completa. Los puntos de edificios, apartamentos y urbanismo
  conservan las coordenadas del mismo plano y abren sus fichas.
- El agente, las fichas, los formularios y los modales funcionan como paneles
  adaptados a la altura disponible y respetan las zonas seguras del dispositivo.
- Las tablas, gráficos, pestañas y filtros extensos se desplazan horizontalmente
  cuando no caben; los controles principales tienen objetivos táctiles.
- La carga normal, el agente y la acción rápida `Hacer foto` permiten abrir la
  cámara trasera. La fotografía queda preseleccionada en el expediente para
  completar área, corte, moneda y descripción antes de enviarla.
- `public/manifest.webmanifest` y `public/sw.js` permiten instalar el Centro de
  Control desde el navegador compatible. El service worker vigente conserva
  solo activos públicos e inmutables; nunca almacena navegaciones autenticadas,
  RSC, API, documentos ni respuestas vivas. Una vista ya abierta tolera una
  pérdida breve de red, pero volver a entrar exige conexión y validación de la
  identidad. Sin conexión no se permiten cargas, cambios ni informes.
- `app/layout.tsx` declara el manifiesto, icono Bricket, modo Apple web app,
  color de interfaz y `viewport-fit=cover`.
- La campana abre `Avisos y seguridad`: combina revisiones vivas, actividad,
  conciliaciones, documentos pendientes y acciones vencidas. El usuario puede
  activar los avisos del sistema desde un gesto explícito y enviar una prueba.
- `app/device-center.tsx` añade una puerta WebAuthn local con autenticador de
  plataforma y verificación de usuario obligatoria. Puede usar Face ID, Touch
  ID, huella, PIN o el método seguro que exponga el dispositivo. Es una segunda
  barrera local; no sustituye la sesión ni los permisos financieros del
  servidor.
- Tras 30 segundos fuera de la aplicación, una instalación con biometría vuelve
  a bloquearse. La recuperación exige conexión y un nuevo inicio de sesión; no
  permite saltarse la comprobación biométrica.
- Sin red sólo permanece utilizable la vista que ya estaba abierta en memoria.
  Recargar o volver a entrar exige conexión y una identidad válida; `v5` no
  conserva una caché privada del dashboard. Al cerrar sesión se limpian las
  cachés y credenciales locales restantes.

## Datos actualmente integrados

Corte documental original: 30/06/2026. Actualizado el 13/08/2026 tras
publicar julio (ver "Reversión de autoridad de la Curva S" más abajo): estas
cifras son valores vivos que cambian con cada Excel maestro nuevo que se
apruebe, no constantes de código. Antes de confiar en un número de esta
lista, contrastarlo con `GET /api/control-room` (`planning.physicalActual`,
`planning.curveCutoffLabel`) en vez de asumir que sigue vigente.

- Avance físico ejecutado: 22,71% (corte jul-26; fuente: `monthlyPlan`,
  Excel maestro, ya no el promedio por apartamento — ver más abajo).
- Avance por apartamento (métrica de apoyo, ya no autoritativa): 20,13%.
- Plan operativo (KPI): 26,61% (mismo corte jul-26 que el ejecutado; ver
  "Plan operativo y avance físico ahora comparan siempre el mismo mes" más
  abajo — antes de esa corrección este campo quedaba congelado en el plan
  del mes anterior, dando una desviación falsa).
- Avance del cronograma MPP: 17%.
- Desviación física: -3,9 puntos porcentuales (ejecutado por debajo del
  plan operativo del mismo mes).
- Fin de línea base: 31/05/2027.
- Fin previsto: 07/06/2027.
- Desviación prevista: +7 días.
- 77 TH identificados en el plano general.
- 26 edificios con datos operativos.
- 51 TH pendientes de integrar.
- 156 apartamentos en seguimiento.
- Urbanismo ejecutado: 18,28%.
- Urbanismo planificado: 16,18%.
- Regla monetaria: cualquier importe sin moneda explícita se interpreta como
  DOP. Las cubicaciones se registran por tanto con moneda fuente DOP.
- La visualización predeterminada es USD. El selector global permite cambiar
  entre USD y DOP sin modificar los valores fuente.
- Tipo de cambio documental: `1 DOP = 0,016788 USD`, corte 30/06/2026
  (`BCE-06-26`). No sustituirlo por una tasa en vivo para este cierre.

Edificios con datos:

- TH-01 a TH-18.
- TH-70 a TH-77.

## Fuentes y activos

Fuente DWG original del usuario:

`C:\Users\Usuario1\Downloads\Telegram Desktop\002 - IMPLANTACIÓN GENERAL.dwg`

Copia incorporada al Centro de datos:

`historical/data-center/002-implantacion-general.dwg`

Activos principales:

- `public/bricket-mark.png`: logotipo naranja con símbolo blanco de Bricket,
  facilitado por el usuario y usado en la cabecera lateral.
- `public/araya-mark.png`: logotipo facilitado por el usuario que sustituye a
  las letras `AR` en la versión anterior del selector; conservar como histórico.
- `public/araya-wordmark.jpg`: marca horizontal `ARAYA Punta Cana` actualmente
  usada en el selector de proyecto y en su menú desplegable.
- `public/araya-site-plan-clean.png`: plano técnico exacto.
- `public/araya-visual-masterplan-v3.png`: masterplan visual actualmente usado.
- `public/araya-architectural-masterplan-v2.png`: versión visual anterior;
  conservar como histórico, pero no usar como base interactiva.
- `public/og.png`: imagen social.

La imagen `araya-visual-masterplan-v3.png` se generó a partir del plano técnico
con la geometría como referencia estricta. No volver a generar el masterplan
por cambios de posición: ajustar las capas interactivas mediante coordenadas.

## Coordenadas e implantación

Archivo responsable:

`app/dashboard-client.tsx`

Constantes relevantes:

- `planCoordinates`: posiciones sobre el plano técnico.
- `visualPlanCoordinates`: posiciones calibradas sobre el masterplan visual.
- `urbanismMapPoints`: posiciones urbanísticas en el plano técnico.
- `visualUrbanismMapPoints`: posiciones urbanísticas en el masterplan visual.
- `mapCoordinates` en los datos vivos: ubicación opcional de nuevos edificios
  y áreas urbanas sin necesidad de recompilar las constantes históricas.

Las 26 posiciones de `visualPlanCoordinates` fueron calibradas contra el centro
real de cada cubierta de la imagen de 982 × 1602 píxeles. No volver a desplazar
los apartamentos sin una captura anotada del usuario.

Última indicación visual del usuario:

`C:\Users\Usuario1\OneDrive\Pictures\Screenshots\Captura de pantalla 2026-07-28 193622.png`

En esa captura el usuario dibujó dos flechas azules. La versión 11 aplica:

- `PAISAJISMO`: punto superior central señalado por la flecha izquierda.
  Coordenada visual aproximada: `x: 48.0`, `y: 46.3`.
- `P`: banda de aparcamientos situada justo encima de TH-75/TH-74, señalada
  por la flecha derecha. Coordenada visual aproximada: `x: 65.3`, `y: 61.4`.
- `VIAL`: permanece en la carretera perimetral derecha con vehículos.
  Coordenada visual: `x: 91.0`, `y: 35.0`.

Puntos restantes:

- `URB`: indicador consolidado de urbanismo.
- `EQ`: equipamientos.
- `ACCESO`: acceso principal.

Todos los puntos deben continuar abriendo sus fichas correctas.

## Archivos principales del código

- `app/dashboard-client.tsx`: interfaz, navegación, mapa, gráficos e
  interacciones.
- `app/demo-data.ts`: modelo de datos normalizado y registros de ejemplo
  derivados de las fuentes.
- `app/june-report-data.ts`: datos reconciliados de ventas, obra, urbanismo,
  finanzas, seguridad, permisos y gestiones del informe de junio de 2026.
- `app/globals.css`: sistema visual y diseño responsive.
- `app/api/agent/route.ts`: consultas del agente.
- `app/api/dashboard/route.ts`: lectura y creación de métricas/proveedores.
- `app/antonely-payable-invoices.ts`: 96 líneas verificadas de CxP, agrupación
  en 86 facturas y trazabilidad por fila, partida y documento.
- `app/api/payables/route.ts`: detalle de proveedores y facturas protegido por
  permiso financiero, con datos vivos y respaldo de la fuente de junio.
- `app/api/admin/users/route.ts`: administración de usuarios, perfiles y
  permisos financieros.
- `lib/access-control.ts`: autorización común para páginas y API.
- `app/api/live-data/route.ts`: lectura y publicación autorizada de revisiones
  vivas, historial inmutable, cierre del procesamiento documental y filtrado
  financiero.
- `app/api/history/route.ts`: historial autorizado de cambios y actividad
  documental.
- `app/api/profile/avatar/route.ts`: lectura y carga protegida de fotografías
  de perfil en R2.
- `tests/rendered-html.test.mjs`: pruebas de navegación, fuentes, datos y
  componentes.
- `drizzle/`: esquema y migraciones de D1.
- `drizzle/0004_organic_krista_starr.sql`: usuarios autorizados y auditoría de
  accesos.
- `drizzle/0005_dapper_silver_surfer.sql`: área del usuario, recorrido de
  procesamiento del archivo e historial persistente de datos vivos.
- `drizzle/0006_legal_the_liberteens.sql`: metadatos persistentes de la
  fotografía de cada usuario.
- `wrangler.deploy.jsonc`: bindings y configuración de producción en Cloudflare.

## Validación

Comando habitual:

`npm test`

Este comando ejecuta el build de vinext y toda la carpeta `tests/` (por
glob, `node --test tests/*.mjs` — no hace falta añadir un archivo nuevo a
ninguna lista). No conservar aquí un contador histórico como si fuera
vigente: anotar el resultado exacto del último commit desplegado después de
ejecutar `npm test`, `npx tsc --noEmit`, `npm run lint` y `git diff --check`.
Los avisos conocidos de `<img>` no sustituyen la comprobación de cero
errores. Para publicar de verdad (no solo validar en local), usar
`npm run deploy` — ver "Publicación con Cloudflare Workers" más abajo.

Para cambios visuales de posición, comprobar:

1. Que la imagen cargada sea `araya-visual-masterplan-v3.png`.
2. Que existan 26 `.plan-building-hotspot`.
3. Que el marcador esté sobre el elemento indicado.
4. Que al pulsarlo se abra la ficha correcta.
5. Que la vista técnica siga operativa.

## Word y PowerPoint: se leen sus tablas (14/08/2026)

Los tres formatos modernos de Office comparten envoltorio —un ZIP con XML—, asi
que una vez resuelto el ZIP para las hojas de calculo, leer tambien las tablas
de un informe en Word o de una presentacion de comite sale casi gratis.

**Solo se leen las TABLAS, y es una decision, no una limitacion pendiente.** El
texto corrido de un informe sigue pasando por la interpretacion con IA, porque
una frase como "el edificio 14 va por el 60%" no es un dato estructurado por
bien que se lea. La lectura directa aporta su garantia justo donde hay filas y
columnas; fuera de ahi seria adivinar con otro nombre.

Dos detalles del formato que conviene no perder:

- **Word trocea el texto de una celda** en varios `<w:t>` cuando cambia el
  formato o pasa el corrector ortografico, asi que hay que recomponer la celda
  entera en vez de leer el primer fragmento.
- **Las diapositivas se ordenan por numero, no alfabeticamente**: con diez o
  mas, `slide10` iria antes que `slide2` y las tablas saldrian desordenadas.

`lib/ooxml-tables.ts` devuelve las filas en el mismo formato que las hojas de
calculo (columna → texto), de modo que la logica que ya interpreta una tabla de
avance sirve igual venga de donde venga.

## Las hojas de Excel se leen sin IA (14/08/2026)

Un `.xlsx` es un ZIP que contiene XML, y el runtime trae `DecompressionStream`
con `deflate-raw`, que es el mismo algoritmo del ZIP. Eso permite abrirlo dentro
del Worker sin arrastrar una libreria de hojas de calculo, que son grandes y
traen sus propias dependencias.

Importa porque **la oficina trabaja en Excel**. Hasta ahora un `.xlsx` solo se
podia leer con la extraccion por IA, que interpreta: acierta muchas veces, pero
puede confundir un campo o no saber a que edificio se refiere una cifra.
Leyendo las celdas, lo escrito es lo que se publica —la misma garantia que da un
CSV— sin pedirle a nadie que convierta el archivo.

`lib/xlsx-reader.ts` recorre el **directorio central** del ZIP y no las
cabeceras locales, porque es donde el formato garantiza los tamaños: en las
locales pueden venir a cero cuando el archivo se escribio en streaming, que es
justo como lo hace Excel en algunas versiones.

Se admiten las dos formas que llegan de verdad:

- **Plantilla de clave y valor**, la misma que los CSV de `plantillas/`. Ahora
  se puede rellenar en Excel y subir sin exportar a CSV.
- **Tabla de avance**, con una columna de edificio y otra de porcentaje, que es
  como la mantiene la oficina. Solo se aceptan las filas inequivocas: nombre de
  edificio reconocible y numero entre 0 y 100.

La cabecera **no se busca solo en la primera fila**: los informes suelen llevar
encima un titulo o un membrete, asi que se recorre hasta encontrar una fila con
alguna cabecera esperada.

Una diferencia sutil que costo detectar: **Excel no emite las celdas vacias**,
mientras que en un CSV la celda vacia si llega como cadena vacia. Sin
igualarlo, una plantilla a medio rellenar se comportaba distinto en cada
formato —en CSV "no toco este dato", en Excel un aviso de valor ausente—, asi
que `rowsToRecords` rellena con cadena vacia toda columna de la cabecera.

`extractStructuredUpdates` pasa a ser asincrona por la descompresion; sus
llamadores y varias pruebas se actualizaron en consecuencia.

## Carga automatica desde Microsoft Project (14/08/2026)

El XML resolvio que el plan se pudiera leer, pero seguia exigiendo dos pasos
manuales cada mes: guardar como XML y subirlo. La carga automatica los elimina.

**En el equipo de la oficina**: `scripts/araya-project-autoenvio.bas`, una macro
para Project que al guardar exporta el plan a XML en una carpeta temporal, lo
envia al Centro de Control y borra el temporal. El disparador va en el modulo
`ThisProject` con `Project_BeforeSave`, y lleva `On Error Resume Next` a
proposito: si falla la red, se pierde ese envio, nunca el guardado.

**En el servidor**: la tabla `upload_agent_tokens` y `lib/upload-agent-auth.ts`.
El POST de `/api/files` acepta ahora dos identidades —la sesion del navegador y
un token de carga—, y a partir de ahi el recorrido es **exactamente el mismo**:
clasificacion, extraccion, contrato, publicacion y auditoria. No hay rama
aparte, asi que una carga automatica no puede hacer nada que su responsable no
pudiera hacer a mano.

Los emite y revoca un administrador desde **Usuarios y accesos → Cargas
automaticas**, con un maximo de 10 activos. El panel existe porque quien
administra el Centro de Control no suele estar en la oficina donde se suben los
archivos: sin el habria que llamar a la API a mano para dar de alta cada equipo,
y eso impedia repartir los accesos en remoto.

**Conviene un token por equipo, no uno compartido por todos.** Con uno por
equipo, perder un ordenador se resuelve revocando solo ese; con uno compartido
hay que revocarlo y reconfigurar todos los demas, y ademas todas las cargas
aparecen bajo la misma persona en la auditoria, que deja de distinguir quien
envio que.

### El token vive fuera del navegador, asi que el diseno asume que puede filtrarse

Es la unica credencial del sistema que reside en un equipo ajeno, dentro de un
fichero de macro. Las garantias que limitan el dano:

- **Solo se guarda el hash SHA-256.** El token en claro se muestra una vez al
  crearlo y no vuelve a existir en la base.
- **Caduca (180 dias por defecto) y se revoca al instante**, sin depender de que
  nadie toque el equipo de la oficina.
- **No es un usuario ni tiene permisos propios.** Se emite a nombre de una
  persona, hereda los suyos y se comprueban en cada uso mediante el mismo
  `publicUser` que resuelve una sesion: si se desactiva, se borra o pierde el
  acceso financiero, el token deja de servir. Un token robado nunca puede mas
  que su responsable.
- **Solo carga.** No abre el panel, no lee datos y no consulta el registro.
- **Deja rastro**: fecha y contador de usos, y la carga queda atribuida a una
  persona con nombre y apellidos en la auditoria.

## Los planes de Project se leen en XML (14/08/2026)

Los `.mpp` son un formato binario cerrado. Se comprobaron las alternativas antes
de descartarlos: **MPXJ** —la libreria de referencia— es Java y no tiene version
JavaScript, y **Aspose.Tasks** es una API en la nube por suscripcion. Ninguna
sirve dentro de un Worker sin pagar, asi que el corte mensual de obra llevaba
meses subiendose en un formato que la aplicacion archivaba sin leer.

La salida es que **Project guarda en XML de forma nativa** (Archivo → Guardar
como → tipo «XML»). Ese formato, MSPDI, esta documentado por Microsoft, trae
`PercentComplete` por tarea y se lee sin dependencias. Es mejor que exportar a
Excel: conserva el plan entero —nombres, porcentajes, fechas, jerarquia—
mientras que un Excel depende de que columnas eligiera quien lo genero.

`lib/project-xml.ts` lee las tareas y deriva el avance de cada edificio:

- **Las tareas resumen quedan fuera.** Su porcentaje lo calcula Project
  agregando a las hijas; contarlo seria contar dos veces lo mismo.
- **Varias tareas del mismo edificio se promedian**, que es lo que representa su
  avance en un plan por capitulos.
- **El codigo de edificio se busca con un patron estricto** (`TH-14`,
  `Edificio 14`, `Ed. 7`). Una tarea llamada "Fase 14" lleva un numero pero no
  nombra un edificio, y adivinarlo meteria el avance en el equivocado — el
  mismo error que costo meses detectar.
- **Se contrasta con los edificios que existen** (`knownBuildingTokens` en la
  ruta de subida), asi una tarea rotulada "TH-99" no da de alta un edificio
  fantasma en la implantacion.

El modulo no importa nada del modelo de datos a proposito: se puede leer un
plan de Project sin arrastrar medio sistema detras, y por eso normaliza el
codigo localmente en vez de llamar a `namingToken`.

El `.mpp` sigue archivandose sin leer, pero su rotulo y su mensaje llevan ahora
a la via buena en vez de a una exportacion a Excel.

## Por qué la implantación nunca se actualizaba (14/08/2026)

El usuario llevaba meses subiendo el corte mensual de obra y viendo que los
colores de los edificios, sus porcentajes y el indicador de urbanismo no se
movían: seguían clavados en los valores de fábrica. No era un fallo, eran
**cuatro barreras encadenadas**, todas silenciosas — el archivo constaba como
procesado y nada avisaba de que sus cifras se habían quedado por el camino.

**1. El archivo era un `.mpp`.** Microsoft Project está en
`UNSUPPORTED_EXTENSIONS`: se archiva íntegro y nunca se lee. Y `extractionMode`
lo rotulaba **"Importación especializada"**, que da a entender exactamente lo
contrario. Ese rótulo, más que el propio límite, es lo que sostuvo el
malentendido durante meses. Ahora se llama "Solo archivo (sus datos no
actualizan el panel)" y el modal de carga avisa **al elegir el fichero**, no
después de subirlo.

**2. El guion invalidaba la clave.** `keyPattern` sólo admitía segmentos
`[A-Za-z][A-Za-z0-9]*` o `\d+`, así que `buildings.TH-14.progress` se rechazaba
por "no pertenecer al modelo vivo" — y también `buildings.edificio-14.progress`,
con el identificador que genera el propio sistema. Cualquier clave que nombrara
un edificio por su código moría en la validación. Los segmentos hijos admiten
ahora guiones; la raíz sigue siendo alfanumérica y `forbiddenPathSegments`
sigue cortando `__proto__` y compañía.

**3. El contrato sólo comodinizaba números.** `buildings.*.progress` casaba con
`buildings.13.progress` pero no con `buildings.TH-14.progress`. Se resuelve
traduciendo el nombre a posición **antes** de que la clave viaje
(`resolveDeepSpatialKey`, en `lib/spatial-identity-upsert.ts`), de modo que por
el contrato, la publicación y la base de datos sigue circulando una sola
representación canónica: posiciones. El upsert que ya existía sólo cubría rutas
de entidad completa con objeto por valor (`buildings.TH-14` = `{...}`), y un
parte de obra casi siempre trae el dato suelto.

**4. Había dos normalizaciones distintas.** `identityToken` reducía "TH-14" a
"th14", que no casa con el `shortName` "14" del edificio. Ahora ambos módulos
comparten `namingToken` (`lib/live-data.ts`), que descarta acentos,
separadores, el prefijo de tipo (`TH`, `edificio`, `torre`, `apartamento`…) y
los ceros de relleno: "TH-14", "edificio-14", "TH-014" y "14" colapsan en el
mismo token.

**La trampa que conviene no olvidar:** los 26 edificios **no están ordenados
por su código**. La posición 0 es el edificio "3" (rotulado TH-03) y el
edificio "14" (TH-14) vive en la posición 13. Por eso un número suelto en una
clave significa posición y nunca número de edificio — `buildings.14` apunta a
TH-13, no a TH-14. Se ha mantenido así por retrocompatibilidad estricta (las
claves ya publicadas traen posiciones y reinterpretarlas habría movido datos
asentados), y el prompt de extracción lo advierte ahora de forma explícita,
con la instrucción de escribir siempre el nombre visible.

`setPath` (`lib/live-data.ts`) resuelve además nombres al materializar, como
red de seguridad: antes hacía `Number("TH-14")` → `NaN`, escribía en una
propiedad "NaN" del array y el dato se perdía sin error ni aviso. Un nombre que
no corresponde a ninguna entidad viva se descarta entero en vez de inventar una
posición, que crearía un edificio fantasma en la implantación.

Cubierto por `tests/live-key-naming.test.mjs` (nombres de obra, ceros de
relleno, identificador interno, apartamentos, retrocompatibilidad de las
posiciones y descarte limpio de lo inexistente) y por cuatro casos nuevos en
`tests/effective-live-data.test.mjs` para la traducción profunda.

## Las cifras economicas tambien se dirigen por nombre (14/08/2026)

Al preguntar el usuario si el fallo de los edificios pasaba tambien con las
cuentas, una auditoria de las 26 colecciones de lista del modelo mostro que
**solo 5 traen id** (buildings, urbanismAreas, customMetrics, dataSources y
timeline). Las 21 restantes -CxP, coste, anticipos, ventas, permisos, plan
mensual- se distinguen por su nombre de negocio ("Edificaciones",
"Construccion", "Grupo Alugav"), por su mes ("jun 25") o por su entidad
emisora, y ninguno de esos campos se reconocia: la unica forma de dirigir un
importe era su posicion en la lista. Bastaba con que el orden cambiara o con
que la extraccion errara el numero para que **el dinero entrara en otra
partida sin que nada lo senalara** — el mismo fallo de los edificios, sobre
cifras economicas.

`ENTITY_NAMING_KEYS` reconoce ahora tambien `name`, `month`, `period`,
`entity`, `category`, `concept` y `label`, y `resolveNamedListKey`
(`lib/spatial-identity-upsert.ts`) traduce esos nombres a posicion para
cualquier coleccion, no solo las espaciales. Necesita las colecciones de
partida como argumento (`getContractRootsSnapshot()`) porque son medio centenar
y viven repartidas por varios modulos.

Dos cautelas que salieron de aqui y conviene no deshacer:

- **El prefijo de tipo solo se recorta si detras viene un numero.** La primera
  version lo quitaba siempre, y "Torres del Este" quedaba en "sdeleste" y
  "Torre Norte" en "norte". Con nombres tecnicos daba igual, pero al admitir
  nombres de negocio dos partidas distintas podian colapsar en el mismo token.

- **Un nombre que senala a dos entidades no escribe en ninguna.** Elegir la
  primera repartiria el importe a cara o cruz entre dos lineas. Esto no es
  teorico: la Curva S abarca 27 meses y solo lleva ano en el primero de cada
  uno, asi que **"jul" designa a la vez a julio de 2025, 2026 y 2027** (y
  "ago" igual). Como el avance fisico global sale de la ultima fila con
  ejecutado no nulo, escribir en el ano equivocado desplazaria el KPI principal
  del proyecto. Por eso la plantilla `04-curva-s-mensual.csv` usa posiciones y
  no etiquetas de mes.

## El aviso cuando una subida no mueve ninguna cifra (14/08/2026)

Cierra la misma clase de fallo que las cuatro barreras de la sección anterior,
pero por el lado de la comunicacion. Cuando no se publicaba ningun dato, la
respuesta decia:

> "El original aparece de inmediato y queda pendiente de interpretacion;
> todavia no modifica cifras ni graficas."

Ese texto sugiere que el trabajo sigue en marcha. Cuando el formato no se lee,
o cuando las claves extraidas se descartan por no encajar en el modelo, **no va
a ocurrir nada mas**: la extraccion ya termino en esa misma peticion. Quien
subia el corte del mes se quedaba esperando un procesamiento inexistente, y el
panel seguia mostrando los mismos valores sin que nada senalara el problema.

`nothingExtractedMessage` (`lib/upload-messages.ts`) dice ahora que el archivo
queda archivado y descargable pero que ninguna cifra ha entrado, distingue el
caso del formato que no se lee —con la salida concreta: exportar a Excel o
CSV— y arrastra los dos primeros avisos de la extraccion en vez de dejarlos
solo en el registro interno. Vive en `lib/` y no en la propia ruta porque un
`route.ts` de Next no debe exportar ayudantes, y asi es verificable
directamente (`tests/upload-messages.test.mjs`).

## Plan de Cloudflare: Workers Paid desde el 14/08/2026 (leer antes de optimizar la carga)

La cuenta estuvo en **Workers Free** hasta el 14/08/2026, y eso rompía la
carga de archivos en producción de una forma que costó identificar: subir un
`.mpp` de 5,23 MB devolvía en la interfaz `Unexpected token '<', "<!DOCTYPE
"... is not valid JSON`. Ese error no es un fallo de la aplicación: es la
página HTML de error de Cloudflare colándose donde el cliente esperaba JSON,
porque el Worker se quedaba sin **tiempo de CPU** (Free: 10 ms por
invocación) al leer el archivo, calcular su SHA-256 y enviarlo a R2.

Encajaba con todo lo observado: los CSV y JSON pequeños funcionaban desde
siempre, y los informes reales (Excel, PPTX, MPP de varios MB) no. En el
panel de Cloudflare se veía `9.397 / 100.000 requests` y `Upgrade`
disponible, las dos señales del plan gratuito.

**Workers Paid** (5 $/mes) sube el límite a 30 s de CPU por invocación y
elimina el techo de 100.000 peticiones diarias. No requiere ningún cambio de
código ni un despliegue: el límite es de cuenta y se aplica al instante.

Dos cosas que conviene no olvidar:

- **El techo de peticiones era un problema latente y grave**, no solo un
  límite teórico. El dashboard consulta unos 4 endpoints cada 5 s por
  pestaña abierta: ~23.000 peticiones por persona y jornada de 8 h. Con
  cuatro personas en la oficina de República Dominicana se agotaban las
  100.000 antes del final del día y la aplicación dejaba de responder **para
  todos**. Si algún día se vuelve al plan gratuito, esto reaparece.
- **La alternativa sin pagar habría sido parcial**, y por eso se descartó:
  evitar que el Worker procese el archivo (streaming directo a R2, SHA-256
  en el navegador) arregla `.mpp`, `.dwg` y `.zip` — justo los tres formatos
  que solo se archivan — pero no los Excel ni los PDF, que necesitan estar
  en memoria para que `extractStructuredUpdates` y `extractDocumentWithAI`
  lean sus cifras. Es decir, habría dejado sin resolver precisamente los
  archivos que alimentan el dashboard.

Si en el futuro hay que volver a bajar el consumo de CPU o de peticiones, el
camino con más recorrido es consolidar los ~4 sondeos por pestaña en uno
solo (sigue pendiente, ver "Mejoras de tiempo real"), no reescribir la
carga.

## Publicación con Cloudflare Workers (vigente)

Implementado el 13/08/2026, a petición explícita del usuario de automatizar
el proceso de despliegue. Antes de esto, publicar eran cinco pasos manuales
(typecheck, build, tests, `wrangler deploy`, y una comprobación aparte que
alguien tenía que acordarse de hacer) — el mismo patrón de "si nadie se
acuerda, se salta" que motivó la auditoría de datos congelados. Ahora es un
solo comando:

```
npm run deploy
```

`scripts/deploy.mjs` ejecuta, en orden, y se detiene en el primer fallo sin
avanzar al siguiente paso:

1. `npx tsc --noEmit -p .`
2. `npm run build`
3. `node --test tests/*.mjs` (toda la carpeta `tests/`, por glob — ya no hay
   una lista de archivos escrita a mano en `package.json` que se pueda
   quedar desactualizada; eso mismo pasó con `tests/live-sync-consistency.
   test.mjs` el mismo día que se escribió esta sección).
4. `npx wrangler deploy --config wrangler.deploy.jsonc`.
5. **Verificación real contra producción**, no solo compilación: confirma
   que el Worker responde, hace login y comprueba con datos reales de
   `/api/control-room` que `planning.kpiPlan` y `planning.curvePlanAtCutoff`
   siguen coincidiendo (guarda de regresión directa del bug de esta sesión)
   y que el resumen de documentos responde con forma válida.

El paso 5 solo corre completo si existen `DEPLOY_VERIFY_EMAIL` y
`DEPLOY_VERIFY_PIN` en el entorno local (nunca deben escribirse en ningún
archivo commiteado). Sin esas variables, el script avisa y omite la parte
autenticada en vez de fallar — sigue comprobando que el Worker esté vivo.

Migraciones de D1: **deliberadamente fuera** del pipeline automático. No
existe todavía una forma segura de detectar automáticamente cuáles de
`drizzle/*.sql` ya se aplicaron contra D1 remoto (esta base no usa el
sistema de seguimiento propio de `wrangler d1 migrations`; se ha aplicado
cada migración a mano con `wrangler d1 execute ... --file=...` durante toda
la vida del proyecto). Reintentar una migración ya aplicada falla en voz
alta (`table already exists`), lo cual es seguro pero molesto — así que
cuando haya una migración nueva, aplicarla aparte, una sola vez:

```
npx wrangler d1 execute araya-centro-control-d1 --remote --file=drizzle/<archivo>.sql
```

Desde el 14/08/2026 ese comando **ya no exige un ordenador con wrangler
instalado y credenciales de Cloudflare a mano**:
`.github/workflows/migrate-d1.yml` lo ejecuta desde la pestaña **Actions**
de GitHub (workflow "Aplicar migración D1"). Se dispara solo a mano, pide el
nombre del archivo y la confirmación literal `aplicar`, rechaza rutas o
subidas de directorio, imprime el SQL antes de ejecutarlo y reutiliza los
secretos que ya usa `deploy.yml` — ninguna credencial nueva. Las migraciones
siguen igual de fuera del pipeline automático: lo que cambió es quién puede
lanzarlas y desde dónde, no cuándo.

### Despliegue automático al hacer push (GitHub Actions)

Añadido el 13/08/2026, a petición explícita del usuario tras preguntar qué
falta para llegar a "todo automatizado". `.github/workflows/deploy.yml`
dispara `npm run deploy` (el mismo script de arriba, sin duplicar lógica)
en cada push a `main`, o a mano desde la pestaña **Actions** de GitHub.

Repositorio en GitHub: dos remotos configurados apuntan al mismo repositorio
tras un cambio de nombre — `origin` (`Montpla/ARAYA-Dashboard-Obra`, nombre
antiguo, redirige) y `github` (`Montpla/ARAYA-Centro-de-control`, nombre
actual). La rama local `main` sigue a `origin/main`.

**Operativo y verificado el 13/08/2026.** Los cuatro secretos del
repositorio están puestos en
`github.com/Montpla/ARAYA-Centro-de-control/settings/secrets/actions`
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEPLOY_VERIFY_EMAIL`,
`DEPLOY_VERIFY_PIN` — los dos últimos habilitan la verificación autenticada
completa en CI, no solo el local). Los añadió el usuario desde la web de
GitHub (el token de Cloudflare nunca pasó por chat); las dos credenciales
de verificación las añadió un asistente con `gh secret set` a petición
explícita del usuario, reutilizando la cuenta de administrador ya usada
toda la sesión para pruebas — `gh secret set` cifra el valor antes de
enviarlo a GitHub, no queda en texto plano en ningún sitio.

Confirmado con tres ejecuciones reales del workflow
(`gh workflow run deploy.yml` + `gh run watch`), la última con la cadena
completa en verde: typecheck, build, 100 pruebas, `wrangler deploy`, login
real contra producción, y `planning.kpiPlan === planning.curvePlanAtCutoff`
coincidiendo con datos en vivo. Las dos primeras ejecuciones fallaron y
sirvieron para depurar el propio pipeline, no el código de la app:

- 1ª vez: `CLOUDFLARE_API_TOKEN` no llegó a guardarse en GitHub (la lista
  de secretos solo tenía `CLOUDFLARE_ACCOUNT_ID`) — hubo que rehacer ese
  paso.
- 2ª vez: el token sí estaba, pero traía un salto de línea o espacio
  pegado de más (`Headers.set: "***" is an invalid header value` — Wrangler
  intenta usarlo como cabecera HTTP y un carácter de control lo invalida).
  Se resolvió recreándolo con el botón de copiar de Cloudflare en vez de
  seleccionar el texto a mano.

A partir de ahora, cada `git push origin main` despliega y verifica solo,
de principio a fin, sin que nadie tenga que ejecutar nada a mano. Si algún
día hay que rotar `DEPLOY_VERIFY_PIN` (cambia el PIN del administrador
usado para las pruebas), actualizar también este secreto o la verificación
autenticada empezará a fallar en cada push — no es un fallo del código, es
la credencial desactualizada.

Nunca registrar credenciales, tokens ni enlaces con autenticación incrustada.

## Lote integrado · informe de junio de 2026

Incorporado el 29/07/2026:

- `Araya_Informe_Junio_2026.pptx`: consolidado de 37 láminas.
- `Informe Obra Araya Junio 2026.pptx`: detalle de obra y seguridad.
- `Informe Ventas Araya JUN2026 2.pptx`: detalle comercial con una lámina de
  morosidad anterior.
- `INFORME_JUN_2026_ARAYA_v1_1.xlsx`: fuente financiera detallada principal.
- `Datos para Informe Jun-26.xlsx`: soporte departamental de Antonely para
  costes, CxP, anticipos y balance.
- `Lamina Flujo.pptx`: histórico rotulado mayo de 2026; no prevalece.
- `Presentación Informe Araya Junio 2026.pdf`: versión renderizada equivalente
  al consolidado.

Copias descargables:

`historical/data-center/junio-2026/`

Archivo de Antonely:

- Origen:
  `C:\Users\Usuario1\OneDrive\Desktop\Antonely\Datos para Informe Jun-26.xlsx`
- Copia:
  `historical/data-center/junio-2026/datos-para-informe-jun-26.xlsx`
- SHA-256:
  `C87ABEA3FEA21BB44D598313C2FAA8719F22FF4B265C30EBD45358897B9D590F`
- Hojas: costes acumulados, cuentas por pagar, anticipos y balance.
- CxP: 96 líneas de factura, 86 facturas consolidadas, 15 categorías y 43
  proveedores. `Proveedores` permite abrir cada proveedor, consultar sus
  facturas y abrir el detalle auditable de cada registro.
- Los archivos recibidos no incluyen PDFs individuales de esas facturas. La
  ficha muestra el documento como pendiente y permite abrir el Excel fuente;
  el botón `Abrir factura` se activa cuando una actualización añade
  `documentUrl` a la línea normalizada.
- Finanzas incorpora un `Detalle completo` con 29 cuentas de coste, 15
  categorías de CxP, 26 anticipos y 41 líneas de balance.
- Anticipos pendientes: DOP 9.210.448,86 en el detalle y DOP 9.210.448,94 en
  el balance. La diferencia de DOP 0,08 queda visible.
- El balance cuadra exactamente: activos DOP 759.714.674,92 = pasivos
  DOP 446.209.904,61 + patrimonio DOP 313.504.770,31.

Nuevas vistas interactivas:

- `Ventas y cobranza`: reservas, fases, producto, ubicación, vinculación,
  contratos y morosidad.
- `Finanzas`: presupuesto, costes, flujo, CxP, anticipos, balance y
  conciliaciones.
- `Seguridad y permisos`: seguridad, trámites y financiación.

Vistas ampliadas:

- Las 12 áreas operativas de ARAYA incorporan un mapa de trabajo común con
  módulos de datos, estado de cobertura, documentación vinculada, campos
  preparados y navegación a las secciones relacionadas.
- Los KPI principales abren una ficha contextual con valor, fuente y acción.
  También son interactivos los paquetes y acciones de planificación, modelos y
  ubicaciones comerciales, tramos de morosidad, disciplinas y demoras de
  edificios, seguridad, permisos, financiación, eventos de cronología y
  proveedores operativos.
- El buscador global encuentra también documentos por nombre o tipo y abre su
  ficha de trazabilidad. Cada documento visible puede abrirse o descargarse.
- Las fichas contextuales son responsive, se cierran con `Escape`, enlazan los
  documentos disponibles y permiten abrir la carga de una actualización en el
  área correspondiente.
- La capa conectada no se muestra sobre Finanzas cuando el usuario carece de
  permiso financiero.
- `Proveedores`: buscador, listado maestro interactivo, ficha de proveedor,
  facturas consolidadas, detalle de vencimiento e imputaciones. El API exige
  acceso financiero y se refresca cada cinco segundos.
- `Edificios`: disciplinas, retrasos de superestructura y pedidos vencidos.
- `Urbanismo`: indicador físico-financiero separado del 4% de actividades
  terminadas, avance por especialidad y retrasos de inicio.
- `Planificación`: Curva S exacta del informe y acciones recomendadas.
- `Centro de datos`: 22 fuentes, 22 descargas, carga colaborativa, versiones y
  reglas de prevalencia.

Datos de control:

- Los siguientes importes son valores fuente. La interfaz los muestra en USD
  por defecto y permite verlos en DOP.
- Físico: 18,23% ejecutado; KPI plan 21,24%; Curva S plan junio 23,29%.
- Comercial: 228 reservas activas; 24 clientes vencidos por USD 136.840,39.
- Presupuesto: RD$3.591.280.577,17; ejecutado RD$712.326.162,73.
- CxP detallada: RD$18.597.489,63.
- CxP en balance: RD$18.612.245,90.
- CxP del archivo Antonely: RD$18.627.534,91.
- Anticipos pendientes: RD$9.210.448,86.
- Caja proyectada diciembre: –RD$125.196.511,23.

Conciliaciones que deben seguir visibles:

1. Presupuesto de lámina 29: RD$3.428,5 M frente a RD$3.591,3 M del Excel y
   la lámina 30.
2. Plan físico de junio: KPI 21,24% frente a 23,29% en la Curva S.
3. Retraso general de obra: 5 días en el informe y 7 días en el MPP.
4. CxP: consolidado RD$18.597.489,63; balance RD$18.612.245,90; Antonely
   RD$18.627.534,91. El archivo Antonely supera el consolidado en RD$30.045,28
   y el balance en RD$15.289,01.
5. Tres errores `#REF!` en `Intereses 06-26!U37:W37`.
6. El desglose de morosidad excede el total en USD 0,05.
7. La presentación comercial aislada contiene una morosidad anterior; usar la
   actualización del consolidado al 06/07/2026.
8. Costes de Antonely: junio RD$48.988.755,86 y acumulado
   RD$712.326.161,73; el consolidado registra RD$48.998.910,52 y
   RD$712.326.162,73. Diferencias: RD$10.154,66 y RD$1,00.
9. La cabecera de la hoja de costes de Antonely indica por error un inicio en
   junio de 2016. Se preserva el original y se marca la observación.
10. Anticipos: balance DOP 9.210.448,94 frente a detalle DOP 9.210.448,86;
    diferencia DOP 0,08.

## Integración documental del 30/07/2026

Se recibieron siete archivos y se revisaron completos:

- 229 hojas únicas de cálculo; 241 si se cuenta la copia idéntica recibida.
- Cuatro páginas PDF.
- Los dos archivos `CUADRO COMPARATIVO-PROVEEDORES 30-07-2026` son copias
  binarias idénticas. Se conservan ambos, pero solo uno alimenta los datos.
- Los originales están en `historical/data-center/julio-2026/`.

Nuevos módulos:

- `Proveedores`: maestro consolidado de 67 empresas a partir de 71 registros,
  búsqueda por empresa, servicio, contacto o RNC, ficha individual, alertas de
  calidad, 14 paquetes de compra, calendario de desembolsos y 11 comparativos
  con 58 ofertas.
- `Finanzas > Presupuesto y desviación`: presupuesto del edificio tipo A con
  209 hojas, 164 partidas y 15 capítulos; además, desviación mensual de junio
  por 24 partidas e impacto ponderado.
- `Seguridad y permisos > Cumplimiento IFC`: compromisos afirmativos y
  negativos, reportes, seguros y puntos de negociación. Solo aparece con
  permiso financiero.
- `Centro de datos`: siete nuevas entradas con descarga, corte, alcance,
  observaciones y trazabilidad.

Datos auditados:

- Directorio: 67 proveedores únicos; 16 relaciones con crédito; límites
  declarados por DOP 41.650.000. Hay 37 filas sin RNC, 13 sin correo y un RNC
  compartido por dos empresas.
- Flujo de proveedores: la fórmula de total del archivo declara
  DOP 198.278.400,47, pero omite una partida de DOP 4.095.000. El calendario
  mensual sí la incluye y suma DOP 202.373.400,47; este último es el total
  auditado del dashboard.
- Presupuesto tipo A: original DOP 19.903.102,52 y actualizado
  DOP 20.065.326,06 por edificio; diferencia DOP 162.223,54 (+0,815%).
  Para 77 edificios, diferencia DOP 12.491.212,64.
- Desviación mensual de junio: las fórmulas vigentes calculan
  DOP 60.450,62 por edificio (+0,304%) y un ahorro ponderado del proyecto de
  DOP 1.613.789,94. Las notas narrativas finales del Excel están
  desactualizadas y no se usan como KPI.
- El archivo de comparativos contiene cuatro valores de prueba y seis fechas
  con año incoherente. Se excluyen de los totales y quedan señalados.
- El resumen IFC es una matriz operativa auxiliar; no sustituye el contrato
  original ni el criterio jurídico.

Implementación:

- Datos normalizados en `app/procurement-data.ts`.
- Pruebas: `npm run lint` sin errores y `npm test` con 24/24 aprobadas.
- La comprobación local mediante navegador fue bloqueada por la política del
  navegador para direcciones locales; la compilación y las pruebas de
  presentación sí quedaron verificadas. Revisar visualmente la URL publicada
  después de cada despliegue.

### Flujo de obra Fase I reprogramado

Archivo integrado:
`historical/data-center/julio-2026/araya-flujo-i-reprogramado.xlsx`.

- Se revisaron sus seis hojas, 1.137 fórmulas y todas las páginas renderizadas.
  No contiene errores de fórmula ni enlaces externos.
- Alcance: Urbanismo y Edificios de la Fase I. Excluye terreno, diseño,
  gerencia, indirectos, inspección, permisos y gastos financieros. No sustituye
  el flujo de caja ni el presupuesto global.
- Total del flujo: DOP 751.309.284,94.
- Real de diciembre de 2025 a junio de 2026: DOP 123.172.225,09.
- Real acumulado incluyendo el saldo anterior: DOP 145.297.705,00.
- Pendiente reprogramado de julio de 2026 a julio de 2027:
  DOP 606.011.579,94.
- La desviación acumulada de DOP 58.108.348,13 se concentra por mitades en
  agosto y septiembre de 2026.
- La portada y el Resumen dicen que se redistribuye solo el sobrante de junio,
  pero las fórmulas redistribuyen la desviación acumulada completa desde
  diciembre de 2025. El dashboard sigue las fórmulas.
- `Reprogramación!B27` y `B53` son importes DOP con un formato porcentual
  erróneo. `Hoja1` es una hoja auxiliar sin etiquetas; no alimenta KPI.
- El real de junio de este flujo es DOP 28.809.561,44; Finanzas registra
  DOP 48.998.910,52 para el proyecto completo. La diferencia corresponde al
  alcance excluido y no se presenta como error contable.
- El archivo no contiene mediciones físicas, cantidades ejecutadas ni
  porcentajes de producción. Por tanto, el avance físico validado sigue siendo
  18,23% con corte 30/06/2026.

## Punto 1 · consolidación y limpieza de datos

Iniciado y completado el 30/07/2026. El usuario validó el avance e indicó
expresamente iniciar el punto 2.

- El inventario maestro contiene 22 fuentes únicas registradas y 22 descargas
  verificadas. El Excel de avance físico y el MPP ya disponen de copia
  descargable en el Centro de datos.
- `app/data-governance.ts` clasifica cada fuente como oficial, control, soporte,
  histórica o duplicada y define la fuente principal de 11 indicadores.
- El Centro de datos muestra una matriz interactiva de autoridad, alcance,
  estado de conciliación y regla aplicada.
- La copia binaria del comparativo de proveedores continúa almacenada para
  trazabilidad, pero queda excluida de cálculos.
- Los cuatro estados de Fiduciaria Universal quedaron incorporados en
  `historical/data-center/junio-2026/fideicomiso/` y en una pestaña financiera
  independiente `Fideicomiso`.
- `app/fiduciary-statements-data.ts` conserva el estado de situación, balance de
  comprobación, resultados de junio, resultados acumulados y conciliación con
  el control interno.
- Estado oficial: activos DOP 758.765.771,05; pasivos DOP 448.317.797,67;
  patrimonio neto DOP 310.447.973,38.
- Resultado oficial: junio -DOP 6.072.739,55; enero-junio
  -DOP 6.129.446,26.
- El balance oficial cuadra, Debe = Haber y el resultado acumulado coincide con
  el importe incorporado al patrimonio.
- Fiduciaria Universal prevalece para balance y resultados contables. El Excel
  de junio prevalece para presupuesto, costes, caja y CxP operativa. No se
  suman ni se sobrescriben estas capas.
- Las diferencias entre contabilidad oficial y control interno quedan visibles
  por indicador; requieren conciliación bancaria/contable antes de cambiar una
  cifra de control.
- Las raíces vivas del flujo reprogramado y del fideicomiso se clasificaron
  expresamente como financieras en `lib/live-data.ts`. Los usuarios sin permiso
  no reciben estos valores ni las fuentes financieras publicadas en vivo.
- Pruebas del punto 1: compilación correcta, 27/27 pruebas aprobadas y lint sin
  errores; permanecen los nueve avisos conocidos de `<img>`.

## Punto 2 · carga, extracción, validación y publicación

Iniciado y completado el 30/07/2026.

- El Centro de datos incorpora una bandeja documental con filtros `Por
  validar`, `Integrados`, `Observados` y `Todos`.
- Cada carga identifica de forma determinista proyecto, área, tipo documental,
  periodo, moneda y modo de extracción. El conjunto de evaluación contiene 24
  documentos de finanzas, obra, planificación, comercial, compras, diseño,
  urbanismo, seguridad y permisos.
- El recorrido visible tiene siete fases: recepción, identificación,
  extracción, contraste, validación, publicación y sincronización.
- Los formatos CSV y JSON con columnas o propiedades `key/clave` y
  `value/valor` pueden preparar propuestas del contrato vivo automáticamente.
  Se admiten separadores por coma o punto y coma y decimales con coma.
- PDF, XLS/XLSX, PPT/PPTX, DOC/DOCX e imágenes pueden pasar por extracción
  semántica únicamente cuando Sites dispone de `OPENAI_API_KEY`; de lo
  contrario quedan catalogados y pendientes de revisión. DWG, MPP y ZIP no se
  interpretan. Almacenar el original nunca equivale por sí solo a publicar sus
  datos.
- `document_data_proposals` conserva el valor vigente, valor propuesto, clave,
  área, corte, moneda, confianza, discrepancia y estado de cada cambio.
- `file_reviews` conserva cada preparación, aprobación, observación, rechazo o
  reapertura con actor, fecha, nota, número de propuestas, revisión viva e
  identificador idempotente.
- La nueva ruta `GET/POST /api/files/review` permite consultar el expediente y
  exige administrador para preparar o decidir. Los usuarios no administradores
  sólo pueden consultar los expedientes visibles según sus permisos.
- Finanzas mantiene el bloqueo existente. Ningún usuario sin permiso recibe el
  original, el expediente ni las propuestas financieras.
- La aprobación muestra explícitamente `Valor vigente → Valor propuesto`. Una
  discrepancia nunca se sobrescribe silenciosamente.
- Aprobar propuestas crea un evento, historial inmutable y puntos vivos
  mediante `lib/publish-live-data.ts`; después todas las pantallas reciben la
  revisión en menos de cinco segundos.
- Un documento sin cambios numéricos puede aprobarse y catalogarse sin crear
  una revisión viva ni alterar indicadores.
- Los expedientes cerrados deben reabrirse antes de otra decisión. El endpoint
  directo de escritura viva queda restringido a administradores.
- En aquella versión, ARAYA Copilot usaba el prompt versionado
  `araya-copilot-v7-ingestion-controlada`: puede orientar y consultar el
  estado, pero no aprobar ni borrar desde el chat.
- La clasificación y el refresco ordinarios no consumen tokens. El agente sólo
  interviene cuando un formato necesita interpretación.
- El archivo histórico no journalizado
  `drizzle/0007_ingestion_control_room.sql` fue retirado. Su esquema de ingesta
  quedó consolidado en el `0007_rapid_black_queen.sql` que sí figura en el
  journal, para que una base nueva y una recuperación recorran la misma cadena.
- Pruebas del punto 2: compilación correcta, 31/31 pruebas aprobadas, conjunto
  de clasificación 24/24 y lint sin errores; permanecen los nueve avisos
  conocidos de `<img>`.

## Puntos 3 a 6 · sala operativa y control transversal

Iniciados y completados el 30/07/2026.

- El Resumen ejecutivo incorpora una Sala operativa con seis pestañas:
  `Calidad y cobertura`, `Plano operativo`, `Planificación`,
  `Conciliaciones`, `Informes` y `Acciones`.
- `GET /api/control-room` consolida cada cinco segundos cargas, propuestas,
  puntos vivos, integridad espacial, planificación, conciliaciones, acciones,
  actividad e informes. La respuesta es privada y respeta el permiso
  financiero.
- Calidad documental diferencia archivos aprobados, pendientes, observados y
  rechazados. El índice mostrado corresponde únicamente al expediente
  colaborativo; no se presenta como calidad global del proyecto.
- La auditoría espacial comprueba coordenadas visuales y técnicas, códigos
  duplicados, disciplinas, responsables, incidencias y campos pendientes de
  urbanismo sin cambiar la geometría del plano.
- Planificación conserva como referencias diferentes el KPI planificado y la
  serie mensual de la Curva S. Muestra paquetes desviados, paquetes críticos,
  desviación máxima y previsión de fin.
- Las conciliaciones combinan las diferencias ya documentadas del consolidado
  de junio, compras, flujo reprogramado y, para usuarios autorizados, estados
  fiduciarios. Cada incidencia abre la sección responsable.
- `lib/control-room.ts` contiene los cálculos deterministas. No crea ni
  completa datos operativos.

## Punto 7 · informes versionados

Iniciado y completado el 30/07/2026.

- Los informes semanales y mensuales se guardan en `report_snapshots` antes de
  mostrar la vista previa.
- Cada instantánea conserva periodo, moneda, corte, revisión viva, autor,
  avance, planificación, plano, producción, comercial, finanzas, seguridad y
  acciones de Dirección utilizadas al generarla.
- El archivo de informes permite reabrir una edición anterior sin presentarla
  como estado actual.
- El informe completo y sus instantáneas financieras requieren permiso de
  Finanzas.
- La impresión y exportación a PDF existentes se mantienen.

## Punto 8 · acciones colaborativas

Iniciado y completado el 30/07/2026.

- `control_actions` conserva título, descripción, área, sección enlazada,
  prioridad, estado, responsable, vencimiento, documento origen, creador y
  fechas.
- `control_action_activity` mantiene la creación, cambios de estado y
  comentarios mediante identificadores idempotentes.
- Todos los usuarios autorizados pueden crear acciones no financieras. El
  creador, la persona asignada o un administrador pueden actualizar su estado y
  comentar.
- Sólo el administrador puede asignar una acción a otra persona activa.
- Las acciones financieras quedan ocultas y bloqueadas para personas sin ese
  permiso.
- No existen borrados desde la interfaz; la trazabilidad se conserva.

## Punto 9 · cierre técnico y operación

Completado el 30/07/2026.

- Nueva ruta: `/api/control-room`.
- `drizzle/0007_rapid_black_queen.sql` es la entrada journalizada consolidada:
  contiene tanto el esquema de ingesta de aquel punto 2 como
  `control_actions`, `control_action_activity` y `report_snapshots`. No volver a
  crear un segundo `0007` fuera del journal.
- En aquella versión, ARAYA Copilot usaba el prompt
  `araya-copilot-v8-sala-operativa` y la herramienta de consulta
  `get_control_room_status`. Puede explicar, pero no crear, cerrar, reasignar
  ni aprobar.
- El conjunto de evaluación del agente aumenta a 24 casos.
- `OPERATIONS.md` documenta el uso diario, los permisos, las reglas de datos y
  el diagnóstico de incidencias.
- Pruebas del cierre: compilación correcta, 32/32 pruebas aprobadas y lint sin
  errores; permanecen los nueve avisos conocidos de `<img>`.

## Estabilidad móvil y nombre instalable

Revisado y publicado el 31/07/2026.

- Se probaron en producción las vistas de Centro de datos, fichas interactivas,
  archivo de informes y vista previa completa con tamaños de móvil
  (390 × 844) e iPad (820 × 1180).
- Los informes archivados validan las matrices y fechas de su instantánea antes
  de renderizarse. Un dato histórico incompleto ya no puede derribar toda la
  pantalla.
- Las vistas principales, fichas e informes tienen recuperación segura: ante un
  fallo aislado se muestran acciones para volver al inicio o recargar, sin
  perder datos.
- Las capas modales bloquean correctamente el desplazamiento de fondo y lo
  restauran al cerrarse.
- La vista del informe usa el alto dinámico del dispositivo, respeta las zonas
  seguras y mantiene visibles en móvil tanto `Cerrar` como
  `Imprimir / Guardar PDF`.
- El nombre instalable es `Bricket Control` en el manifiesto, los metadatos de
  aplicación y la configuración de iPhone/iPad.
- Esta sección conserva el hito móvil de julio; su Service Worker `v3` fue
  sustituido. La regla vigente es `v5`: sólo cachea activos estáticos públicos y
  nunca navegaciones autenticadas, RSC, API, documentos ni datos vivos.
- Validación final: compilación correcta, 32/32 pruebas aprobadas y lint sin
  errores; permanecen los nueve avisos conocidos de `<img>`.

## Visor de archivos con cierre seguro

Revisado y publicado el 31/07/2026 en la versión 39.

- Los PDF, imágenes y archivos de texto se abren dentro de una capa propia del
  Centro de Control; ya no sustituyen la pantalla principal de la aplicación.
- La barra superior del visor mantiene una X naranja de 44 × 44 px visible en
  móvil, además del texto `Cerrar` en tablet y escritorio.
- Al cerrar, se recupera exactamente la sección desde la que se abrió el
  documento. La URL del Centro de Control no cambia.
- Los formatos que el navegador no puede representar con seguridad, como
  Excel, MPP, DWG o PowerPoint, muestran una ficha interna cerrable con descarga
  opcional; abrir el expediente no inicia una descarga automática.
- `Escape` también cierra el visor en ordenador.
- Las cargas privadas admiten `GET /api/files?preview=...` únicamente para PDF,
  texto e imágenes raster autorizadas; los demás MIME conservan disposición de
  descarga. El control financiero sigue aplicándose en el servidor.
- Se verificó en producción a 390 × 844: apertura del PDF oficial
  `balance-general-junio-2026.pdf`, X visible, cierre correcto y retorno a
  Finanzas. Compilación correcta, 32/32 pruebas y lint sin errores.

## Funciones de dispositivo de la versión 40

Implementadas y publicadas el 31/07/2026:

- Centro de notificaciones dentro de la aplicación y avisos del sistema
  opcionales para nuevas revisiones.
- Captura directa con cámara desde el menú móvil, con previsualización antes de
  crear el expediente documental.
- Desbloqueo WebAuthn local, cierre automático al volver después de 30 segundos
  y recuperación mediante nuevo inicio de sesión.
- El hito `v40` permitía consulta parcial; la política vigente `v5` es más
  restrictiva: sólo la vista que ya permanece abierta tolera una pérdida breve
  de red. Recargar exige conexión y no se almacenan respuestas privadas.
- La limitación original de notificaciones fue sustituida: hoy existe Web Push
  con VAPID, outbox durable y entrega independiente por dispositivo, sujeto al
  permiso explícito del navegador.
- Validación: build correcto, 32/32 pruebas aprobadas, lint sin errores y los
  nueve avisos históricos de `<img>` sin cambios.

## Apertura documental y guía corporativa de la versión 41

Implementado y publicado el 31/07/2026:

- El botón `Abrir prioridad del área` de Dirección ya no intenta volver a
  cargar el propio Resumen. Ahora desplaza la pantalla hasta la Sala operativa,
  donde se concentran calidad del dato, conciliaciones, decisiones y
  seguimiento.
- Los documentos se abren primero desde el Centro de Control. PDF, imágenes,
  texto, CSV, JSON, XML y Markdown se muestran dentro del visor propio.
- Los formatos de trabajo que el navegador no representa directamente, como
  Office, DWG o MPP, ofrecen `Abrir con el visor del dispositivo` sin convertir
  la descarga en el paso principal.
- `Descargar` permanece disponible como una acción separada y voluntaria en
  las fichas, las fuentes y el visor. Las cargas privadas siguen pasando por
  autorización y conservan la restricción financiera.
- Se incorporó la guía de siete páginas
  `historical/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf`.
  Se puede abrir o descargar desde `Centro de datos` y desde `Más → Guía de
  uso` en móvil.
- El original editable se genera con
  `scripts/generate_staff_guide_pdf.py`; la entrega local está también en
  `output/pdf/guia_corporativa_bricket_control_personal_obra.pdf`.
- Validación: compilación correcta, 32/32 pruebas aprobadas y lint sin errores;
  permanecen únicamente los nueve avisos históricos de `<img>`.

## ARAYA Asistente · versión 42

Implementado y publicado el 31/07/2026:

- El agente de IA se muestra como `ARAYA Asistente` en el panel flotante y en
  la vista completa.
- Las cargas realizadas desde su chat conservan la procedencia
  `Archivo cargado mediante ARAYA Asistente`.
- La identidad interna del agente y su versión activa cambian a
  `araya-asistente-v9-sala-operativa`; las reglas, herramientas, permisos y
  límites de aprobación permanecen sin cambios.
- Los identificadores `araya-copilot-v7-ingestion-controlada` y
  `araya-copilot-v8-sala-operativa` se conservan únicamente como referencias
  históricas de las versiones anteriores.
- Validación: compilación correcta, 32/32 pruebas aprobadas y lint sin errores;
  permanecen únicamente los nueve avisos históricos de `<img>`.

## Ficha del apartamento: promedio del conjunto por disciplina

Implementado el 04/08/2026, pendiente de publicar.

- El usuario reportó que la ficha de apartamento mostraba `Superestructura`
  con dato real pero `Albañilería`, `Instalaciones` y `Acabados` siempre como
  `Pendiente`, mientras que en la misma pestaña `Edificios`, justo debajo, el
  panel `Avance por disciplina` ya mostraba un porcentaje real de esas mismas
  disciplinas para el conjunto de 26 edificios.
- `unitDisciplines()` (`app/dashboard-client.tsx`) ahora completa
  `Albañilería` e `Instalaciones` con el valor vigente de
  `constructionDisciplines` (el mismo dato vivo que ya usa el panel `Avance
  por disciplina`) cuando no existe evidencia propia del apartamento. El
  nuevo estado `conjunto` (`UnitDiscipline.status`, `app/demo-data.ts`) marca
  ese valor como `NN% · Conjunto` con un estilo propio, distinto de
  `Pendiente` y de un dato `integrado` por apartamento, para no presentarlo
  como si fuera específico de la vivienda.
- `Acabados` continúa mostrando `Pendiente`: no existe una única cifra real
  para esa etiqueta en `constructionDisciplines` (solo existen por separado
  Pintura, Revestimientos y cerámica, Misceláneos, Herrería y Carpintería).
  Promediarlas habría sido inventar una fórmula ausente en la fuente, así que
  se dejó sin cambios a propósito.
- Si en el futuro una publicación de datos vivos añade un valor real por
  apartamento (`buildings.*.units.*.disciplines.*.progress`), ese valor real
  sigue teniendo prioridad y sustituye automáticamente al promedio del
  conjunto.
- Validación: `npm test` con 32/32 pruebas aprobadas y compilación correcta;
  `npm run lint` sin errores, con los nueve avisos históricos conocidos de
  `<img>`. Se confirmó además que la etiqueta `% · Conjunto` quedó presente
  en el bundle cliente y SSR compilados (`dist/client` y `dist/server/ssr`).
- La comprobación visual en navegador local quedó bloqueada porque el D1
  local (`.wrangler`) no tiene las migraciones aplicadas ni usuarios
  `app_users`, y la app exige identidad ChatGPT antes de renderizar
  (`GET /` intenta `select ... from app_users` y falla con la tabla
  inexistente). Mismo patrón ya documentado en la integración del
  30/07/2026: pendiente de revisar visualmente en la URL publicada tras el
  próximo despliegue.

## Administración completa de usuarios

Implementado y publicado el 11/08/2026.

- `Usuarios y accesos` permite editar nombre, correo, perfil, área principal,
  permiso financiero y estado general mediante un formulario accesible que se
  adapta a ordenador, tablet, móvil y orientación apaisada.
- `Eliminar acceso` no destruye atribuciones históricas: archiva la cuenta con
  `deleted_at` y `deleted_by_email`, la desactiva, limpia su avatar de R2 y la
  mueve al directorio de eliminados, desde el que puede restaurarse.
- El servidor exige `requireApiUser({ admin: true })` para alta, edición,
  eliminación y restauración. También impide el autoborrado y usa una condición
  SQL en la propia escritura para que dos operaciones simultáneas nunca puedan
  dejar el sistema sin administrador activo.
- Cada operación registra estado anterior y posterior en `access_audit`. Si la
  escritura de auditoría falla después del cambio, la API informa honestamente
  de que la operación se aplicó y requiere revisión técnica, sin devolver un
  falso conflicto de correo.
- Una sesión revocada detecta `401/403` en el refresco de cinco segundos, borra
  cualquier caché heredada y la biometría local y vuelve a validar el acceso.
- Migración: `drizzle/0008_puzzling_the_captain.sql`.
- Política de Sites: `public`, revisión 2. El acceso real a los datos continúa
  dependiendo de identidad ChatGPT y `app_users`.
- Validación: compilación correcta, 33/33 pruebas aprobadas y lint sin errores;
  permanecen los nueve avisos históricos de `<img>`.

## Navegación agrupada

Implementada y publicada el 11/08/2026 en la versión 44.

- Orden principal único en ordenador, tablet y móvil: `01 Resumen ejecutivo`,
  `02 Obra`, `03 Finanzas`, `04 Datos` y `05 Agente IA`.
- En ordenador, Obra, Finanzas y Datos funcionan como acordeones accesibles y
  conservan abierto el grupo de la vista seleccionada.
- En tablet y móvil, la barra inferior contiene exactamente los cinco grupos;
  los tres grupos compuestos abren una hoja con sus subpestañas antes de las
  acciones rápidas de cámara, carga, avisos, guía e informes.
- El permiso financiero sigue señalando Finanzas como bloqueada sin ocultar
  Ventas y cobranza. Usuarios y accesos se filtra únicamente para perfiles no
  administradores.
- La navegación procedente de búsquedas, avisos, fichas y el plano pasa por la
  función común `navigate`, por lo que abre el grupo correcto y limpia paneles
  transitorios de forma coherente.
- Validación: compilación y 33/33 pruebas correctas; lint sin errores y con los
  nueve avisos históricos de `<img>`.

## Archivo documental, visor interno y carga simplificada

Implementado y publicado el 11/08/2026; almacenamiento privado definitivo de
originales en la versión 51.

- La bandeja no descarga el histórico completo en cada refresco. Abre los 75
  expedientes más recientes, admite hasta 200 por petición y conserva la
  agrupación por año y mes. `Cargar archivos anteriores` usa un cursor
  `(createdAt,id)` estable; el feed de cinco segundos usa `(updatedAt,id)` y
  fusiona cambios sin descartar páginas ya cargadas. El almacenamiento R2
  mantiene la ruta `araya/<area>/<YYYY>/<MM>/...`; paginar la interfaz no mueve
  ni elimina originales.
- Las fuentes históricas integradas permanecen completas, pero se presentan en
  un archivo secundario plegable para que el Centro de datos sea más compacto.
- PDF se representa dentro de Bricket Control con PDF.js, navegación de
  páginas, zoom y soporte de peticiones parciales. Imágenes y texto también se
  muestran en el visor propio. La X, `Cerrar`, `Esc` y el botón Atrás recuperan
  siempre la app. `Descargar` es una acción separada y voluntaria.
- Office, DWG y MPP ya no abren una pestaña externa, no inician una descarga al
  pulsar Abrir y nunca dejan una pantalla blanca: permanecen dentro de una
  ficha estable del visor con cierre disponible y descarga opcional. Para
  representar visualmente el contenido de esos formatos se necesitará una
  conversión derivada a PDF/HTML en una iteración posterior.
- Se eliminaron todos los `target="_blank"` de documentos del proyecto. Tanto
  facturas y fuentes como informes financieros pasan por el visor común.
- Los 23 originales históricos (50.646.816 bytes) están sembrados y
  verificados en R2 `FILES`; ninguno forma parte del paquete estático público.
  `scripts/deploy.mjs` los sincroniza con R2 y `public/.assetsignore` impide que
  entren como activos públicos. No retirar esta barrera aunque los originales
  auditables continúen en el árbol fuente.
- Cloudflare conserva `assets.run_worker_first` selectivo para
  `/data-center/*`. `proxy.ts` y la ruta dinámica
  `app/data-center/[...path]/route.ts` exigen identidad ChatGPT, usuario activo
  en `app_users` y `financeAccess` en rutas financieras o del fideicomiso; la
  ruta autorizada recupera el original de R2. Los siete archivos que superan
  el límite de una petición se guardan en fragmentos privados y se transmiten
  de forma continua, con soporte de rangos y el mismo nombre/tipo del original.
  Las respuestas son `private, no-store` y no entran en la caché offline.
- El Service Worker vigente es `v5`. Sólo cachea activos estáticos públicos;
  navegaciones autenticadas, RSC, API, `/data-center/*`, originales y datos
  vivos son siempre de red y `private, no-store`. Al activarse limpia las
  generaciones antiguas que pudieron conservar contenido privado.
- El endpoint y el secreto temporales utilizados para la siembra inicial se
  eliminaron después de verificar los 23 documentos. Las nuevas cargas deben
  seguir entrando exclusivamente por `POST /api/files` y quedan en R2 desde
  su recepción.
- La carga principal y la del agente se redujeron a seleccionar un archivo y
  pulsar `Subir y procesar`; área, tipo, periodo y moneda se detectan. Los
  campos manuales siguen disponibles dentro de `Opciones avanzadas`.
- Todos los usuarios activos pueden subir; el original y su estado aparecen en
  la bandeja compartida mediante el feed. CSV/JSON válido sigue la extracción
  determinista y sólo publica si cumple contrato, corte, área, permisos y
  límites. PDF, XLS/XLSX, PPT/PPTX, DOC/DOCX e imágenes necesitan
  `OPENAI_API_KEY` para interpretación semántica; sin ella quedan pendientes.
  DWG, MPP y ZIP sólo se archivan.
- Cuando una carga válida y autorizada se publica, crea revisión,
  procedencia e historial; `GET /api/live-data` propaga las nuevas cifras,
  barras, gráficos, cronograma y elementos espaciales en un máximo de cinco
  segundos según las claves incluidas.
- Validación: build correcto, TypeScript sin errores, 37/37 pruebas aprobadas y
  lint sin errores; permanecen diez avisos no bloqueantes de imágenes HTML ya
  conocidas.

## Ingesta viva reversible, avisos y dominio corporativo

Implementado el 11/08/2026; pendiente de la publicación final y del cambio DNS
en Nominalia.

- `POST /api/files` conserva primero el original privado en R2 y después
  confirma su expediente en D1 antes de interpretarlo. CSV/JSON con contrato
  vivo se procesan de forma determinista. PDF, XLS/XLSX, PPT/PPTX, DOC/DOCX e
  imágenes usan Responses API con salida JSON Schema estricta sólo si existe
  `OPENAI_API_KEY`. DWG, MPP y ZIP se archivan pero no se interpretan.
- La publicación automática exige claves del contrato vivo, corte, área
  coherente, permisos del usuario, valores acotados y confianza alta. Un miembro
  solo puede auto-publicar su área; Finanzas continúa bloqueada sin
  `financeAccess`. Las cargas dudosas se conservan como propuestas sin inventar
  cifras.
- Cada contribución publicada permanece en `live_data_history`. Eliminar un
  archivo es una baja lógica reversible: se excluye su contribución, se vuelve a
  materializar el último valor procedente de otro archivo activo y, si no existe,
  se recupera el valor base del frontend. Restaurar aplica la operación inversa.
  El original R2, propuestas y trazabilidad nunca se destruyen.
- La app consulta datos y notificaciones cada cinco segundos; para archivos usa
  un feed paginado de cambios, no un listado histórico completo. Las
  revisiones, cargas, bajas/restauraciones, revisiones documentales, acciones,
  usuarios, indicadores, proveedores y fotos de perfil producen eventos
  persistentes. `/api/presence` registra cada sesión activa y avisa a todos los
  usuarios autorizados cuando una persona se conecta, sin exponer contenido
  financiero.
- Web Push usa suscripciones por dispositivo y VAPID; las variables
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` están guardadas en
  Sites (revisión de entorno 5). Cada usuario debe aceptar las notificaciones en
  su móvil, tablet u ordenador. El Service Worker abre únicamente rutas del
  mismo origen y el enlace profundo marca el aviso como leído.
- `notification_events` funciona como outbox durable y
  `notification_deliveries` conserva un estado independiente por dispositivo.
  La aplicación revalida usuario, estado y permiso financiero en cada intento;
  los reintentos pendientes no bloquean avisos nuevos. El sondeo de la campana
  actúa como relay durable y cada mutación intenta además iniciar el reparto en
  segundo plano.
- La publicación y el ciclo eliminar/restaurar confirman en un único batch D1
  el estado del archivo, la caché, historial, actividad, revisión publicada y
  evento de notificación. Las propuestas documentales usan generaciones: una
  preparación incompleta nunca sustituye al conjunto activo.
- Las operaciones masivas se mantienen set-based y dentro de los límites de
  D1: una publicación admite como máximo 250 cambios, los batches atómicos se
  agrupan en un número acotado de sentencias y los listados nunca hacen una
  consulta por fila. La migración vigente más reciente es la `0016`.
- La extracción IA utiliza `OPENAI_API_KEY` en Cloudflare. La ingesta
  determinista continúa funcionando sin IA y los formatos libres se escalan al
  modelo configurado cuando corresponde.

## Reversión de autoridad de la Curva S y bug de escala de extracción

Implementado y publicado el 13/08/2026 en Cloudflare Workers.

- El usuario decidió, tras plantear la disyuntiva explícitamente, que el
  avance físico global (`projectSnapshot.overallProgress`) debe seguir el
  último "Ejecutado Real" que declare el Excel maestro en `monthlyPlan`
  (Curva S) — es el control real que usa el equipo de obra —, no el
  promedio calculado apartamento a apartamento. El cálculo por apartamento
  se conserva como métrica de apoyo en el nuevo campo
  `projectSnapshot.apartmentAverageProgress`; no se borra, sigue siendo la
  fuente de las fichas por unidad (`unitOverallProgress`, sin cambios).
- `lib/spatial-live-data.ts`: `materializeSpatialLiveData()` ahora
  materializa `monthlyPlan` primero y deriva `overallProgress` de su último
  `actual` no nulo, con `apartmentAverageProgress` como campo aparte y
  `deviationPoints` recalculado sobre el nuevo `overallProgress`.
  `syncMonthlyPlanActual()` (hacía el cálculo inverso: forzaba el último
  `actual` de `monthlyPlan` a igualar el promedio por apartamento) se
  eliminó por quedar obsoleta con el cambio de dirección.
- Mismo cambio replicado en el espejo cliente
  (`synchronizeSpatialSummary()`, `app/dashboard-client.tsx`) y en los cuatro
  puntos donde el servidor recalculaba esto (`app/api/agent/route.ts` ×2,
  `app/api/control-room/route.ts` ×2). `projectSnapshot.plannedProgress` (el
  KPI operativo) no se tocó: sigue siendo un valor separado y
  deliberadamente no conciliado con el `planned` propio de la Curva S.
- Nueva nota junto a la Curva S ("Fuente del avance físico global") explica
  el cambio y muestra ambos valores (Excel vs. promedio por apartamento) con
  su procedencia.
- Bug de escala encontrado y corregido en la extracción por IA:
  `lib/ai-document-extraction.ts` no indicaba la escala esperada para
  porcentajes, así que un "22,71%" del Excel se extraía como fracción
  `0.2271` (o `0.002271` en un primer intento, un error compuesto). Se añadió
  una regla explícita en el prompt para todo campo de porcentaje/avance
  (incluye `monthlyPlan.planned`/`monthlyPlan.actual`).
- Bug más profundo encontrado en `lib/live-data-contract.ts`:
  `matchesContract()` comparaba cada posición de un array contra la misma
  posición del array ya publicado; como `monthlyPlan[13].actual` (julio)
  valía `null` en el valor vigente, cualquier intento de convertirlo en un
  número real quedaba rechazado por "tipo o estructura no coincide", sin
  importar la escala. Esto habría bloqueado cualquier actualización futura de
  la Curva S, no solo la de julio. Corregido generalizando la comparación:
  para arrays de objetos ahora se construye una plantilla fusionada por
  campo (`mergedArrayTemplate`), que acepta `null` o el tipo real cuando el
  campo es `null` en algunas filas del valor vigente y numérico en otras
  (marcador `NullableTemplate`, interno a la función), sin relajar ninguna
  otra validación de tipo, rango o identidad.
- El 22,71% real de julio de 2026 quedó publicado en producción (revisión 33
  de datos vivos), extraído de nuevo desde
  `01 - GRAFICOS ARAYA FASE II COMPLETO MODIFICADO JULIO.xls` con el prompt ya
  corregido. Se corrigieron a mano los meses posteriores a julio, que
  llegaban como `actual: 0` en vez de `null` (artefacto de fórmula del
  Excel, no un cero real), antes de aprobar la propuesta.
- El expediente antiguo con la extracción mal escalada (id de archivo
  `d8167525-4849-4c1d-bc06-c41cb63f18ca`) quedó **rechazado** a propósito
  para que nadie lo apruebe por error desde la bandeja de revisión y
  corrompa la Curva S con valores 100 veces más pequeños de lo real.
- Validación: `npx tsc --noEmit -p .`, `npm run build` y sesión real de
  Playwright contra producción confirmando 22,71% visible en el Resumen, la
  Curva S y la matriz de gobernanza del dato ("Datos gobernados"), sin
  errores de consola tras varios ciclos de refresco.

## Filtración de datos financieros al bundle público del cliente (corregida)

Encontrado y corregido el 13/08/2026 al arreglar la suite de pruebas
existente, que llevaba tiempo detectándolo.

- `app/dashboard-client.tsx` (el código que se envía al navegador de
  cualquier usuario, tenga o no permiso financiero) importaba directamente
  diez funciones `liveX(...)` desde los mismos módulos que declaran en
  código las cifras financieras reales (`app/june-report-data.ts`,
  `app/antonely-finance-data.ts`, `app/procurement-data.ts`,
  `app/reprogrammed-flow-data.ts`, `app/fiduciary-statements-data.ts`,
  `app/data-governance.ts`). Importar la función arrastraba el módulo
  completo al bundle, incluidas sus constantes con importes reales —
  visible para cualquiera con las herramientas de desarrollador del
  navegador, sin necesidad de `financeAccess`.
- Corregido moviendo las diez funciones puras a un módulo nuevo y aislado,
  `lib/live-derivations.ts`, que no exporta ningún dato sensible (solo
  funciones genéricas que reciben sus valores por parámetro). El cliente
  ahora importa exclusivamente desde ahí; los módulos de datos originales
  conservan solo sus constantes, y las rutas de servidor
  (`app/api/agent/route.ts`, `app/api/control-room/route.ts`) importan las
  mismas funciones desde el módulo nuevo.
- Verificado: las cifras centinela (presupuesto, balance fiduciario, flujo
  de proveedores, etc.) ya no aparecen en `dist/client` ni en `.next/static`.
- Regla para el futuro: ningún archivo que `app/dashboard-client.tsx`
  importe directamente puede declarar datos financieros reales en el mismo
  módulo. Las funciones de re-sincronización en vivo (`liveX`) deben vivir
  en `lib/live-derivations.ts` o en un módulo igualmente aislado.

## Notificación de "posible sección nueva" pasa a estar en manos de un trigger

Corregido el 13/08/2026.

- `app/api/files/route.ts` llamaba a `emitNotification()` directamente al
  detectar campos sin encaje conocido (`unmappedCandidates`), rompiendo el
  patrón establecido de que las rutas API solo escriben en D1 y programan
  `scheduleNotificationDispatch()` — la notificación en sí la genera siempre
  un trigger de base de datos, para que nunca se dupliquen avisos entre el
  trigger y la ruta. De paso, ese bloque tenía una variable fuera de alcance
  (`candidate.name`, referenciada tras el `.map()` que la declaraba) que
  habría lanzado un error en tiempo de ejecución si llegaba a ejecutarse.
- Migración nueva `drizzle/0020_notify_unmapped_field_candidate_created.sql`:
  trigger `notify_unmapped_field_candidate_created` sobre
  `unmapped_field_candidates`, ya aplicada en D1 remoto. Se quitó la llamada
  directa y el import ya no usado de `emitNotification` en
  `app/api/files/route.ts`.

## Doce pruebas obsoletas corregidas

Corregido el 13/08/2026, a petición explícita del usuario: "hay q arreglar
todas las pruebas que ya fallaban, debe quedar todo arreglado y corregido".

- Diez de las doce comprobaban texto literal desactualizado de cambios
  legítimos ya hechos (esta sesión o sesiones previas sin commitear), no
  bugs reales: versión del service worker (`v5` → `v6`, ya documentada
  arriba en "Archivo documental"), versión del prompt del agente
  (`araya-asistente-v9-sala-operativa` →
  `araya-asistente-v10-publicacion-abierta`), cabecera financiera ahora
  dinámica en vez de "JUNIO 2026" fijo, contadores de Antonely ahora en vivo
  (`{antonelyDetailTotals.costAccountCount}` en vez de la cifra "29" fija),
  refactor de `visualUnitStatus` para usar el promedio de disciplinas en vez
  de `unit.progress`, refactor del publicado parcial automático
  (`autoPublishable`/`liveValues` en vez de la forma anterior) y el "Al
  corte" dinámico de la Curva S. Se actualizaron las aserciones de las
  pruebas para reflejar el comportamiento correcto vigente; no se revirtió
  ningún cambio de producto para hacerlas pasar.
- Las otras dos corresponden a los dos arreglos reales descritos arriba (la
  filtración al bundle del cliente y el trigger de notificaciones).
- Validación final: `node --test tests/*.mjs` → 97/97 pruebas aprobadas.

## Plan operativo y avance físico ahora comparan siempre el mismo mes

Corregido el 13/08/2026. El usuario reportó, con captura del Resumen
ejecutivo, que el círculo de avance físico marcaba 22% y la tarjeta "Plan
operativo" marcaba 21%, y pidió arreglarlo de forma definitiva ("que siempre
está dando problemas y no cuadran los datos").

- Causa real: tras la reversión de autoridad de la Curva S (ver más arriba),
  `projectSnapshot.overallProgress` avanza con el último "Ejecutado Real"
  publicado en `monthlyPlan` (ya en julio, 22,71%), pero
  `projectSnapshot.plannedProgress` (la tarjeta "Plan operativo", el KPI)
  seguía siendo un campo estático congelado en el valor de junio (21,24%).
  El tablero comparaba el ejecutado de un mes contra el plan de otro mes
  distinto — no era un error de sincronización, era una comparación entre
  dos periodos diferentes disfrazada de inconsistencia.
- Corregido en la misma fuente única de siempre: tanto
  `lib/spatial-live-data.ts` (`materializeSpatialLiveData`) como el espejo
  cliente (`synchronizeSpatialSummary`, `app/dashboard-client.tsx`) ahora
  leen `planned` y `actual` de la **misma fila** de `monthlyPlan` (la última
  con `actual` no nulo), en vez de leer `actual` de esa fila y `planned` de
  un campo estático aparte. `deviationPoints` se recalcula sobre ese mismo
  par, así que la brecha mostrada también quedó corregida (pasó de +1,47pp,
  que comparaba julio contra el plan de junio, a -3,9pp, que compara julio
  contra su propio plan).
- La nota "Dos fuentes de 'plan', sin conciliar todavía" de la Curva S se
  volvió inalcanzable por construcción (planned y plannedProgress ahora
  siempre son el mismo número) y se eliminó junto con su condición muerta.
- Como todos los usos de `plannedProgress` en el resto de la app (matriz de
  gobernanza del dato, respuestas del agente, texto del Resumen) leen ese
  mismo campo de `projectSnapshot`, se corrigieron todos a la vez sin tocar
  cada sitio de uso por separado — el mismo patrón ya aplicado varias veces
  en esta sesión.
- Verificado en producción: `GET /api/control-room` → `planning.kpiPlan` y
  `planning.curvePlanAtCutoff` ahora son idénticos (26,61%); la tarjeta
  "Plan operativo" del Resumen ejecutivo muestra "26,61% · -3,9 pp de brecha
  física"; `npx tsc --noEmit`, `npm run build` y 97/97 pruebas en verde.

## Auditoría completa de "cifras congeladas" y computedView

Implementado y publicado el 13/08/2026. El usuario pidió explícitamente un
plan definitivo, no otro parche puntual: "siempre está dando problemas y no
cuadran los datos [...] dime como podemos arreglar todo de una vez y de
forma definitiva", después de reportar que el círculo de avance físico y la
tarjeta "Plan operativo" mostraban meses distintos (arreglado en la sección
anterior). Esto es la respuesta de fondo, no otro parche más.

**Diagnóstico**: el patrón de bug no es un caso aislado. El dashboard
guarda cada resumen/contador (antonelyDetailTotals, plannedProgress,
supplierContactAudit, dataGovernanceSummary...) como una **copia
independiente** de los datos "en bruto" de los que depende, y esa copia solo
se actualiza si alguien, al programar esa pantalla, se acuerda de escribir
una función `liveX()` y conectarla a mano en `synchronizeSpatialSummary()`.
Cada pantalla nueva con un resumen es una nueva oportunidad de olvidar ese
paso. Una auditoría completa de los ~50 campos vivos de
`app/dashboard-client.tsx` (comparando cada uno contra `liveDataTargets` y
`LIVE_DATA_ROOTS`) encontró tres instancias más del mismo bug, ya reales en
producción, no hipotéticas:

1. `supplierContactAudit` (tarjetas de Proveedores: relaciones con crédito,
   límite de crédito, datos por completar) — sin ninguna sincronización.
2. `dataGovernanceSummary` ("X conciliados · Y separados · Z observados" en
   Centro de datos) — sin ninguna sincronización.
3. `dataAuthorityMatrix` — su texto de decisión/status en vivo solo se
   calculaba dentro del render de `SourcesView`, nunca se escribía de vuelta
   al estado compartido; cualquier otra pantalla que lo leyera habría visto
   la versión estática.
4. `supplierDirectory` (el directorio completo de 67 proveedores) no estaba
   registrado como raíz viva en absoluto — ni con revisión manual había
   forma de actualizarlo desde un archivo nuevo.

**Arreglo de hoy** (mismo patrón ya usado en toda la sesión): se registró
`supplierDirectory` en `LIVE_DATA_ROOTS`/`liveDataTargets`; se añadieron
`liveSupplierContactAudit()` y `liveDataGovernanceSummary()` en
`lib/live-derivations.ts`; `dataAuthorityMatrix` ahora se reasigna dentro de
`synchronizeSpatialSummary()` (después de que overallProgress/plannedProgress
queden al día), y `SourcesView` simplemente filtra esa versión ya viva en vez
de recalcularla por su cuenta. `ifcComplianceGroups` se revisó y se dejó tal
cual: es texto contractual fijo (compromisos IFC), no un dato que deba
actualizarse con cargas nuevas.

**El cambio de fondo — `computedView()`**: en vez de seguir dependiendo de
que cada resumen tenga su `liveX()` recordado a mano, `antonelyDetailTotals`,
`typeABudgetSummary`, `juneDeviationSummary`, `procurementAudit`,
`dataGovernanceSummary` y `supplierContactAudit` — los seis resúmenes que son
objetos derivados por completo, sin campos hermanos propios — se
construyen ahora con `lib/computed-view.ts`, un `Proxy` que ejecuta la
función `liveX()` correspondiente en **cada lectura** de un campo, en vez de
guardar una copia que haya que resincronizar. No hay copia que se pueda
quedar congelada porque no existe copia: es matemáticamente imposible que
uno de estos seis vuelva a mostrar un número de otra fecha, sin importar
qué pantalla nueva se añada en el futuro ni si alguien olvida conectarla.
`projectSnapshot` (overallProgress/plannedProgress), `juneReport.finance` y
`fiduciaryStatementSummary.balance` se quedaron en el patrón de reasignación
explícita de siempre porque tienen muchos campos hermanos que no se derivan
de nada — envolver el objeto entero habría sido más arriesgado que el
beneficio, así que ahí la garantía sigue siendo "revisado y probado", no
"imposible que falle".

**Trampa real encontrada al aplicar esto**: incluir un objeto `computedView`
en `liveDataTargets` lo rompe. `applyLiveValuesToTargets`
(`lib/live-data.ts`) clona el valor de un target la primera vez que lo ve
(`JSON.parse(JSON.stringify(target))`, que sí lee a través de un `Proxy`) y
cachea ese clon para siempre en un `WeakMap` como "línea base" — así que un
`computedView` incluido ahí quedaría congelado en su primer valor calculado,
un bug distinto pero de la misma familia. `antonelyDetailTotals` se sacó de
`liveDataTargets` por este motivo exacto (los otros cinco nunca habían
estado ahí).

**Red de seguridad nueva**: `tests/live-sync-consistency.test.mjs` verifica
por patrón de código que (a) los seis resúmenes siguen envueltos en
`computedView(`, (b) ninguno de los seis vuelve a aparecer en
`liveDataTargets`, (c) `dataAuthorityMatrix` se reasigna dentro de
`synchronizeSpatialSummary` y no solo dentro de `SourcesView`, y (d)
`overallProgress`/`plannedProgress` siguen leyéndose de la misma entrada de
`monthlyPlan` tanto en el servidor como en el cliente. Si alguien reintroduce
cualquiera de estos cuatro bugs, la prueba falla antes del despliegue en vez
de que lo note alguien en República Dominicana.

**Al añadir un resumen derivado nuevo en el futuro**: preferir
`computedView(base, () => liveX(base, ...))` sobre el patrón antiguo de
reasignación manual siempre que el campo sea un objeto derivado por
completo (sin campos hermanos propios) y no necesite recibir una publicación
directa. Si se usa el patrón antiguo, añadir su comprobación a
`tests/live-sync-consistency.test.mjs`.

Verificado en producción con sesión real de Playwright: `dataGovernanceSummary`
mostrando "7 conciliados · 2 separados · 2 observados" (antes, un conteo
fijo), `supplierContactAudit` mostrando "Directorio validado 67",
"Relaciones con crédito 16 · USD 0,70 M" (antes, sin ninguna sincronización),
cero errores de consola tras varios ciclos de sondeo; `npx tsc --noEmit`,
`npm run build` y 100/100 pruebas en verde.

## Guía corporativa corregida e instalación PWA completa en las 4 plataformas

Implementado y publicado el 13/08/2026, como parte del pedido del usuario de
dejar la aplicación "preparada para instalar en móvil Apple, Android y
tablets, y también como aplicación en ordenador Windows y Mac", además de un
sitio donde el personal aprenda a usar el programa.

**Bug crítico encontrado y corregido**: `scripts/generate_staff_guide_pdf.py`
tenía configurado el antiguo dominio corporativo, ya no vigente (ver "Aviso
importante: plataforma de despliegue vigente"). Esa constante alimenta los 3
códigos QR/enlaces del PDF (portada,
instalación móvil, instalación escritorio). Cualquiera que escaneara el QR
llegaba a un dominio que ya no sirve esta aplicación. Corregido a
`https://araya-centro-control.grupobricket.workers.dev/`, la URL real del
Worker. La guía también se actualizó para describir los 4 tipos de informe
(general/obra × finanzas/ventas) en la tarjeta "Crear informes" en vez de
solo semana/mes.

**Iconos PWA insuficientes**: `manifest.webmanifest` sólo tenía un icono de
225×225 marcado `"any maskable"` a la vez — insuficiente para los criterios
de instalación de Android/Chrome (piden ≥192px y ≥512px) y, además, un icono
"any" no debería reutilizarse como "maskable" porque un mismo PNG sin margen
de seguridad se recorta mal bajo las máscaras adaptativas (círculo/squircle).
`scripts/generate_pwa_icons.py` (nuevo, usa Pillow) genera desde el logo
existente `bricket-mark-192.png`, `bricket-mark-512.png` y
`bricket-mark-512-maskable.png` (este último con 20% de margen de contenido
sobre fondo `#EC5D31` para respetar la zona segura). `manifest.webmanifest`,
`app/layout.tsx` (metadata `icons`/`apple`) y `public/sw.js`
(`STATIC_ASSETS`, caché `v6` → `v7`) ya referencian los tres tamaños nuevos
junto al icono original.

**Nuevo punto de entrada de la guía**: la sección `Usuarios y accesos` de
escritorio (`UsersAdminView`) ahora tiene una tarjeta "Guía de uso para el
personal" con botón "Abrir guía", además de los accesos ya existentes en
`Centro de datos` y `Más → Guía de uso` en móvil (ver "Apertura documental y
guía corporativa de la versión 41"). El PDF servido en
`historical/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf`
se regeneró con la URL corregida.

**Estado real de instalación por plataforma**:

- Android / Chrome / Edge (móvil o escritorio): instalación nativa vía el
  banner del navegador o el botón "Instalar aplicación" (menú `Más` en
  móvil), que usa el `beforeinstallprompt` ya cableado en
  `dashboard-client.tsx`. Con los iconos corregidos, ahora cumple todos los
  criterios de instalabilidad de Chrome.
- Windows / Mac con Chrome o Edge: instalable como app de escritorio desde el
  icono de instalación de la barra de direcciones (el navegador lo ofrece
  solo porque el manifiesto y los iconos ya son válidos). No existe un botón
  equivalente dentro de la propia aplicación para escritorio.
- iOS / iPadOS Safari: Apple no dispara `beforeinstallprompt`; la instalación
  es manual vía `Compartir → Añadir a pantalla de inicio`. No hay aviso
  in-app que explique esto en iOS.
- Para Windows/Mac e iOS, la única guía disponible hoy es la corporativa en
  PDF (ya corregida). **Decisión de alcance tomada esta sesión, no
  confirmada con el usuario todavía**: no se construyó un botón de
  instalación dedicado para escritorio ni un aviso in-app específico para
  iOS, para no duplicar lo que el PDF ya explica correctamente. Si el
  usuario pide más adelante un acceso directo dentro de la propia app para
  esos dos casos, es la siguiente extensión natural.

**Validación**: `npm run deploy` completo en verde — `tsc --noEmit`, build,
100/100 pruebas (incluye `tests/rendered-html.test.mjs` actualizado a
`bricket-control-shell-v7`), `wrangler deploy` y el Worker respondiendo en
producción. Confirmado manualmente contra
`https://araya-centro-control.grupobricket.workers.dev`: `manifest.webmanifest`
sirve los 4 iconos, `sw.js` en `v7`, los tres PNG nuevos devuelven 200, y el
PDF de la guía sigue protegido por autenticación igual que el resto de
`/data-center/` (no es un fallo: es el mismo comportamiento que toda la
documentación privada).

## Los 23 documentos fijos del Centro de Control nunca llegaron a R2 (404 en producción)

Encontrado y corregido el 13/08/2026, al intentar abrir la guía corporativa
recién corregida (sección anterior) y recibir "No se pudo representar el
PDF... Unexpected server response (404)". La causa no era la guía en
particular: es un hueco estructural que afectaba a los 23 documentos fijos
del Centro de Control por igual, probablemente desde que cada uno se creó.

**Causa raíz**: `app/data-center/[...path]/route.ts` es la única ruta que
sirve estos archivos, y `wrangler.deploy.jsonc` la marca
`run_worker_first: ["/data-center/*"]` — esas peticiones nunca las resuelve
la capa de activos estáticos de Cloudflare (`dist/client`, donde sí vive todo
lo que hay en `public/`). Siempre pasan por el Worker, que busca el objeto en
el bucket R2 `FILES` bajo la clave `historical${pathname}`. Colocar un
archivo en `public/data-center/...` lo deja perfectamente presente en el
repo, en `dist/client` y en el build — y por eso `npm run deploy` pasaba en
verde sin avisar nada — pero es completamente invisible para esta ruta si
nadie lo sube también a R2 con ese comando aparte. Nadie lo había hecho para
ninguno de los 23 documentos: ni la guía, ni los cinco archivos fuente de
julio (`informe-analisis-ifc-2026-07-29.pdf`,
`contactos-proveedores-araya.xls`, `araya-flujo-i-reprogramado.xlsx`,
`comparativo-presupuesto-edificio-tipo-a.xls`,
`desviacion-mensual-junio-2026.xlsx`), ni los cuatro balances del fideicomiso
de junio, ni los trece registrados como fuente en `app/demo-data.ts` (pese al
nombre del archivo, es el registro real de fuentes de ARAYA — DWG de
implantación, MPP del cronograma maestro, informes y Excel de junio — no
contenido de un proyecto de demostración) y `app/antonely-payable-invoices.ts`.
Confirmado uno por uno con `wrangler r2 object get`: los 23 devolvían
"The specified key does not exist."

**Arreglo inmediato**: los 23 archivos ya se subieron a R2 con
`wrangler r2 object put` bajo su clave `historical/data-center/...`
correspondiente, verificados con descarga y comparación de tamaño en bytes
contra el original local.

**Arreglo de fondo**: `scripts/sync-historical-documents.mjs` (nuevo) recorre
recursivamente todo el directorio de documentos fijos (hoy
`historical/data-center/`; en su versión original `public/data-center/`, ver
la sección de resolución del 14/08/2026) y sube cada archivo a R2 bajo su
clave `historical/data-center/<ruta relativa>`, con el tipo de contenido
resuelto por extensión (debe reflejar `canonicalMimeByExtension` en
`route.ts`). No depende de una lista a mano — cualquier archivo nuevo que se
coloque ahí se sincroniza solo en el siguiente despliegue. `scripts/deploy.mjs`
lo ejecuta como paso obligatorio después de `wrangler deploy`, así que ya no
es un comando aparte que alguien tenga que acordarse de correr.

**Red de seguridad nueva**: `tests/live-sync-consistency.test.mjs` añade una
prueba que extrae todas las rutas `/data-center/...` referenciadas en
`app/dashboard-client.tsx`, `app/demo-data.ts` y
`app/antonely-payable-invoices.ts`, y falla si alguna no tiene un archivo
correspondiente en el directorio de documentos fijos; además confirma por patrón que el
script de sincronización sigue recorriendo el directorio completo (no una
lista a mano) y que `deploy.mjs` sigue invocándolo. Esto no prueba que el
archivo llegue a R2 en cada entorno, pero si alguien añade un enlace a un
documento que no existe en el repo, la prueba lo detiene antes de desplegar —
y mientras el paso del pipeline exista, todo lo que sí está en el repo queda
sincronizado en cada despliegue sin intervención manual.

**Al añadir un documento fijo nuevo en el futuro**: basta con colocarlo bajo
`historical/data-center/...` (NUNCA bajo `public/data-center/` — ver la
resolución del 14/08/2026 más abajo; una prueba lo impide) y enlazarlo desde
la app con la ruta `/data-center/...` equivalente — el siguiente
`npm run deploy` lo sube a R2 solo. No hace falta tocar
`scripts/sync-historical-documents.mjs`.

Verificado con `wrangler r2 object get --file` sobre una muestra (el DWG de
18,4 MB, un balance del fideicomiso, el informe IFC) comparando bytes
descargados contra el archivo local: coinciden exactamente.

## `/data-center/[...path]` devolvía 404 en producción — RESUELTO el 14/08/2026 (ver sección siguiente)

Esta sección conserva el diagnóstico del 13/08 tal como quedó al cerrar
aquella sesión. La causa raíz se encontró y corrigió al día siguiente; la
sección siguiente documenta la resolución. La hipótesis nº2 de aquí abajo
era esencialmente correcta, con un matiz: la decisión no la toma Cloudflare
sino el propio router de vinext, y no consulta `env.ASSETS` — consulta un
manifiesto de rutas públicas generado en build.

La sección anterior (los 23 documentos subidos a
R2) es un arreglo real y necesario, pero no basta: con sesión autenticada
real, **cualquier** URL `/data-center/...` — la guía, un informe, un balance,
todos probados — sigue devolviendo 404 en producción, aunque el objeto
correspondiente ya existe en R2 byte a byte (confirmado con
`wrangler r2 object get`). Todos los botones "Abrir guía / Abrir informe /
Abrir archivo fuente" del Centro de Control siguen mostrando el error que
reportó el usuario.

**Diagnóstico hasta donde se llegó** (con una verificación autenticada real
añadida temporalmente a `deploy.mjs`, con sesión de un administrador de
verdad, no simulada):

- El 404 lleva las cabeceras propias de la app (`Cache-Control: private,
  no-store`, `X-Robots-Tag`, `Vary: *`) — no es el 404 en blanco de la capa
  de activos estáticos de Cloudflare.
- Pero el cuerpo de la respuesta está completamente vacío
  (`content-length: 0`). Los dos `return errorResponse("Archivo no
  encontrado.", 404)` de `app/data-center/[...path]/route.ts` SIEMPRE
  producen cuerpo con texto — así que ninguno de los dos se está ejecutando.
- Se añadió temporalmente un `console.log` y luego un `try/catch` alrededor
  de `bucket.head()` con el error volcado al propio cuerpo de la respuesta;
  ninguno de los dos apareció nunca (ni en `wrangler tail --format
  pretty/json`, ni en el cuerpo HTTP). `wrangler tail` marca estas peticiones
  como `outcome: "ok"`, sin excepciones.
- Conclusión: la función `GET` de `route.ts` probablemente **nunca llega a
  ejecutarse** para esta ruta en este despliegue concreto (vinext + Cloudflare
  Workers Assets con `run_worker_first`). `proxy.ts` (middleware al estilo
  Next.js, `matcher: ["/data-center/:path*"]`) sí se ejecuta —sus propias
  cabeceras (`Vary: *` sólo aparece en su rama `NextResponse.next()` de
  éxito) llegan hasta la respuesta final— pero el traspaso de
  `NextResponse.next()` hacia el `route.ts` con segmento catch-all
  `[...path]` parece romperse silenciosamente en algún punto entre el
  middleware y el handler, devolviendo un 404 vacío en vez de invocar el
  código real.

**Hipótesis nº1 — PROBADA Y DESCARTADA (13/08/2026, más tarde el mismo día)**:
quitar `/data-center/:path*` del `matcher` de `proxy.ts` (con `matcher: []`,
confirmado por lectura de
`node_modules/vinext/dist/server/middleware-matcher.js` que eso desactiva el
middleware por completo para cualquier ruta). `route.ts` ya hace su propia
comprobación completa de identidad y acceso financiero (`requireApiUser()` +
`requiresFinanceDocumentAccess()`, mismo `SESSION_COOKIE` que `proxy.ts`), así
que quitar el matcher no reduce la protección. Se desplegó y se probó con
sesión real autenticada (login real vía `/api/auth/login` en GitHub Actions):
**la guía siguió devolviendo 404**. Esto descarta el mecanismo exacto
propuesto (el traspaso `x-middleware-next` de `NextResponse.next()`) como
causa única — con el middleware completamente fuera de la ecuación, algo más
sigue produciendo el mismo 404 vacío. Revertido inmediatamente tras
confirmarlo en contra.

**Hipótesis nº2 — siguiente a probar, todavía sin intentar**: `public/
.assetsignore` excluye explícitamente `data-center/**` de los activos
estáticos que Cloudflare sirve (a propósito — si no, cualquiera podría leer
los documentos sin autenticarse, sin pasar por R2 ni por `route.ts`). Eso
significa que `env.ASSETS.fetch()` para cualquier `/data-center/...` siempre
devuelve 404 dentro del propio Worker, por diseño. Sospecha: en algún punto
del pipeline de vinext/Cloudflare (dentro del propio Worker, no en el borde
de Cloudflare — `run_worker_first` ya fuerza que la petición llegue al
Worker) puede existir una comprobación "¿existe como activo conocido?" que,
al recibir ese 404 esperado de `env.ASSETS`, lo trata como respuesta final en
vez de seguir hacia el enrutado de la app (middleware + `route.ts`). Esto
encajaría con el 404 vacío observado. No se ha verificado leyendo el código
fuente de vinext que gestiona esa ruta exacta (el worker principal,
`dist/server/index.js`, o el paquete `@cloudflare/vite-plugin`) — es la
siguiente pista a seguir, no una causa confirmada.

**Por qué se revirtieron ambos intentos sin resolverlo del todo**: la
investigación (varios despliegues manuales de diagnóstico, más de diez
ejecuciones de GitHub Actions en pocos minutos) generó una cadena visible de
fallos en GitHub que preocupó al usuario ("da error en github todo el rato",
"sigue fallando"). Tras la primera ronda, el usuario pidió explícitamente
eliminar todo lo relativo al botón/verificación de la guía y dejarlo como
antes; se probó una segunda hipótesis con permiso explícito del usuario
("intentar arreglarlo sin modificar nada del programa" — interpretado como
"sin añadir funciones nuevas", ya que la propia oficina de República
Dominicana iba a usar la aplicación ese mismo día) pero, al confirmarse en
contra con una prueba real, se priorizó la estabilidad para el uso real de
hoy sobre seguir experimentando en caliente en producción. Se revirtió en
ambas rondas:

- El botón "Guía de uso" nuevo en la cabecera principal (junto al selector de
  moneda) — eliminado.
- La comprobación autenticada de la guía añadida a `deploy.mjs` — eliminada
  (no podía pasar mientras el bug siga abierto, y bloqueaba cada despliegue).
- El cambio del `matcher` de `proxy.ts` — revertido a
  `matcher: ["/data-center/:path*"]` (probado y descartado, ver hipótesis
  nº1 arriba).
- Todo el código de diagnóstico temporal en `route.ts`, `proxy.ts` y
  `deploy.mjs`.

**Lo que NO se tocó y sigue igual que antes de esta sesión**: los accesos
existentes a la guía (`Centro de datos`, `Usuarios y accesos`, `Más` en
móvil) y el resto de enlaces `/data-center/...` de la app. Siguen apuntando
a las mismas URLs, que siguen sin funcionar — este bug es anterior a esta
sesión, no algo que esta sesión haya roto.

**Trampa real encontrada al revertir con `git checkout <commit> -- <archivo>`
en Windows**: ese comando aplica el filtro `core.autocrlf` de Git al
working tree (a diferencia de editar con una herramienta que escribe LF
directo), dejando el archivo en disco con CRLF aunque el contenido
"lógico" sea idéntico. Las pruebas de `tests/rendered-html.test.mjs` que
extraen un bloque de `dashboard-client.tsx` con una regex que exige `\n\n`
consecutivos fallan con ese archivo (el `\r` de por medio rompe el patrón),
aunque `git diff` no muestre ningún cambio. El commit en sí no se corrompió
(GitHub Actions corre en Linux con `autocrlf` distinto y nunca lo sufrió),
pero las pruebas en local sí fallaban hasta convertir el working tree de
vuelta a LF a mano. Si se vuelve a usar `git checkout <ref> -- <archivo>`
para revertir algo en este repo desde Windows, conviene normalizar los
saltos de línea del archivo justo después, antes de confiar en una prueba
local en rojo/verde.

**Para retomar esto con calma más adelante**: la hipótesis del matcher de
`proxy.ts` ya está descartada (arriba). Seguir con la hipótesis nº2
(`.assetsignore` + fallback de activos estáticos dentro del propio Worker) —
leer `dist/server/index.js` generado y el código de `@cloudflare/vite-plugin`
que decide entre `env.ASSETS.fetch()` y el enrutado de la app, en vez de
seguir probando cambios a ciegas en producción. Si se encuentra y arregla la
causa real, restaurar el botón de la cabecera y la verificación en
`deploy.mjs` que se revirtieron aquí.

## Resolución del 404 de `/data-center/[...path]` (14/08/2026)

Causa raíz encontrada por lectura del código de vinext 0.0.50 (sin
experimentos en producción), corregida y validada en local. La cadena
completa del bug:

1. **vinext registra todo `public/` como rutas de archivo estático que ganan
   a las rutas dinámicas de la app** (fiel al orden de resolución de
   Next.js: archivo público antes que ruta dinámica). En build,
   `scanPublicFileRoutes` (`vinext/dist/utils/public-routes.js`) recorre
   `public/` completo — **sin mirar `.assetsignore`** — y graba el resultado
   como un `Set` literal (`__publicFiles`) dentro de `dist/server/index.js`.
2. En cada petición, `resolvePublicFileRoute`
   (`vinext/dist/server/request-pipeline.js`) consulta ese Set **antes** del
   enrutado hacia `app/.../route.ts`. Como los 23 documentos vivían en
   `public/data-center/...`, toda URL `/data-center/...` coincidía y el
   handler devolvía una "señal de archivo estático" (cabecera interna
   `VINEXT_STATIC_FILE_HEADER`) — por eso `route.ts` **nunca se ejecutaba**
   y ningún log ni `try/catch` suyo aparecía jamás.
3. El entry del Worker (`app-router-entry.js` → `resolveStaticAssetSignal`
   en `worker-utils.js`) resuelve esa señal con `env.ASSETS.fetch()`. Pero
   `public/.assetsignore` excluye `data-center/**` de los activos
   desplegados (a propósito, para que nadie los lea sin autenticación), así
   que ASSETS devolvía 404 con cuerpo vacío, y `mergeHeaders` le fusionaba
   las cabeceras del middleware (`Vary: *`, `Cache-Control: private…`) —
   exactamente el 404 vacío "con cabeceras de la app" observado el 13/08.
   Esto también explica por qué desactivar el matcher de `proxy.ts`
   (hipótesis nº1) no cambió nada: el eclipse ocurre después del
   middleware, en la resolución de archivos públicos.

**Arreglo estructural**: los documentos privados no deben vivir bajo
`public/`. Se movieron los 23 con `git mv` de `public/data-center/` a
`historical/data-center/` (directorio nuevo del repo cuya ruta replica
exactamente la clave R2 `historical/data-center/<ruta>`; la URL pública
sigue siendo `/data-center/<ruta>` y no cambió ningún enlace de la app).
Con `public/data-center/` inexistente, el manifiesto `__publicFiles` del
build ya no contiene ninguna entrada `/data-center/...` (verificado en
`dist/server/index.js` tras `npm run build`), las peticiones llegan por fin
a `app/data-center/[...path]/route.ts` y este las sirve desde R2 — donde
los 23 objetos ya estaban desde el 13/08, byte a byte.

Cambios acompañantes:

- `scripts/sync-historical-documents.mjs`: `SOURCE_DIR` pasa a
  `historical/data-center/`; mismo recorrido recursivo y mismas claves R2.
- `tests/live-sync-consistency.test.mjs`: la comprobación de existencia usa
  `historical${ruta}` y una prueba nueva falla si `public/data-center/`
  vuelve a existir (recrearlo reintroduciría el eclipse: el archivo se
  serviría o bien como 404 vacío con `.assetsignore`, o bien **sin
  autenticación** sin él).
- `tests/rendered-html.test.mjs`: rutas de lectura actualizadas al
  directorio nuevo.
- `public/.assetsignore` conserva `data-center/**` como defensa en
  profundidad.

Validación local: `npx tsc --noEmit`, `npm run build`, 101/101 pruebas y
`git diff --check` en verde; manifiesto `__publicFiles` del bundle sin
entradas `/data-center/...` y `dist/client/` sin el directorio. Nota: hay 3
errores de `npm run lint` preexistentes en `app/dashboard-client.tsx`
(react/no-unescaped-entities ×2 y un setState-en-efecto), ajenos a este
cambio; el pipeline de despliegue no ejecuta lint, así que no bloquean.

**Desplegado y verificado el 14/08/2026**: el push a `main` (ejecución 23 de
`deploy.yml`) pasó la cadena completa en verde, incluida la verificación
autenticada real contra producción. Lo revertido el 13/08 quedó restaurado
el mismo día — ver "Restauración de la guía y su guarda de regresión" al
final de este documento.

## Mejoras de tiempo real (14/08/2026)

Cuatro mejoras pedidas por el usuario tras revisar el estado del Centro de
Control ("dame opciones para que la gente que lo usa lo pueda ver todo en
tiempo real"). Se implementaron en el orden que eligió: 4, 1, 3 y 7 de la
lista de opciones propuesta.

### 1. Sondeo condicional con ETag (304 sin cuerpo)

`lib/conditional-json.ts` calcula un ETag débil estable del payload —
excluyendo del hash los campos volátiles como `refreshedAt`, no del cuerpo —
y devuelve `304` sin cuerpo cuando el cliente reenvía el mismo
`If-None-Match`. Aplicado a `/api/live-data`, `/api/dashboard`,
`/api/control-room`, `/api/notifications` y `/api/payables`.

El payload se sigue calculando siempre: el `GET` de notificaciones actúa
además como relevo del outbox de push y no puede saltarse. Lo que se ahorra
es la transferencia del JSON íntegro en cada ciclo sin cambios, que es el
caso común; en móvil y tablet en obra eso reduce datos y batería.

En el cliente, `fetchWithEtag` (en `app/dashboard-client.tsx`) guarda el
ETag por endpoint. **Trampa a recordar**: `Response.ok` es `false` en un
304, así que cada llamante comprueba `status === 304` *antes* que su manejo
de error, o un 304 se interpretaría como fallo de red. Si live-data y
dashboard responden ambos 304, solo se refresca la cinta de conexión, sin
re-aplicar valores ni re-renderizar. Un cambio de rol o permiso altera el
hash (`currentUser` va en el payload), así que produce un 200 y la
detección de cambios de usuario sigue funcionando igual.

### 2. Avisos push de negocio

`lib/business-alerts.ts` deriva avisos del estado que los endpoints
sondeados acaban de calcular, sin consultas extra cuando no hay candidatos:

- Desviación física de 3 o más puntos bajo el plan operativo del mismo mes
  (`DEVIATION_ALERT_POINTS`), una vez por mes de corte.
- Acciones vencidas y aún abiertas, una vez por acción y fecha; audiencia
  `area:<área>`, degradada a `finance` en áreas protegidas (fail-closed).
- Facturas CxP con 2 meses o más de antigüedad
  (`PAYABLE_AGING_ALERT_INDEX`), agregado para audiencia financiera.

La emisión es idempotente por lotes (`emitMissingNotifications` en
`lib/notifications.ts`): una consulta resuelve qué avisos existen ya por
`(kind, subjectType, subjectId)` y solo inserta los que faltan, de modo que
un sondeo de 5 s puede invocarla en cada ciclo. **No hay índice único que lo
garantice en base de datos**: una carrera entre dos sondeos simultáneos
puede duplicar un aviso puntual. Es un coste aceptado a cambio de no exigir
otra migración remota; si algún día molesta, la solución es un índice único
sobre esa terna.

### 3. Modo TV/obra

Pantalla siempre encendida para la oficina de obra y la central: `/tv`, con
tres paneles en rotación cada 15 s (avance y KPIs, Curva S, acciones
vencidas), refresco cada 30 s con el mismo ETag condicional, y tipografía en
unidades de viewport para leerse a varios metros en 1080p o 4K.

- Acceso **sin sesión de usuario**: un administrador crea el enlace desde
  `Usuarios y accesos` → "Modo TV para obra y oficina". Así nadie teclea
  credenciales en un dispositivo compartido.
- `randomBytes(32)` genera el token; en D1 solo se guarda su hash SHA-256
  (mismo patrón que `user_sessions`). El enlace en claro se muestra **una
  sola vez** al crearlo — no hay forma de recuperarlo — y el cliente lo
  retira de la barra de direcciones tras guardarlo en `sessionStorage`.
- Caducidad de 90 días por defecto, máximo 20 pantallas activas, revocación
  inmediata.
- El contenido es deliberadamente **no financiero**, y la vía de datos es la
  misma que ve un usuario sin permiso financiero
  (`readEffectiveLiveData(false)`, `buildControlRoomBaseline(false, ...)`),
  nunca una copia paralela que pueda divergir: una pantalla en obra es
  semi-pública por naturaleza. Una prueba fija ese recorte.
- Archivos: `app/tv/`, `app/api/tv/`, `app/api/admin/tv-tokens/`, tabla
  `tv_device_tokens`.

**Migración pendiente de aplicar en D1 remoto** (deliberadamente fuera del
pipeline, como todas):

```
npx wrangler d1 execute araya-centro-control-d1 --remote --file=drizzle/0021_tv_device_tokens.sql
```

Hasta que se aplique, `/tv` y la tarjeta de administración avisan de que la
tabla falta; **el resto de la aplicación funciona con normalidad**.

### 4. Semáforo de frescura por KPI

`lib/data-freshness.ts` traduce la procedencia que `/api/live-data` ya
publicaba (y que el cliente ignoraba) en un punto de color junto al nombre
de cada indicador: verde hasta 35 días, ámbar hasta 70, rojo por encima —
los umbrales salen del ciclo de cierre mensual del proyecto. El detalle
completo (edad, corte y última fuente) aparece en la ficha contextual del
KPI.

La edad se mide contra la **fecha de corte** del dato, no contra la de
publicación: un Excel de junio subido en agosto sigue siendo un dato de
junio. Sin corte declarado se usa la publicación y queda señalado como tal.
Cuando no hay procedencia, **no se muestra semáforo**: preferimos callar
antes que atribuir a un KPI una frescura que no le corresponde.

Esta es la mejora más honesta de las cuatro: el resto acelera el transporte,
pero el cuello de botella real del "tiempo real" es que las cifras solo
cambian cuando alguien sube un archivo nuevo. El semáforo hace visible esa
distancia en vez de dejar que la inmediatez de la interfaz la disimule.

`STAT_CARD_FRESHNESS_KEYS` mapea cada indicador a sus raíces vivas, y una
prueba falla si alguna clave no existe en `LIVE_DATA_ROOTS` (un mapeo mal
escrito dejaría el semáforo apagado para siempre sin que nadie lo notara).

### Estado de estas cuatro

Desplegadas y verificadas en producción el 14/08/2026 (ejecución 23 de
`deploy.yml`, en verde con verificación autenticada real). La migración
`0021_tv_device_tokens.sql` la aplicó el usuario en D1 remoto ese mismo día,
tabla e índice único confirmados.

Las opciones propuestas y no implementadas todavía (SSE, WebSockets con
Durable Objects, resumen diario por cron, recordatorios al responsable de
área, consolidación de los ~6 sondeos por pestaña) siguen sobre la mesa.

## Guías de uso: segunda guía y panel unificado (14/08/2026)

El personal de República Dominicana preguntaba con frecuencia por qué el
programa "no funciona" cuando suben un archivo y las cifras no cambian. No
es un fallo — es la cadena de comprobaciones de la publicación automática
(ver `app/api/files/route.ts`, `canPublishAutomatically`) — pero nadie fuera
del equipo técnico tenía forma de saberlo.

- **Guía nueva**: "Subí un archivo y el programa no cambió nada", 4 páginas.
  Explica el recorrido en tres pasos (se guarda / se lee / se publica), qué
  formatos se interpretan, las seis comprobaciones que debe superar un dato
  para publicarse solo — con la más frecuente primero: que el concepto
  exista en el catálogo del contrato vivo — y cómo comprobar en qué fase se
  quedó cada archivo. Todo el contenido salió de leer el código, no de
  suposiciones.
- **Generador**: `scripts/generate_upload_guide_pdf.py`. **Importa** las
  utilidades de `generate_staff_guide_pdf.py` (colores, fuentes, retículas,
  helpers de dibujo) en vez de duplicarlas, así que un cambio de identidad
  visual se hace una sola vez. Copia el PDF a
  `historical/data-center/guias/`, de modo que el Centro de datos lo sirve y
  el despliegue lo sube a R2 sin pasos manuales.
- **Panel unificado**: con una sola guía, el botón de la cabecera podía
  abrir el PDF directamente; con dos deja de servir. Ahora la cabecera,
  `Usuarios y accesos` y `Más` en móvil abren el mismo panel `GuidesPanel`, y
  el Centro de datos lista ambas en una sola tarjeta.
- **`staffGuides` es la fuente única** (en `app/dashboard-client.tsx`):
  título, descripción, páginas y rutas de cada guía. El panel y la tarjeta
  lo recorren. **Añadir una guía en el futuro es añadir una entrada a esa
  lista** — aparece en los cuatro accesos a la vez. Al añadir la segunda a
  mano hubo que tocar varios puntos; ese es exactamente el patrón que esta
  lista evita.

Para regenerar cualquiera de los PDF hace falta `reportlab` (`pip install
reportlab`). Las páginas se revisaron renderizadas una a una antes de
publicar; conviene seguir haciéndolo, porque un texto que se sale de su caja
no lo detecta ninguna prueba.

### Tercera guía: «Qué pasa con cada archivo» (15/08/2026)

Con casi todos los formatos leyéndose ya solos, la pregunta del personal dejó
de ser «¿por qué no cambió nada?» y pasó a ser «esto que voy a subir, ¿va a
actualizar el panel?». Ésa es la que responde la tercera guía, y la que
justifica que exista aparte de la de carga: se consulta **antes** de subir,
con el archivo ya elegido, no después de que algo no haya funcionado.

- **Generador**: `scripts/generate_formats_guide_pdf.py`, que importa las
  mismas utilidades que las otras dos. 4 páginas.
- **La agrupación es la información**: los formatos van por lo que les pasa
  —se lee tal cual / se interpreta / sólo se guarda— y no por programa ni por
  orden alfabético, porque el resultado es lo único que necesita saber quien
  sube el archivo. La franja de color de cada bloque lleva ese estado.
- **Una página entera para el `.mpp`**, con sus dos salidas (exportar a XML
  desde Project, o escribir los porcentajes a mano) y con el motivo por el
  que no se puede leer, para que no se lea como una tarea pendiente.
- **La guía de carga se corrigió a la vez.** Su página 2 seguía listando el
  ZIP entre los formatos que «sólo se archivan», que dejó de ser cierto
  cuando los comprimidos empezaron a abrirse. Dos guías que se contradicen
  son peores que una sola, así que la lista se actualizó en el mismo cambio:
  el ZIP y el XML de Project pasaron al lado de los que sí se leen.

Añadir esta tercera guía costó **una entrada en `staffGuides`** y el retoque
del párrafo que decía «dos documentos breves» — que es exactamente lo que esa
lista única prometía.

## Restauración de la guía y su guarda de regresión (14/08/2026)

Con el 404 de `/data-center/` ya corregido y desplegado, se restauró lo que
el 13/08 hubo que revertir precisamente porque el bug seguía abierto:

- **Botón "Guía de uso" en la cabecera** (`Header` en
  `app/dashboard-client.tsx`, junto al selector de moneda). Abre el PDF
  corporativo en el visor interno. Se suma a los accesos que nunca se
  quitaron: `Centro de datos`, `Usuarios y accesos` y `Más` en móvil.
- **Verificación autenticada de documentos en `scripts/deploy.mjs`**, ahora
  pidiendo **dos** documentos en vez de uno: la guía y el informe IFC de
  julio. Piden carpetas distintas a propósito, para distinguir "falta un
  objeto suelto en R2" de "toda la ruta `/data-center/` está rota otra vez".
  Se restauró sin el código de diagnóstico temporal (volcados de cabeceras y
  del cuerpo) que acompañaba a la versión del 13/08.
- **Aserción en `tests/live-sync-consistency.test.mjs`** que exige que
  `deploy.mjs` siga pidiendo esos dos documentos.

Por qué importa esta guarda: `app/data-center/[...path]/route.ts` sirve estos
archivos **solo desde R2**, y esa subida vive fuera del build
(`scripts/sync-historical-documents.mjs`). Ninguna prueba local puede ver si
el objeto llegó realmente a R2 en un despliegue concreto — hace falta una
sesión autenticada contra producción. Es exactamente el hueco por el que los
23 documentos estuvieron rotos desde que se crearon sin que nadie lo notara.

A partir de ahora, cada despliegue falla en voz alta si un documento fijo
deja de abrirse.

## Comprimidos, PDF y avance a mano (15/08/2026)

Con esto se cierra el recorrido que empezó con «los Excel no actualizan nada»:
**todo lo que llega a la oficina se lee, salvo dos formatos que no se pueden
leer, y para esos hay una salida que no depende de leerlos.**

### Comprimidos

El corte del mes casi nunca llega como un archivo suelto: llega comprimido. El
ZIP se archivaba entero sin mirar dentro, así que un envío de cinco hojas
correctas no movía una sola cifra. Ahora se abre y se procesa su contenido:

- **Por orden de utilidad** (CSV, JSON, XML, XLSX, DOCX, PPTX), no por orden
  alfabético: si dentro viene la plantilla y también el informe de comité, manda
  la plantilla.
- **`__MACOSX/` se salta.** Un ZIP hecho en macOS lleva copias ocultas de cada
  archivo; leerlas duplicaba datos y producía avisos sin sentido.
- **El nombre interno se conserva en la procedencia**, así en la auditoría se ve
  de cuál de los archivos del ZIP salió cada cifra, no sólo que «venía en el
  comprimido».

### PDF

Un PDF **no guarda tablas ni párrafos**: guarda instrucciones de dibujo
(«escribe este texto en esta coordenada»). No se puede reconstruir su estructura
con garantías y `lib/pdf-text.ts` no lo intenta — recupera el texto y busca en él
parejas inequívocas de edificio y porcentaje:

- Se exige **cercanía** entre el código y el número, y el hueco **corta en el
  edificio siguiente**. Un avance atribuido al edificio equivocado es peor que
  no tener el dato.
- Sólo se leen los flujos comprimidos con **Flate**, que es lo que usa
  prácticamente todo generador moderno.
- Un **PDF escaneado** es una fotografía de un papel: no contiene texto. Se
  detecta y se dice, en vez de devolver vacío sin explicación, y ahí sí sigue
  haciendo falta la lectura con IA.

Dos detalles del formato costaron encontrarlos: la palabra `stream` aparece
dentro de `endstream`, así que la búsqueda de flujos encontraba posiciones
falsas; y el salto de línea que precede a `endstream` no forma parte de los
datos comprimidos — incluirlo hacía fallar la descompresión y el flujo entero se
descartaba en silencio.

### Avance a mano

El `.mpp` es el único formato sin ninguna vía de lectura (ver la sección de
Project). La salida buena sigue siendo exportarlo a XML, pero eso depende de que
quien lo tenga pueda abrir Project. **Usuarios → «Actualizar porcentajes a
mano»** no depende de nada: se escribe el avance y se publica **por el mismo
camino que una carga**, con su fecha de corte, su procedencia («Actualización
manual de avances»), su autor y su entrada en el histórico. No es un atajo que
se salte los controles — usa `POST /api/live-data`, que ya exige administrador y
comprueba los permisos financieros.

Las guardas que lleva son las que evitan modos de fallo ya vistos en este
proyecto: un campo en blanco **no publica nada** (publicar `""` borraría el
avance existente, que es lo que pasaba leyendo celdas vacías de Excel); escribir
el mismo valor que ya había **no genera revisión**, para que el histórico no se
llene de entradas que no movieron nada; y las claves van por **código de
edificio** (`buildings.TH-14.progress`), no por posición.

### Dos arreglos en las pruebas

- Los **sustitutos de módulos** se buscaban por la lista exacta de nombres
  importados, así que añadir un lector dejaba el import intacto y el fallo salía
  como un volcado de base64 ilegible. Ahora se buscan por módulo y, si falta
  uno, la prueba dice cuál falta y dónde añadirlo.
- Los **ZIP guardan la fecha de cada entrada**, así que regenerar los ficheros
  de prueba cambiaba todos los bytes sin cambiar el contenido y cualquier rebase
  se convertía en un conflicto binario irresoluble a mano. Con fecha fija en
  `scripts/generar-fixtures-xlsx.py`, regenerar sin tocar los casos no produce
  ningún cambio. Los ficheros de ZIP y PDF se generan también desde ese script,
  en vez de existir como binarios sin origen.

## Notificaciones, automatización de las áreas que faltaban y seguimiento manual (18/08/2026)

Sesión larga. Se cerraron dos problemas que llevaban meses envenenando todo lo
demás (los avisos y los despliegues) y se automatizaron las dos únicas áreas que
seguían en explotación parcial. **Las trampas que se detallan aquí son lo más
importante de esta sección: cada una costó un fallo real y todas son silenciosas.**

### Las notificaciones nunca habían funcionado: dos causas encadenadas

1. Las claves VAPID no estaban en producción, o la pública y la privada no eran
   del mismo par (el servicio push responde 401/403 y no entrega nada).
2. **`wrangler deploy` conserva los secretos del Worker pero borra las variables
   de texto plano puestas a mano en el panel de Cloudflare**, porque
   `wrangler.deploy.jsonc` no declara ningún bloque `vars`. Guardar una sola de
   las tres claves como texto normal hacía que el push funcionara hasta el
   siguiente despliegue y se apagara solo, sin error en ninguna parte.

**Las tres claves (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) van
como Secret.** Si alguien vuelve a ponerlas como texto plano, los avisos se
apagarán en el siguiente despliegue.

Guardas añadidas:

- `scripts/deploy.mjs` consulta `/api/push/config` con la sesión ya autenticada
  de la verificación y **falla el despliegue** si falta alguna clave. Antes esto
  se publicaba en verde con los avisos muertos.
- `POST /api/push/test` recibe el `endpoint` de la suscripción del navegador y
  responde **sobre ese dispositivo**. Antes enviaba a todas las suscripciones del
  usuario y decía "Enviado a 1 de 1" aunque ese 1 fuera el móvil: probando desde
  el ordenador parecía correcto y allí no llegaba nada.

### El despliegue llevaba tiempo bloqueado y nadie lo sabía

Un error de tipos en `lib/project-xml.ts` frenaba el paso de *Typecheck*, así que
**ningún cambio llegaba a producción**. La causa de fondo: `npm run test`
compilaba y ejecutaba las pruebas pero no ejecutaba `tsc`, de modo que un fallo
de tipos pasaba las pruebas locales y sólo aparecía al desplegar. Ahora `test`
empieza por `npm run typecheck` y comprueba exactamente lo mismo que el
despliegue.

### Trampa: un dato sin `area` no se publica y nada lo dice

`app/api/files/route.ts` exige `update.area === resolvedArea` para publicar
automáticamente. Los lectores nuevos no marcaban el área, así que la lectura
funcionaba, los datos se extraían bien **y el panel no se movía**, quedando a la
espera de una revisión manual que nadie sabía que existía.

**Todo lector nuevo debe marcar `area`, `cutoff`, `sourceCurrency` y
`sourceName`** (tipo `ExtractionDefaults` en `lib/ingestion.ts`). Las pruebas de
los lectores comprueban la procedencia, no sólo el contenido.

### Seguridad y Salud: de un PowerPoint sólo se leían las tablas

Los indicadores de seguridad no son una tabla: son cuadros de texto sueltos —el
número en uno, su etiqueta en el siguiente, el matiz en el tercero—, más la lista
de hallazgos. El informe de obra entraba como "sin datos aplicables" y el área
llevaba meses congelada.

- `readPptxSlideShapes` / `extractPptxShapes` (`lib/ooxml-tables.ts`) agrupan el
  texto **por forma** (`<p:sp>`). La agrupación *es* la estructura: sin ella no
  hay manera de saber qué etiqueta acompaña a qué número.
- `extractSafetyUpdates` emite `safetyMetrics` y `safetyFindings` **como listas
  completas, no índice a índice**, para que un mes con menos hallazgos no
  arrastre los del anterior.
- Se **suma** a lo que encuentren las tablas: un mismo informe trae la cubicación
  en tabla y la seguridad en cuadros, y antes sólo podía aplicarse una de las dos.

### Trampa: PDF con fuentes en subconjunto (`/ToUnicode`)

Los informes que la empresa genera cada mes (IFC, proveedores) incrustan la
fuente renumerando sus glifos: el código del PDF no es el del carácter.
`Informe de análisis` se extraía como `,QIRUPHGHDQ£OLVLV` — texto real, pero
ilegible, y **ni la lectura directa ni la IA podían hacer nada con él**, sin que
nada lo delatara. Si alguien plantea "poner una IA mejor" para un documento que
no se lee, comprobar antes si el problema es éste.

`lib/pdf-text.ts` lee y fusiona ahora las tablas `/ToUnicode` del documento
(descartando los códigos con traducciones contradictorias entre fuentes), en dos
pasadas porque una tabla puede venir en un flujo posterior al texto que le
corresponde. **Se elige por flujo la lectura más legible de las dos**, así que un
documento que ya se leía bien no puede empeorar: el informe de junio pasó de 587
a 1570 palabras reconocibles.

### Obligaciones IFC: estaban escritas a mano en el código

El informe se podía abrir desde el panel pero sustituirlo no cambiaba nada, y
ninguna raíz viva apuntaba a ese bloque. Ahora `ifcComplianceGroups` es raíz viva
(y financiera) y `extractIfcCommitments` la lee del informe: 6 bloques frente a
los 4 fijos, incluidas las observaciones y recomendaciones, que se perdían.

Dos detalles del documento, por si cambia el formato:

- Los títulos se dibujan **letra a letra**, así que los espacios entre palabras
  se pierden al recuperar el texto. Se detectan por piezas de una sola letra y se
  recomponen separando los conectores. Buscarlos carácter a carácter se comía la
  primera letra del párrafo siguiente y truncaba el primer compromiso.
- El PDF separa la primera letra de algunas palabras para ajustar el espaciado
  (`T ransacciones`). Se une, salvo cuando la `A` suelta es de verdad una
  preposición.

### Seguimiento manual: lo que ningún documento puede decir

Los hallazgos y las obligaciones se leen solos, pero ningún informe dice quién se
hace cargo, para cuándo ni con qué prueba queda cerrado. Dos pantallas nuevas
sobre un editor compartido (`TrackingEditor` en `app/dashboard-client.tsx`):

- **Hallazgos** (`safetyFindingTracking`, `POST /api/safety-findings`).
- **Obligaciones IFC** (`ifcComplianceTracking`, `POST /api/ifc-compliance`).

**La lista leída manda y el seguimiento se cruza por el texto del punto**, de
modo que cuando el informe del mes trae otros distintos, los nuevos aparecen sin
asignar y no se arrastra el seguimiento de los que ya no figuran.

Sobre los permisos: `POST /api/live-data` exige administrador, y quien cierra un
hallazgo es el jefe de obra. En vez de rebajar ese permiso general —que abriría
la puerta a escribir cualquier dato, incluidos los financieros— cada ruta **sólo
puede escribir su propia clave** y reconstruye cada campo en el servidor en lugar
de guardar lo que llegue. La de IFC sí exige autorización financiera, porque ese
bloque sólo se sirve con ella y si no sería una puerta lateral a su contenido.

### Trampa: el catálogo de un campo `status` sale del dato base

`lib/live-data-contract.ts` sólo admite en un campo cuyo nombre encaje en
`ENUM_FIELD` (`status`, `state`, `phase`…) **los valores presentes en el dato
base**. Consecuencias prácticas:

- `safetyFindingTracking` tiene los tres estados en su dato base (tomados del
  apartado "seguimiento a acciones" del informe de junio, no inventados). Si
  alguien los recorta, guardar "Cerrado" empieza a fallar. Hay una prueba que lo
  vigila.
- `ifcComplianceTracking` va con el estado **vacío** a propósito: dar por abierta
  o incumplida una obligación del contrato afirmaría algo que no consta, y además
  un catálogo vacío no impone restricción, con lo que no hay que fabricar estados
  falsos para que el desplegable pueda usarlos. La lista válida la impone el
  servidor. Otra prueba vigila que siga vacío.

Recordatorio general del contrato: **la ruta tiene que existir en el modelo
autorizado**, así que un mapa con claves arbitrarias no valida; escribir la raíz
entera sí, y las listas se validan por la forma de sus elementos, no por su
longitud. Un dato base con lista vacía obliga a que lo escrito también lo esté.

### Otros

- La etiqueta **VIAL** del plano se movió al centro en los dos mapas de
  coordenadas (`urbanismMapPoints` y `visualUrbanismMapPoints`).
- `guia-formatos-araya.pdf` actualizada y regenerada: decía "de Word y PowerPoint
  se leen las tablas", que ya no es completo.
- Correo para dirección y mensaje de WhatsApp para la oficina, redactados y
  entregados al usuario (no viven en el repositorio).

### Estado al cierre

Las catorce áreas operativas; ninguna marcada como parcial. 257 pruebas (se
empezó el día con 242), todas contra documentos reales del repositorio y no
contra ejemplos inventados. Nueve cambios publicados y desplegados en verde.

### Pendiente

- **IA de Anthropic como respaldo de extracción**, aparcado por decisión del
  usuario. Hoy el respaldo es OpenAI (Luna normal y Terra sólo como escalado,
  `lib/ai-document-extraction.ts`).
  Necesitaría `ANTHROPIC_API_KEY` en Cloudflare. Conviene no venderlo como
  solución a documentos ilegibles: eso casi siempre es un problema de lectura,
  no de interpretación.
- **Los PDF del fideicomiso no contienen texto** (`scanned: true`): son imágenes
  y necesitan lectura asistida, no un lector determinista.
- Verificar con el informe de agosto que los hallazgos nuevos aparecen sin
  asignar y no se arrastra el seguimiento de junio.

## Lector propio de ventas, reproceso y publicación robusta (19/08/2026)

Contexto: el informe de ventas de julio se subió el 18/08, pero su **lector
propio** (`extractSalesReport`, PR #68) llegó el 19/08. Un archivo ya subido no
se re-analiza solo, así que se quedó con lo que sacó la IA aquel día —le
faltaban el mix por modelo y las metas de cobranza— y sus gráficas no se
movían. Arreglarlo destapó tres problemas de fondo que hoy quedan resueltos y
desplegados (60+ pruebas en verde).

### 1. Reproceso de archivos ya subidos (`scripts/reprocesar.mjs`, workflow `reprocesar.yml`)

- Vuelve a pasar por la ingesta actual los archivos ya subidos, para que recojan
  las mejoras de un lector. Simula por defecto; `aplicar=1` publica.
- La subida deduplica por hash: un archivo idéntico **ya publicado** se
  short-circuitaba con «ya estaba registrado» sin re-analizarse. Se añadió la
  señal `reprocess=true` en `app/api/files/route.ts`: reclama el expediente ya
  publicado, lo re-analiza y publica una revisión nueva encima, con clave
  idempotente propia (`auto:${id}:${generación}`) para no chocar con el cierre
  anterior. Las subidas normales no cambian.
- `formatos` acota por extensión (p. ej. `pptx`) para tocar sólo los informes
  narrativos y no los Excel, que ya leen bien los lectores deterministas.
- **Modo reemplazo** (`reemplazar=1`): retira el expediente previo y re-sube el
  original como alta nueva (camino de publicación de siempre). Útil cuando hay
  que re-ingerir de cero. Deja el archivo antiguo retirado (recuperable).

### 2. La ingesta automática no puede caerse entera por un dato

- `normalizeLiveDataUpdates` valida el lote completo y **lanza** ante la primera
  clave que no encaja en el modelo. Un único dato malo (uno que la IA propuso de
  más, o un nombre que el resolutor no supo colocar) mandaba TODO el expediente
  a «observado» y se perdían también los datos buenos.
- `normalizeIngestedUpdatesResilient` en la ruta prueba el lote y, si falla,
  normaliza dato a dato y descarta sólo los que no encajan. La resolución de
  identidad también cae con red. **Sólo afecta a la ingesta automática**: la
  bandeja de revisión manual sigue siendo estricta.

### 3. Publicación automática dato a dato (no todo-o-nada)

- El acceso a publicar automáticamente era un `.every(...)`: un solo dato no
  publicable bloqueaba el informe entero. Ahora las condiciones de **lote**
  (área, contexto vivo, confianza) se separan de las de **cada dato** (área,
  permiso financiero, contrato). Lo que encaja se publica solo; el resto va a
  revisión. Si todo el lote encaja, se publica entero como siempre.
- El complemento de la IA sólo aporta claves nuevas con confianza positiva, y el
  recuento de confianza se cuenta sobre la extracción, no sobre lo que sobrevive
  a la normalización.

### 4. La causa concreta del informe de ventas (parent vs child)

- La publicación **prohíbe mezclar una lista entera con una ruta hija suya** en
  el mismo lote: `La publicación no puede mezclar collectionTargets con su ruta
  hija collectionTargets.0.targetUsd`. La IA de relleno mandaba la lista entera
  `collectionTargets` y el lector determinista sus filas
  (`collectionTargets.0.targetUsd`), así que el lote no se podía publicar.
- El filtro del complemento ahora descarta una clave de la IA no sólo si es
  idéntica a una del lector, sino también si es **antepasada o descendiente**
  suya (`complementoChocaConLector`). Gana el lector.
- Confirmado en producción: el informe de ventas de julio publicó **25 datos en
  la revisión 49**, con el mix por modelo y las metas de cobranza incluidos.

### Herramientas de operación y diagnóstico (workflows, sólo con `DEPLOY_VERIFY`)

- `reprocesar.yml` — reprocesa/re-ingiere (`filtro`, `formatos`, `reemplazar`,
  `aplicar`, `debug`).
- `diagnostico-reproceso.yml` — muestra el estado de un archivo (revisión,
  resumen, **nombres** de clave; nunca valores).
- `restaurar.yml` / `recuperar-ventas.yml` — restauran expedientes retirados y
  recomputan los datos vivos (deshacen un reemplazo que no publicó).
- `debug=1` en la subida devuelve **el texto del error** de publicación (nunca
  cifras) para localizar qué comprobación de integridad falla sin el log del
  servidor. Gateado a acceso financiero y sólo bajo petición.

### Pendiente deliberado

- **Informe Ejecutivo de julio:** tiene 22 avances de obra preparados en la
  bandeja de revisión (edificios, `projectSnapshot`, disciplinas, seguridad,
  urbanismo). NO se publican solos porque su área es «sin clasificar» y, sobre
  todo, **pisan datos que ya vienen del plan de Project / Excel oficiales**.
  Publicarlos es una decisión de la oficina, no una automatización: aprobarlos
  desde la bandeja sobreescribiría cifras más precisas del plan.

### Aprendizaje para el próximo LLM

- Al mejorar un lector, los archivos subidos antes hay que **reprocesarlos**;
  no se re-analizan solos.
- Si una publicación automática deja el expediente en «observado», subir con
  `debug=1` da el mensaje exacto del error. La familia de errores de esta fase
  es de contrato/publicación (mensajes descriptivos) o D1 (nombres de
  restricción), nunca valores.
- Nunca imprimir valores de negocio en los logs de Actions: sólo nombres de
  clave, estados y metadatos.

## Criterios de continuidad

- Mostrar únicamente datos aportados o derivados de las fuentes.
- Marcar campos futuros como pendientes.
- Conservar el DWG original descargable.
- Mantener el masterplan visual y el plano técnico.
- No cambiar la geometría visual para resolver un problema de coordenadas.
- Mantener accesibilidad mediante títulos y etiquetas `aria`.
- Usar siempre `apartamento` y `apartamentos` en la interfaz, los informes y
  las respuestas del agente. `vivienda` se conserva únicamente como alias
  técnico interno para clasificar documentos o reconocer consultas antiguas.
- Mantener GitHub (`Montpla/ARAYA-Centro-de-control`) como fuente canónica y
  Cloudflare Workers como producción. No usar Sites salvo nueva orden expresa.
  El contenido sigue protegido por sesión, `app_users` y permisos server-side.
  Sólo un administrador puede gestionar usuarios.
- Mantener USD como moneda de visualización inicial y DOP como regla de
  origen cuando un archivo no indique moneda. Cada nueva carga debe persistir
  `source_currency`.
- No borrar archivos históricos ni cambios ajenos.

## Próximos pasos probables

El usuario seguirá entregando datos para completar:

- Avance por apartamento.
- Albañilería, instalaciones y acabados.
- Responsables e incidencias.
- Desglose de urbanismo.
- Estacionamientos.
- Paisajismo.
- Viales.
- Equipamientos.
- Proveedores, contratos y entregas.

Al recibir nuevos archivos, incorporarlos al Centro de datos, mantener su
trazabilidad y adaptar las fichas interactivas sin inventar valores.

## Auditoría de avance y cargas recientes — 20/08/2026

- El **19,39 %** visible no es el avance físico oficial. Es la media aritmética
  de los avances de los 26 edificios importados del MPP: suma 504,26 / 26 =
  19,394615 %, redondeado a 19,39 %. Once edificios están al 0 %.
- La base viva conserva tres indicadores distintos y trazables:
  - avance físico ejecutado: **22,71 %** (`Informe_Ejecutivo_ARAYA_Julio_FINAL.pptx`,
    corte 31/07/2026, revisión 50);
  - avance físico planificado: **26,61 %** (misma fuente y corte);
  - avance del cronograma MPP: **22,37 %** (XML convertido del MPP, corte
    30/07/2026, revisión 51).
- La causa está en la capa de presentación: `projectProgressFromBuildings`
  calcula la media simple y `lib/spatial-live-data.ts` y
  `app/dashboard-client.tsx` sustituyen con ella el último punto real de la
  Curva S y `projectSnapshot.overallProgress`. Esto contradice los propios
  textos de la interfaz, que indican que el avance físico procede del informe
  y del Excel maestro.
- Corrección recomendada: mantener **22,71 %** como avance físico principal y
  último punto ejecutado de la Curva S; mantener **22,37 %** como KPI separado
  de cronograma MPP; mostrar **19,39 %** sólo como “Promedio simple de avance de
  edificios”, si se considera útil.
- Cargas activas del 18–20/08: el informe de ventas de julio (revisión 52) y el
  MPP convertido (revisión 51) están sincronizados, aprobados y sin propuestas
  de datos pendientes. Una segunda copia del informe de ventas fue retirada y
  sus propuestas pendientes no intervienen en el dato vivo.
- Quedan tres candidatos comerciales sin clasificar. Los dos cualitativos ya
  están cubiertos por datos vivos: morosidad máxima 1 % y recaudo frente a lo
  proyectado 92 %. El único contenido realmente no modelado es **Reservas por
  modelos**: Balcony 6,3; Garden 4,9; Sunset 6,8; Flex 3,8 unidades/mes.
- La nota histórica anterior que indicaba que el Informe Ejecutivo de julio
  seguía pendiente queda superada: sus 22 datos se publicaron en la revisión
  50 el 19/08/2026.

### Corrección implementada y publicada — 20/08/2026

- `overallProgressNow` queda fijado a la cifra física oficial **22,71 %** del
  corte 31/07/2026. El último ejecutado de la Curva S usa ese valor.
- Servidor (`lib/spatial-live-data.ts`) y cliente
  (`synchronizeSpatialSummary`) dejaron de sustituir el KPI físico por la media
  simple de edificios. Los edificios y apartamentos siguen actualizándose y
  conservan sus métricas propias, sin gobernar el total físico.
- El informe comercial incorpora `juneReport.sales.reservationsByModel` con
  Balcony 6,3; Garden 4,9; Sunset 6,8; Flex 3,8 unidades/mes. El lector de PPTX
  extrae esas cuatro cifras automáticamente en cargas futuras.
- La vista de Ventas y cobranza muestra el bloque interactivo “Reservas por
  modelo” y eliminó rótulos, conteos y barras congeladas de junio; ahora usa el
  corte y los valores vivos del informe más reciente.
- Verificación local: TypeScript verde, compilación Vinext verde, ESLint
  focalizado sin errores y suite completa **279/279**.
- Este lote y las automatizaciones descritas a continuación ya forman parte de
  `github/main`; no quedan como cambios locales pendientes.

## Automatización documental universal — implementada y publicada (20/08/2026)

El usuario ordenó ejecutar los puntos 1 a 6; el punto 7 (dominio) queda
expresamente descartado. El lote quedó integrado en `main` y funciona dentro
del despliegue actual de Cloudflare Workers.

1. **Fecha de fin del plan.** `lib/project-xml.ts` publica
   `projectSnapshot.forecastFinish` como ISO `YYYY-MM-DD`, que es lo que exige
   el contrato. La UI la presenta como `DD/MM/YYYY` mediante
   `projectDateForDisplay`. Esto corrige el dato 28 que el MPP ya extraía pero
   el contrato rechazaba; el XML derivado existente lo recuperará al reproceso.
2. **MPP automático.** `convertir-mpp.yml` corre cada 15 minutos, procesa como
   máximo cinco originales sin conversión, genera MSPDI con MPXJ y lo reingresa
   con `derived_from_file_id=mpp` y `automation_kind=mpp_to_xml`. Valida que
   existan fechas `Finish` antes de subir.
3. **ZIP y DWG.** Los ZIP abren hasta 200 entradas con límites de tamaño,
   cantidad y relación de compresión; leen formatos estructurados y envían a la
   IA hasta cinco documentos narrativos internos. `convertir-dwg.yml` corre una
   vez por hora: LibreDWG genera SVG, librsvg lo rasteriza a PNG de 3.200 px y la
   vista vuelve a la ingesta, enlazada al DWG original y abrible en móvil.
4. **Versionado y reproceso.** Cada expediente guarda `ingestion_version` y
   `processed_at`. `CURRENT_INGESTION_VERSION` es `2026-08-20.2`.
   `reprocesar-obsoletos.yml` compara la marca cada seis horas y relee tres
   expedientes antiguos por ciclo, sobre la misma fila y el mismo original,
   sin duplicar. Los expedientes superados y los binarios MPP/DWG se excluyen.
5. **Secciones provisionales.** Un candidato nuevo sin campo del modelo ya no
   desaparece ni exige que todo sea Finanzas: crea `discoveredSections.N` con
   título, área, evidencia, fuente, confianza y valores. Centro de datos las
   muestra de forma interactiva. La privacidad se aplica por el área del punto;
   Finanzas/Comercial siguen invisibles para quien no tenga permiso.
6. **XLS histórico de junio.** El análisis está en
   `historical/data-center/junio-2026/DECISION-avance-fisico-y-cubicaciones.md`.
   El libro contiene 21,236557 % plan / 18,231973 % ejecutado y cubicaciones 1 a
   4; queda como antecedente, sustituido por el libro oficial de julio. La ruta
   `/api/files/supersede` conserva el original y registra sustituto, motivo,
   administrador, fecha, actividad y notificación. Un expediente superado no se
   puede reprocesar. `cerrar-historico-junio.yml` aplica esa decisión una vez.

### Esquema aplicado y secuencia para un entorno nuevo

- Migración nueva: `drizzle/0024_sleepy_nightshade.sql`; añade seis columnas e
  índices a `uploaded_files`. La cadena exacta ya está en el journal y llega a
  `0024_sleepy_nightshade`.
- En el entorno vigente esta migración y el código dependiente ya están
  desplegados. Para levantar una base nueva, aplicar el journal completo antes
  del Worker: el Worker selecciona esas columnas desde el arranque. Después se
  puede ejecutar `Cerrar antecedente XLS de junio`, primero con `aplicar=0` y
  luego con `aplicar=1`.
- Tras el deploy, los cron de MPP, DWG y reproceso completan la puesta al día.
  Comprobar que `projectSnapshot.forecastFinish` aparece en `/api/live-data` y
  que el XLS de junio muestra `historico/superado`.
- Se verificó por Wrangler que el Worker tiene el secreto `OPENAI_API_KEY`,
  además de las claves VAPID. Nunca imprimir ni copiar los valores.
- Pruebas nuevas: `tests/ingestion-automation.test.mjs` y límites ZIP en
  `tests/zip-pdf-lectura.test.mjs`. TypeScript y build Vinext están verdes.

## Cubicación Nº8 · 26 edificios, incluidos TH-76 y TH-77 — publicada y verificada (20/08/2026)

- Expediente de producción: `458097f8-36d1-4761-88f7-9336da6d1a1f`,
  `Cubicacion 8 Araya Jul.xlsx`, subido por Ernesto Álvarez el 20/08/2026.
  La revisión 54 publicó solo datos generales y ninguna clave `buildings.*`.
  La inspección acotada del original demostró que no es una cubicación exclusiva
  de dos edificios: la hoja `CARATULA` resume Urbanismo y 26 edificios (TH-01 a
  TH-18 y TH-70 a TH-77), con el dato válido en `% Actual acumulado`.
- Publicado mediante PR #88, #89, #90 y #91. El lector recorre todas las hojas,
  reconoce tablas corrientes y matrices, y además interpreta la tabla real
  `Capitulo | Monto | En el periodo | Anterior acumulado | Actual acumulado`.
  Toma la fila TOTAL declarada (que incluye Urbanismo), nunca un promedio
  simple ni un subtotal exclusivo de edificios.
- Revisión viva **65**: 29 cambios automáticos —26 avances de edificios,
  `urbanismAreas.0.progress`, `projectSnapshot.overallProgress` y la carátula
  financiera—. El expediente quedó `sincronizado 100 %`. Valores efectivos:
  - TH-76: `8.043668717674729 %` (pantalla: 8,04 %).
  - TH-77: `8.327368133099393 %` (pantalla: 8,33 %).
  - Urbanismo: `21.246731092069879 %` (pantalla: 21,25 %).
  - Avance físico ponderado total: `22.709932764800073 %` (pantalla: 22,71 %).
- La comprobación de producción `32417455902` confirmó revisión 65, 26 claves
  `buildings.*.progress` efectivas y los índices espaciales: TH-77 es
  `buildings.24.progress`; TH-76 es `buildings.25.progress`.
- Un documento que nombra edificios sin generar su avance queda abierto y no
  puede cerrarse como “sincronizado 100 %”. Un original mixto conserva el
  archivo/evento protegido en Finanzas, pero las claves físicas `buildings.*`
  mantienen área Obra; la publicación sigue exigiendo un usuario autorizado si
  el original está protegido.
- `CURRENT_INGESTION_VERSION`: `2026-08-20.6`. El workflow de reproceso admite
  `file_id`, necesario porque existe otra copia homónima. El diagnóstico XLSX
  solo muestra filas relevantes y dos vecinas; el original permanece en R2.
- Verificación: TypeScript y build Vinext verdes, ESLint sin errores, suite
  completa **306/306**, despliegue final `32417070935`, reproceso exacto
  `32417350117` y comprobación efectiva `32417455902`, todos correctos.

## Agente de ingesta adaptativa — implementado localmente (20/08/2026)

- Rama de trabajo: `codex/agente-ingesta-araya`, basada en `github/main`
  `35943b6`. Todavía no se ha publicado esta rama ni aplicado la migración en
  producción.
- Migración nueva `drizzle/0025_yellow_bullseye.sql`: crea
  `document_templates` (memoria por familia de archivo) e
  `ingestion_agent_runs` (modelo, prompt, trayectoria de herramientas,
  validación, tokens y resultado). Aplicar el journal completo antes del Worker.
- `lib/ingestion-agent.ts` genera una firma estable que ignora mes/año/número,
  guarda el mapeo de claves que realmente se publicó, recomienda KPI/barras/
  línea/tabla/lista y ejecuta una conciliación independiente de porcentajes,
  duplicados y rutas solapadas.
- `lib/ai-document-extraction.ts` ya no es una sola llamada: para documentos
  asistidos ejecuta hasta cuatro iteraciones y doce herramientas. Herramientas:
  inspeccionar esquema, leer valor actual, buscar plantilla, validar candidatos,
  conciliar numerador/denominador y recomendar visualización. La respuesta final
  sigue siendo JSON Schema estricto; el archivo temporal se elimina igual que
  antes. Prompt `araya-ingestion-agent-2026-08-20-v1`.
- `app/api/files/route.ts` abre una ejecución auditable por carga, recupera hasta
  cinco plantillas compatibles, pasa sus pistas al agente, normaliza identidades,
  concilia y publica por el mismo batch atómico existente. Al publicar, memoriza
  únicamente las claves y visualizaciones correctas, nunca valores del próximo
  documento ni razonamiento privado. La baja/restauración continúa recalculando
  desde `live_data_history`, también para secciones dinámicas.
- Las secciones descubiertas ahora almacenan `visualization`, `unit` y `series`.
  Centro de datos y Ventas las muestran como indicador, barras, línea, tabla o
  lista; las filas antiguas sin esos campos caen a lista y siguen abriendo.
- ARAYA Asistente usa el prompt `araya-asistente-v11-agente-ingesta`: explica
  la lectura de todos los formatos admitidos, consulta el expediente antes de
  afirmar una publicación y deja de presentar CSV/JSON como vía exclusiva.
- `CURRENT_INGESTION_VERSION` sube a `2026-08-20.7`, de modo que el reproceso
  programado puede aplicar esta mejora a expedientes anteriores.
- Evaluación: `tests/fixtures/ingestion-agent-eval-cases.json` contiene 24 casos
  ARAYA reales, incluida Cubicación 8; `tests/ingestion-agent.test.mjs` cubre
  memoria, visualización, conciliación y dataset; la prueba del extractor cubre
  además la trayectoria de herramienta y su límite. Al cerrar este bloque:
  TypeScript verde, suite completa **313/313**, ESLint 0 errores (20 avisos
  históricos) y build Vinext verde.

## Cierre automático e idempotente de todas las áreas — local (21/08/2026)

Esta sección sustituye las notas históricas que decían que una cubicación
incompleta debía quedar abierta o que el cargador necesitaba permiso de lectura
financiera para que la ingesta publicara. Esas reglas eran dos de las causas de
los expedientes eternamente pendientes.

- No se ha escrito en D1/R2 de producción ni se ha variado ningún valor vigente.
  Se conservan, entre otros, 22,71 % físico, 26,61 % plan y 22,37 % MPP. Este
  bloque cambia el comportamiento de cargas futuras; cualquier reproceso del
  backlog debe hacerse después del despliegue, por expediente y verificando el
  diff antes de aplicarlo. `CURRENT_INGESTION_VERSION` se mantiene en
  `2026-08-20.7` precisamente para no lanzar un reproceso masivo implícito.
- Causa raíz 1: `updateConfidences[index]` se consultaba después de resolver
  identidades, normalizar y eliminar choques. Una fila descartada desplazaba las
  siguientes y las secciones descubiertas no tenían posición en ese array;
  acababan con confianza 0. `lib/ingestion-change-set.ts` enlaza ahora la
  confianza con la identidad canónica `clave + valueJson`.
- Causa raíz 2: se preparaban y publicaban otra vez valores idénticos. El mismo
  módulo compara JSON canónico, separa cambios reales y deja el archivo
  `integrado/sincronizado` sin evento, historial ni notificación duplicados.
- Causa raíz 3: la publicación parcial dejaba las propuestas restantes en
  revisión. `publishLiveDataUpdates` admite `reviewClosure.publishedKeys`; en el
  mismo batch atómico marca las aceptadas `publicado`, las restantes
  `descartado_automatico`, verifica los recuentos y cierra el archivo. Si ningún
  dato pasa, el original y el diagnóstico se conservan y la generación cierra
  `procesado_con_alertas`, sin modificar el modelo vivo.
- Finanzas: la ingesta automática actúa como servicio interno con permiso de
  escritura contractual, manteniendo como actor a la persona que cargó el
  archivo. Esto permite que un trabajador aporte un balance fiable aunque no
  pueda consultar Finanzas. Los lectores, archivos, endpoints y notificaciones
  financieras continúan protegidos; no se concede permiso de lectura.
- Un `autoPublish` omitido ahora significa publicar; sólo el valor explícito
  `false` desactiva la automatización para mantenimiento. Cámara, agente, token
  y formulario sencillo siguen el mismo recorrido.
- Los porcentajes fuera de 0–100 y rutas conflictivas se identifican por clave.
  Se aísla sólo la entrada inválida; el resto del informe continúa. La ausencia
  de un edificio citado queda en el diagnóstico y nunca se rellena inventando un
  porcentaje.
- Los candidatos sin campo conocido se guardan ya como `adaptado`, no
  `pendiente`. `planDynamicSectionSlots` reutiliza título+área e id de una
  sección existente; el parte siguiente actualiza el mismo bloque en lugar de
  crear una lista mensual infinita. Los candidatos pendientes de generaciones
  anteriores del mismo expediente se marcan `superado` al procesar la nueva.
- Al recibir una generación nueva se siguen eliminando las propuestas de
  generaciones antiguas del expediente. Las siete propuestas vigentes de los
  partes históricos de Seguridad y los ocho expedientes antiguos detectados en
  `extraccion_pendiente` **no se tocaron** para respetar la orden de no variar
  los datos actuales; deberán reprocesarse expresamente tras publicar este
  código.
- Pruebas nuevas: `tests/ingestion-change-set.test.mjs` cubre igualdad canónica,
  no-op, confianza tras reordenamiento y reutilización de sección; la prueba de
  conciliación exige `invalidKeys`. Las pruebas de cubicación y multiformato se
  actualizaron al contrato de “publicar lo válido y cerrar el diagnóstico”.
- Archivos principales: `app/api/files/route.ts`,
  `lib/ingestion-change-set.ts`, `lib/ingestion-agent.ts` y
  `lib/publish-live-data.ts`. No hay migración nueva.
- Verificación final local: `npm test` **316/316** (incluye TypeScript y build
  Vinext), `npm run lint -- --quiet` sin errores y `git diff --check` sin errores.
  El grafo `codebase-memory-mcp` quedó reindexado y persistido para el siguiente
  LLM. Todavía no se ha hecho push ni deploy de este bloque.

## Arquitectura híbrida y control de gasto de IA (22/08/2026)

- Los lectores deterministas siguen siendo la primera opción y no consumen IA.
  Los Excel reconocidos, CSV, JSON, XML y formatos con lector propio ya no se
  vuelven a mandar al modelo como “complemento”. Dentro de un ZIP sólo pasan a
  lectura asistida los documentos narrativos o visuales.
- La lectura documental normal usa `gpt-5.6-luna`, detalle visual bajo,
  `service_tier: default`, máximo dos iteraciones, 16 llamadas de herramienta y
  8.000 tokens de salida. Terra sólo se ejecuta si Luna devuelve baja confianza,
  contradicción, ambigüedad o no consigue una salida en un documento bien
  clasificado; el escalado usa detalle alto y límites superiores acotados.
- ARAYA Asistente responde primero con el motor interno cuando la consulta ya
  encaja en los datos vivos. Las demás preguntas usan Luna. Sólo un administrador
  ve el interruptor **Análisis avanzado**, que usa Terra de forma expresa.
- Se fuerza tarifa estándar en Responses API y se conserva la clave de caché de
  prompt. Cada recorrido registra tokens de entrada, caché, escritura de caché,
  salida y coste estimado; no se guardan preguntas ni respuestas del chat.
- La Sala operativa incorpora una pestaña **Uso de IA** sólo para administradores:
  separa procesos Luna, Terra y deterministas, muestra tokens/coste y permite
  fijar presupuesto mensual. `0` mantiene la medición sin bloquear. Al 80% y al
  100% se genera una notificación idempotente para administradores. Alcanzado el
  límite se detiene la IA, pero los lectores deterministas continúan.
- La deduplicación SHA-256 existente sigue evitando reanalizar archivos
  idénticos. No se cambió `CURRENT_INGESTION_VERSION`, para no reprocesar de forma
  masiva los históricos únicamente por este ajuste económico.
- Nueva migración: `drizzle/0027_confused_rage.sql`; añade columnas económicas a
  `ingestion_agent_runs`, la tabla privada `assistant_ai_runs` y el ajuste global
  `ai_usage_settings`.
- Pruebas añadidas para tarifa Luna/Terra, caché, escalado selectivo, Excel sin IA,
  ZIP narrativo y aviso presupuestario. Antes de publicar, ejecutar el conjunto
  completo y aplicar la migración D1.
