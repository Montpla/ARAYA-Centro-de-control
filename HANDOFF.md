# ARAYA Centro de Control — Estado de continuidad

Actualizado: 11/08/2026
Zona horaria del usuario: Europe/Madrid
Idioma de trabajo: español

## Instrucción para el próximo LLM

Continuar sobre este proyecto existente. No reconstruir el dashboard desde cero,
no sustituir su arquitectura y no inventar datos. Antes de modificar el código,
leer este documento, `AGENTS.md` del workspace y `.openai/hosting.json`.

El usuario trabaja de forma iterativa: normalmente entrega archivos, capturas o
indicaciones visuales y espera que el dashboard se actualice, se compruebe y se
publique en el mismo enlace.

## Proyecto y publicación

- Proyecto: Centro de Control ARAYA — Grupo Bricket.
- Directorio local:
  `C:\Users\Usuario1\OneDrive\Desktop\ARAYA_Transformacion_Digital\12_Dashboard_Obra`
- Producción:
  `https://araya-centro-control.enriquemontesplaza.chatgpt.site`
- Proyecto de Sites:
  `appgprj_6a68f2b048e48191840a253b2285feb7`
- Última versión publicada: 51, con archivo documental por año y mes, visor
  interno móvil, carga simplificada, publicación estructurada segura y
  protección directa de originales estáticos. El agente permanece como
  `ARAYA Asistente`. El commit desplegado es el `HEAD` de
  `main`; el identificador opaco debe consultarse en Sites por número de versión
  y no reconstruirse manualmente.
- Acceso de infraestructura: `public` desde el 11/08/2026. La URL puede abrirse
  sin figurar en una lista externa de invitados, pero el contenido continúa
  protegido por inicio de sesión y por la tabla interna `app_users`.
- Rama y remoto de publicación: rama `main`, remoto `sites`.
- Sites no ofrece un alias público sin el espacio personal del propietario. Para
  disponer de una dirección corporativa neutra hay que conectar un subdominio
  controlado por Bricket (por ejemplo, `control.dominio-corporativo.com`) y
  completar los registros DNS que devuelva Sites. No hay dominio personalizado
  configurado actualmente.

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
- Cuando una sesión abierta recibe `401` o `403` en la sincronización, borra la
  caché privada y la credencial biométrica local y vuelve a validar el acceso.
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

El selector de proyecto activo permite abrir dos promociones:

- `ARAYA`: proyecto real, con sus datos documentales y todas las funciones
  existentes.
- `MIRADOR DEL PARQUE`: proyecto ficticio de demostración, con 14 edificios,
  84 apartamentos, urbanismo, planificación, cronología, proveedores, métricas y
  fuentes simuladas. Toda la interfaz lo identifica como `PROYECTO DEMO`.

Los datos de ambos proyectos están separados. El agente IA y las altas
persistentes de métricas o proveedores permanecen vinculados únicamente a
ARAYA para evitar mezclar registros reales con la demostración.

La carga documental colaborativa está disponible en todas las pestañas de
ARAYA mediante `+ Cargar archivo` y también dentro del chat del agente:

- El original se guarda en R2 con la vinculación lógica `FILES`.
- D1 registra usuario autenticado, área, sección, descripción, moneda de
  origen, fecha de corte, tamaño, SHA-256, versión, estado y motivo de
  clasificación.
- Los duplicados exactos se detectan por SHA-256 y no se vuelven a almacenar.
- Cada archivo muestra una cola de cuatro fases: recepción, clasificación,
  normalización y sincronización. La clasificación se completa al cargar; la
  sincronización llega al 100% únicamente cuando una revisión viva vinculada
  publica datos, evitando afirmar que un original ya fue interpretado.
- El registro del Centro de datos y todas las vistas se refrescan cada 5
  segundos.
- El original de toda carga aparece inmediatamente con estado técnico
  `pendiente_revision`, mostrado como `En normalización`.
- Cuando el contenido se normaliza mediante el contrato de datos vivos, se
  publica una revisión que actualiza automáticamente gráficas, cifras,
  porcentajes, cronograma, avance, informes y respuestas del agente.
- Las contradicciones no se sustituyen silenciosamente: conservan la
  procedencia y quedan observadas para conciliación.
