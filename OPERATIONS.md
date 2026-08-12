# Centro de Control ARAYA · Guía operativa

## Funcionamiento diario

1. Cargar el archivo desde `Centro de datos`, la cámara o el agente.
2. El servidor guarda primero el original en R2 `FILES` y después confirma el
   expediente en D1. Confirmar el área sólo si la detección no coincide.
3. CSV/JSON conforme al contrato vivo sigue el importador determinista. Los
   formatos semánticos sólo se interpretan si existe `OPENAI_API_KEY`; cualquier
   resultado que no cumpla contrato, confianza o permisos queda pendiente.
4. En una excepción, comparar `Valor vigente → Valor propuesto` y aprobar,
   observar o rechazar desde el expediente.
5. Comprobar la nueva revisión en la Sala operativa y en la sección afectada.
6. Si se elimina o restaura un archivo, revisar la revisión de recomposición que
   el sistema crea y el valor anterior que vuelve a quedar vigente.

El refresco de cinco segundos consulta D1 y no usa tokens. Sólo la interpretación
semántica de un documento o una consulta al asistente usa la API de IA.

## Formatos e interpretación

- CSV y JSON estructurados se leen de forma determinista; una revisión sólo se
  publica si sus claves, valores, corte, área y permisos cumplen el contrato.
- PDF, XLS/XLSX, PPT/PPTX, DOC/DOCX e imágenes requieren `OPENAI_API_KEY`
  para interpretación semántica automática. Sin la clave se conserva el
  original y queda pendiente de extracción/revisión; no cambia el dashboard.
- Actualizado el 13/08/2026: en el entorno de Cloudflare Workers vigente
  (ver `HANDOFF.md`, "Aviso importante: plataforma de despliegue vigente")
  `OPENAI_API_KEY` SÍ está configurada y la extracción semántica funciona en
  producción con `gpt-5.6-terra`. La nota anterior sobre la clave ausente en
  "Sites" describía un entorno distinto que no es el que se usa actualmente.
- DWG, MPP y ZIP se pueden custodiar y abrir/descargar, pero no se interpretan.
- Guardar o interpretar no equivale a publicar. Cifras, gráficos, cronograma,
  edificios, apartamentos y urbanismo cambian únicamente tras una revisión
  publicada y aparecen en un máximo de cinco segundos.

## Visor documental y guía de uso

- Pulsar `Abrir documento` muestra los formatos compatibles dentro del Centro
  de Control, sin abandonar la sección de trabajo.
- En Office, DWG o MPP, pulsar `Abrir con el visor del dispositivo` entrega el
  archivo al visor o aplicación compatible instalada. La ficha interna conserva
  siempre X/Cerrar y abrir el expediente no fuerza una descarga.
- `Descargar` y `Descargar copia` son acciones independientes y opcionales.
- La X de la esquina, `Cerrar` o la tecla `Escape` recuperan la pantalla desde
  la que se abrió el archivo.
- La guía resumida para el personal está en `Centro de datos` y, en móvil, en
  `Más → Guía de uso`. Incluye funciones, flujo documental, permisos,
  instalación, cámara, avisos, biometría y trabajo parcial sin conexión.
- Los documentos financieros siguen exigiendo el permiso correspondiente,
  tanto al abrirlos como al descargarlos.

## Sala operativa

La Sala operativa se encuentra debajo del Resumen ejecutivo y se actualiza cada
cinco segundos.

- `Calidad y cobertura`: estado de cargas colaborativas, propuestas,
  discrepancias y puntos vivos por área.
- `Plano operativo`: integridad de coordenadas, edificios integrados,
  apartamentos, disciplinas y áreas urbanas.
- `Planificación`: avance físico, referencias del plan, paquetes desviados,
  criticidad y previsión de fin.
- `Conciliaciones`: diferencias conservadas entre fuentes, con acceso directo a
  la sección responsable.
- `Informes`: archivo inmutable de informes semanales y mensuales, ligado a la
  revisión usada en su generación.
- `Acciones`: responsable, prioridad, fecha objetivo, estado, comentarios y
  actividad.

El archivo documental carga 75 expedientes recientes, con máximo 200 por
petición, y los agrupa por año y mes. `Cargar archivos anteriores` añade páginas
con cursor estable. El sondeo de cinco segundos consume un feed de cambios y
fusiona altas, revisiones, bajas y reclasificaciones sin volver a descargar el
histórico ni descartar meses ya abiertos. Los totales proceden de agregados D1
sobre todo el conjunto que el usuario puede ver.

## Permisos

- El enlace exterior del Centro de Control es público para evitar una segunda
  lista de invitados. El contenido continúa protegido: cada persona debe
  iniciar sesión y su correo debe figurar activo en `Usuarios y accesos`.
- Todos los usuarios autorizados pueden consultar controles no financieros y
  crear acciones dentro de su ámbito.
- Sólo un administrador puede crear, editar, desactivar, eliminar o restaurar
  usuarios. También es el único que puede conceder el rol de administrador o
  el acceso financiero.
- `Eliminar acceso` revoca la entrada y archiva la ficha; conserva la actividad
  y la auditoría. El propio administrador no puede eliminarse ni dejar el
  sistema sin al menos un administrador activo.
- El creador, la persona asignada o un administrador pueden actualizar una
  acción.
- Sólo un administrador puede asignar una acción a otra persona.
- Finanzas, sus documentos, acciones e informes completos requieren el permiso
  financiero.
- Los informes completos se generan únicamente para personas con acceso
  financiero.

## Reglas de datos

