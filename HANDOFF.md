# ARAYA Centro de Control — Estado de continuidad

Actualizado: 30/07/2026
Zona horaria del usuario: America/La_Paz
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
- Última versión publicada: 28.
- Commit desplegado: `eef00e7f0d6a6a22c87898992100f457bde95daa`.
- Versión de Sites:
  `appgprj_6a68f2b048e48191840a253b2285feb7~appgver_e5fe2c0afbb88191bbd393943bfe176b`.
- Despliegue:
  `appgdep_6a6b633fa6e0819193986dc8ff9c6b35` (`succeeded`).
- Acceso de infraestructura: privado, únicamente para el propietario configurado
  en Sites. La solicitud de cambiarlo a `public` devolvió
  `sites_publish_disabled`: este espacio de trabajo todavía no permite publicar
  Sites hacia Internet.
- Rama y remoto de publicación: rama `main`, remoto `sites`.

## Estado funcional

El dashboard dispone de estas vistas:

1. Resumen ejecutivo.
2. Planificación.
3. Implantación general.
4. Edificios.
5. Apartamentos.
6. Urbanismo.
7. Ventas y cobranza.
8. Finanzas.
9. Cronología.
10. Proveedores.
11. Seguridad y permisos.
12. Centro de datos.
13. Agente IA de consulta y carga documental controlada.
14. Usuarios y accesos, visible únicamente para administradores.

`navItems` es la única fuente de este orden. Alimenta tanto la barra lateral de
ordenador como el panel completo de navegación de tablet y móvil. No mantener
listas duplicadas con orden diferente.

El acceso al Centro de Control requiere una identidad verificada de ChatGPT y
un alta activa en la tabla `app_users`. Bricket no almacena ni gestiona
contraseñas propias:

- El administrador inicial se aprovisiona desde la variable de producción
  `BOOTSTRAP_ADMIN_EMAIL`.
- Un administrador puede crear, activar o desactivar usuarios y promoverlos a
  administrador desde `Usuarios y accesos`.
- Cada usuario tiene un área principal. El resumen ejecutivo adapta su bloque
  de prioridad y ordena las alertas para Dirección, Planificación, Obra,
  Urbanismo, Comercial, Finanzas, Compras, Seguridad, Legal o Diseño.
- El permiso `financeAccess` se concede o revoca individualmente. Los
  administradores lo reciben siempre.
- Sin ese permiso, Finanzas muestra una pantalla de acceso restringido y las
  API de cifras, archivos y respuestas financieras devuelven `403`; no es sólo
  una pestaña ocultada en el navegador.
- `access_audit` conserva cada alta y cambio de perfil, estado o permiso.

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

La aplicación ya exige identidad ChatGPT y pertenencia activa a `app_users`
antes de renderizar el dashboard. Sin embargo, Sites conserva de momento una
segunda barrera externa limitada al propietario porque la publicación a Internet
está deshabilitada para el workspace. Para que los usuarios creados por el
administrador puedan alcanzar el inicio de sesión, un administrador del espacio
de trabajo deberá habilitar esa política; después, cambiar Sites a `public`.
Aunque Sites sea público, el contenido seguirá cerrado por la autenticación y el
allowlist de D1 de la propia aplicación.

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
- La carga normal y la carga mediante el agente permiten tomar una foto con la
  cámara trasera del móvil.
- `public/manifest.webmanifest` y `public/sw.js` permiten instalar el Centro de
  Control desde el navegador compatible. El service worker sólo conserva el
  manifiesto y activos de marca: no cachea HTML, API, cifras, archivos privados
  ni respuestas del agente.
- `app/layout.tsx` declara el manifiesto, icono Bricket, modo Apple web app,
  color de interfaz y `viewport-fit=cover`.

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
- `tests/rendered-html.test.mjs`: pruebas de navegación, fuentes, datos y
  componentes.
- `drizzle/`: esquema y migraciones de D1.
- `drizzle/0004_organic_krista_starr.sql`: usuarios autorizados y auditoría de
  accesos.
- `drizzle/0005_dapper_silver_surfer.sql`: área del usuario, recorrido de
  procesamiento del archivo e historial persistente de datos vivos.
- `.openai/hosting.json`: identificador de Sites y bindings lógicos.

## Validación

Comando habitual:

`npm test`

Este comando ejecuta el build de vinext y las pruebas. En el último corte:

- 21 pruebas superadas.
- 0 fallos.
- La compilación de producción fue correcta.
- `npm run lint` termina sin errores; mantiene ocho avisos conocidos por el
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

- `Proveedores`: buscador, listado maestro interactivo, ficha de proveedor,
  facturas consolidadas, detalle de vencimiento e imputaciones. El API exige
  acceso financiero y se refresca cada cinco segundos.
- `Edificios`: disciplinas, retrasos de superestructura y pedidos vencidos.
- `Urbanismo`: indicador físico-financiero separado del 4% de actividades
  terminadas, avance por especialidad y retrasos de inicio.
- `Planificación`: Curva S exacta del informe y acciones recomendadas.
- `Centro de datos`: 10 fuentes, 8 descargas, carga colaborativa, versiones y
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
- Conservar el dashboard privado salvo instrucción explícita del usuario.
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