- Límite actual: 50 MB. Formatos: Excel, CSV, PowerPoint, PDF, Word, MPP, DWG,
  imágenes y ZIP.

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
- `live_data_points`: último valor vivo por clave con su procedencia.
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

Importante: almacenar un PDF, PowerPoint, DWG o Excel no interpreta por sí solo
su contenido. El original aparece inmediatamente; las cifras se actualizan
cuando el agente o un importador confiable extrae y publica los datos mediante
el contrato normalizado. No afirmar que un documento arbitrario se integra sin
esta fase. Los datos ya estructurados pueden publicarse directamente y se
propagan en menos de cinco segundos.

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
  Control desde el navegador compatible. El service worker v3 conserva el
  shell visitado y activos de la interfaz para consulta local, pero excluye
  rutas API, autenticación y respuestas vivas. En modo sin conexión no se
  permiten cargas, cambios ni generación de informes.
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
- La consulta offline sólo se abre cuando este dispositivo ya tiene una
  credencial local. Al cerrar sesión se eliminan las cachés privadas.

## Datos actualmente integrados

- Corte documental: 30/06/2026.
- Avance físico ejecutado: 18,23%.
- Plan operativo: 21,24%.
- Avance del cronograma MPP: 17%.
- Desviación física: -3,00 puntos porcentuales.
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

`public/data-center/002-implantacion-general.dwg`

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
- `.openai/hosting.json`: identificador de Sites y bindings lógicos.

## Validación

Comando habitual:

`npm test`

Este comando ejecuta el build de vinext y las pruebas. En el último corte:

- 27 pruebas superadas.
- 0 fallos.
- La compilación de producción fue correcta.
- `npm run lint` termina sin errores; mantiene nueve avisos conocidos por el
  uso intencional de imágenes locales con `<img>`.

Para cambios visuales de posición, comprobar:

1. Que la imagen cargada sea `araya-visual-masterplan-v3.png`.
2. Que existan 26 `.plan-building-hotspot`.
3. Que el marcador esté sobre el elemento indicado.
4. Que al pulsarlo se abra la ficha correcta.
5. Que la vista técnica siga operativa.

## Publicación con Sites

Cuando haya cambios de producto:

1. Ejecutar `npm test`.
2. Confirmar que no se incluyen cambios ajenos ni `tmp/`.
3. Crear un commit específico.
4. Obtener una credencial temporal de escritura de Sites.
5. Empujar `HEAD` a `sites/main` sin guardar el token.
6. Empaquetar `dist/`, `.openai/hosting.json` y `drizzle/`. Si el archivo supera
   el tiempo de transferencia, guardar la versión sin `archive` para que Sites
   compile el commit ya empujado; no retirar originales descargables para
   reducir peso.
7. Guardar una nueva versión de Sites con el SHA exacto.
8. Desplegar la versión guardada. El modo de acceso de Sites continúa `custom`
   y limitado al propietario hasta que el workspace permita publicación a
   Internet. Cuando se habilite, cambiarlo a `public`; la aplicación seguirá
   cerrada por inicio de sesión y allowlist en D1.
9. Esperar a `status: succeeded`.
10. Abrir el mismo enlace de producción con un parámetro de actualización si
    el navegador conserva una versión anterior en caché.

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

`public/data-center/junio-2026/`

Archivo de Antonely:

- Origen:
  `C:\Users\Usuario1\OneDrive\Desktop\Antonely\Datos para Informe Jun-26.xlsx`
- Copia:
  `public/data-center/junio-2026/datos-para-informe-jun-26.xlsx`
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
- Los originales están en `public/data-center/julio-2026/`.

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
`public/data-center/julio-2026/araya-flujo-i-reprogramado.xlsx`.

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
  `public/data-center/junio-2026/fideicomiso/` y en una pestaña financiera
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
- Excel, PDF, PowerPoint, Word, MPP, DWG, imágenes y ZIP quedan catalogados y
  esperan su importador especializado o una lectura asistida. No se afirma que
  almacenar el original equivalga a interpretar sus datos.
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
- Migración: `drizzle/0007_ingestion_control_room.sql`.
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
- Nueva migración: `drizzle/0007_rapid_black_queen.sql`. Sólo crea
  `control_actions`, `control_action_activity` y `report_snapshots`; no repite
  la migración documental del punto 2.
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
- El Service Worker vigente usa `bricket-control-shell-v3` y una caché privada
  separada. Prepara el shell visitado, nunca responde desde caché a rutas API o
  de autenticación y borra ambas cachés al cerrar sesión.
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
  Excel, MPP, DWG o PowerPoint, muestran una pantalla de descarga sin abandonar
  la aplicación.
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
- PWA parcialmente offline: última interfaz visitada y activos ya cargados en
  modo de consulta. No se almacenan respuestas de API ni se permiten
  mutaciones sin conexión.