- No inventar valores, fechas, responsables ni posiciones en el plano.
- Los importes sin moneda declarada se tratan como DOP.
- La presentación empieza en USD y conserva DOP como moneda de origen.
- El avance físico, el avance MPP y la Curva S son indicadores distintos.
- Las diferencias entre fuentes se muestran como conciliaciones; no se
  sobrescriben silenciosamente.
- Los informes archivados conservan su revisión. No deben presentarse como una
  lectura del estado actual.

## Comprobación ante una incidencia

1. Revisar el indicador de sincronización.
2. Abrir `Calidad y cobertura` y comprobar la última revisión.
3. Consultar el expediente del archivo fuente.
4. Verificar que la propuesta fue aprobada y no quedó observada.
5. Confirmar que el usuario tiene permiso para el área.
6. Si el problema continúa, conservar la hora, la sección, el archivo y la
   revisión para diagnóstico.

## Funciones del móvil y la tablet

- `Avisos y seguridad` se abre desde la campana superior o desde el menú
  `Más`. La autorización de notificaciones siempre la concede la persona desde
  el propio dispositivo.
- `Hacer foto` abre la cámara trasera y lleva la imagen al formulario de carga.
  Hay que revisar el área, fecha de corte y descripción antes de crear el
  expediente.
- La biometría se activa por dispositivo. Usa el método seguro que ofrezca el
  sistema operativo y no altera la sesión ni los permisos financieros.
- Si se necesita recuperar el acceso biométrico, la aplicación exige conexión,
  elimina la copia local y obliga a iniciar sesión de nuevo.
- Sin internet se conserva la vista que ya permanecía abierta. Volver a entrar
  o recargar exige conexión para verificar la identidad; API, cargas, cambios,
  informes y agente permanecen desactivados hasta que vuelva la red.
- Cerrar sesión elimina las cachés locales privadas. Las notificaciones del
  sistema no usan tokens del agente.
- El Service Worker vigente es `v5`: sólo cachea activos estáticos públicos;
  nunca guarda navegaciones autenticadas, RSC, API, documentos ni datos vivos.

## Avisos y ciclo reversible de archivos

- La campana se sincroniza cada cinco segundos y conserva lectura por usuario.
  Con permiso del dispositivo, Web Push entrega avisos aunque la app no esté en
  primer plano. Cada móvil, tablet u ordenador debe activar los avisos una vez.
- Cargas, publicaciones, revisiones, acciones, informes, proveedores, usuarios,
  fotos de perfil y bajas/restauraciones generan eventos. Las conexiones nuevas
  se notifican a todos los usuarios autorizados; los eventos financieros solo
  llegan a personas con permiso financiero.
- Cada aviso queda en un outbox persistente y su entrega se controla por
  dispositivo. Un teléfono sin cobertura no duplica los avisos ya entregados a
  otros equipos y se reintenta sin bloquear eventos posteriores.
- `/api/presence` registra la sesión activa y genera un aviso de conexión para
  todos los usuarios autorizados. Web Push requiere permiso explícito en cada
  móvil, tablet u ordenador y revalida usuario y permiso financiero al entregar.
- `Eliminar` retira el archivo del modelo vivo, pero no destruye el original ni
  su historial. El dashboard recupera automáticamente la última contribución de
  otro archivo activo. `Restaurar` vuelve a incorporarlo respetando revisiones
  posteriores.
- Si una interpretación no alcanza confianza suficiente, el original queda
  guardado y visible con revisión pendiente. Nunca se debe volver a subir para
  “forzar” una cifra: hay que revisar el expediente o aportar un formato más
  explícito.

## Operación técnica y publicación

- La cadena de migraciones D1 llega hasta
  `drizzle/0016_outstanding_stark_industries.sql` y debe desplegarse junto con
  `drizzle/meta/_journal.json`. La `0016` añade índices compuestos para la
  paginación por creación y el feed por actualización.
- Las escrituras críticas de publicación y baja/restauración usan batches
  atómicos acotados. Las recomputaciones son set-based, una publicación admite
  como máximo 250 cambios y ningún listado debe ejecutar una consulta por fila.
- URL técnica: `https://araya-centro-control.enriquemontesplaza.chatgpt.site`.
  Es la dirección para la prueba de humo hasta validar el dominio corporativo.
- `https://www.proyectosgrupobricket.com/` está reservado en Sites, pero sigue
  pendiente del DNS de Nominalia. `www` aún apunta a Railway. El CNAME de
  `www.proyectosgrupobricket.com` debe cambiarse a
  `custom-domains.chatgpt.site.` y publicar estos TXT:
  `_openai-site-verification.www.proyectosgrupobricket.com` =
  `openai-site-verification=ReIYEqnjHes6RI0bLxmvNyvX_4zHPvwez1eDmc6Z2WE` y
  `_cf-custom-hostname.www.proyectosgrupobricket.com` =
  `fafd06b2-640d-4bba-8c7b-36b7151c87bd`.
- No anunciar el dominio corporativo como activo hasta que Sites confirme DNS
  y SSL y se complete una prueba externa de login, carga, apertura y cierre.
- La infraestructura de Sites es pública para alcanzar el login; los datos
  siguen protegidos por identidad, `app_users` y permisos server-side.

## Continuidad

El estado técnico, las fuentes incorporadas, las decisiones de diseño y la
última publicación se mantienen en `HANDOFF.md`. Cualquier LLM que continúe el
trabajo debe leer primero `HANDOFF.md`, `AGENTS.md`,
`.openai/hosting.json` y esta guía.