- Las notificaciones del sistema se generan mientras Bricket Control está
  activo o en segundo plano. No existe todavía un servidor de Web Push para
  despertar una aplicación completamente cerrada.
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
  `public/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf`.
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
  la caché privada y la biometría local y vuelve a validar el acceso.
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

- La bandeja de archivos colaborativos ya no trunca el histórico en 60
  registros. Todos los originales aparecen agrupados mediante acordeones de
  año y mes de subida; cada acordeón conserva su estado manual aunque la lista
  se refresque cada cinco segundos. El almacenamiento R2 ya utilizaba la ruta
  `araya/<area>/<YYYY>/<MM>/...`, por lo que no fue necesario mover ni perder
  ningún original.
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
  `build/sites-vite-plugin.ts` elimina `dist/client/data-center` en cada build
  y `public/.assetsignore` mantiene una segunda exclusión. No retirar estas dos
  barreras aunque los originales auditables continúen en el árbol fuente.
- Cloudflare conserva `assets.run_worker_first` selectivo para
  `/data-center/*`. `proxy.ts` y la ruta dinámica
  `app/data-center/[...path]/route.ts` exigen identidad ChatGPT, usuario activo
  en `app_users` y `financeAccess` en rutas financieras o del fideicomiso; la
  ruta autorizada recupera el original de R2. Los siete archivos que superan
  el límite de una petición se guardan en fragmentos privados y se transmiten
  de forma continua, con soporte de rangos y el mismo nombre/tipo del original.
  Las respuestas son `private, no-store` y no entran en la caché offline.
- El Service Worker está en la generación `v4`: borra las cachés `v3` al
  activarse y trata `/data-center/*` como red obligatoria, sin lectura ni
  escritura en Cache Storage. Esto elimina también cualquier copia que una
  instalación anterior hubiera conservado antes de privatizar los originales.
- El endpoint y el secreto temporales utilizados para la siembra inicial se
  eliminaron después de verificar los 23 documentos. Las nuevas cargas deben
  seguir entrando exclusivamente por `POST /api/files` y quedan en R2 desde
  su recepción.
- La carga principal y la del agente se redujeron a seleccionar un archivo y
  pulsar `Subir y procesar`; área, tipo, periodo y moneda se detectan. Los
  campos manuales siguen disponibles dentro de `Opciones avanzadas`.
- Todos los usuarios activos pueden subir; el original y su estado aparecen en
  la bandeja compartida en el siguiente refresco. Por seguridad, sólo un
  administrador puede publicar automáticamente una plantilla CSV/JSON del
  contrato vivo, y únicamente si contiene valores escalares, claves hijas,
  corte, área coherente y ninguna advertencia estructural. Las cargas de los
  demás usuarios y PDF/Excel/PowerPoint/Word/MPP/DWG/imagen quedan registradas
  para interpretación y revisión: no se afirma que cualquier documento libre
  actualice cifras por sí solo.
- Cuando una plantilla administrativa válida se publica, crea revisión,
  procedencia e historial; `GET /api/live-data` propaga las nuevas cifras,
  barras, gráficos, cronograma y elementos espaciales en un máximo de cinco
  segundos según las claves incluidas.
- Validación: build correcto, TypeScript sin errores, 37/37 pruebas aprobadas y
  lint sin errores; permanecen diez avisos no bloqueantes de imágenes HTML ya
  conocidas.

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
- Mantener Sites en modo público y conservar el contenido protegido por inicio
  de sesión, `app_users` y permisos server-side. Sólo un administrador puede
  gestionar usuarios.
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
