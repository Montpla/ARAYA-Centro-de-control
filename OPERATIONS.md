# Centro de Control ARAYA · Guía operativa

## Funcionamiento diario

1. Cargar el archivo desde `Centro de datos`, la cámara o el agente.
2. El servidor guarda primero el original en R2 `FILES` y después confirma el
   expediente en D1. Confirmar el área sólo si la detección no coincide.
3. El sistema elige automáticamente lector directo, conversión segura o lectura
   asistida según el formato. Los datos válidos se publican; la información nueva
   crea una sección provisional con fuente, evidencia y permisos de área.
4. El sistema publica cada dato válido y aísla cualquier entrada incompatible
   con un diagnóstico cerrado; una entrada defectuosa ya no bloquea el archivo
   completo ni queda indefinidamente pendiente.
5. Comprobar la nueva revisión en la Sala operativa y en la sección afectada.
6. Si se elimina o restaura un archivo, revisar la revisión de recomposición que
   el sistema crea y el valor anterior que vuelve a quedar vigente.

El refresco de cinco segundos consulta D1 y no usa tokens. Sólo la interpretación
semántica de un documento o una consulta al asistente usa la API de IA.

### Flujo automático definitivo

```text
[Carga o cámara]
      -> [Original privado e idempotente]
      -> [Lectores deterministas]
      -> [IA sólo completa huecos]
      -> [Área inferida por contenido]
      -> [Contrato + contraste dato a dato]
      -> [Publicación + gráficas + mapas]
      -> [Recibo visible + aviso + historial]
                    |
                    +-> dato incompatible: [diagnóstico aislado, sin bloquear]
                    +-> fallo real: [original conservado + acción concreta]
```

Reglas operativas:

- No es obligatorio elegir área ni renombrar el archivo. El nombre sólo sirve
  como primera pista; los datos que encuentran los lectores deciden el destino
  cuando la selección estaba en automático.
- Subir un documento protegido no concede acceso a Finanzas. La persona que lo
  aporta ve únicamente un recibo sin cifras y el equipo autorizado recibe la
  actualización en su sección.
- El recibo no desaparece solo: muestra publicados, ya vigentes, aislados,
  secciones nuevas, avisos y la única acción que corresponda.
- Las plantillas de cubicación, ventas y cronograma se descargan dentro del
  formulario de carga. No incluyen valores actuales y se rellenan únicamente
  en la columna `valor`.
- Cada mejora que cambia `CURRENT_INGESTION_VERSION` activa el reproceso de los
  expedientes anteriores en lotes pequeños. Reprocesar no duplica el original
  ni permite que un corte viejo sustituya otro más reciente.

### Cierre automático de cada carga

- La publicación automática es el comportamiento predeterminado aunque una
  cámara, integración o formulario sencillo no envíe un parámetro técnico.
- La confianza queda unida a `clave + valor`, no a la posición de una fila. Un
  reordenamiento de edificios/apartamentos o la eliminación de un duplicado no
  puede convertir por error un dato válido en confianza cero.
- Si el valor extraído ya coincide con el vigente, el archivo queda
  `integrado/sincronizado` sin crear otra revisión, otra notificación o una
  escritura repetida en el historial.
- Si un documento contiene datos válidos y otros incompatibles, los válidos se
  publican en el mismo batch atómico; las propuestas restantes quedan
  `descartado_automatico` con diagnóstico y el expediente cierra al 100 %.
- Un concepto nuevo crea una sección visual; los informes posteriores con el
  mismo título y área actualizan esa sección en vez de añadir otra cada mes.
- La ingesta interna puede publicar hechos financieros validados aunque quien
  cargó el documento no tenga permiso de lectura de Finanzas. Esto no concede
  acceso a la pantalla, al archivo ni a la API financiera: sólo separa el
  permiso para aportar un original fiable del permiso para consultar sus cifras.
- Un fallo real de almacenamiento, contrato transaccional o servicio externo sí
  conserva el original y pasa a `observado`; no se oculta como sincronizado.

## Formatos e interpretación

- CSV, JSON, XML de Project, XLS/XLSX y las tablas de DOCX/PPTX/PDF se leen por
  lectores directos cuando su estructura es reconocible. La lectura asistida
  completa huecos narrativos o visuales sin pisar el dato directo.
- PDF, PPT/PPTX, DOC/DOCX e imágenes pueden usar `OPENAI_API_KEY` para
  interpretación semántica. XLS/XLSX se mantienen en lectores deterministas:
  una hoja ya reconocida no se vuelve a enviar a un modelo.
- Actualizado el 13/08/2026: en el entorno de Cloudflare Workers vigente
  (ver `HANDOFF.md`, "Aviso importante: plataforma de despliegue vigente")
  `OPENAI_API_KEY` SÍ está configurada. La extracción normal usa
  `gpt-5.6-luna`; `gpt-5.6-terra` queda reservado para baja confianza,
  contradicciones o el modo avanzado del administrador. La nota anterior sobre la clave ausente en
  "Sites" describía un entorno distinto que no es el que se usa actualmente.
- ZIP se abre dentro de límites de seguridad y procesa cada documento interno.
  MPP se convierte automáticamente a XML de Project cada 15 minutos. DWG genera
  una vista PNG privada cada hora, enlazada al original y apta para lectura
  visual y consulta desde móvil/tableta.
- Guardar o interpretar no equivale a publicar. Cifras, gráficos, cronograma,
  edificios, apartamentos y urbanismo cambian únicamente tras una revisión
  publicada automáticamente y aparecen en un máximo de cinco segundos. Si no
  hay diferencias reales, no se genera una revisión vacía.

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
  apartamentos, disciplinas y áreas urbanas. El inventario vigente es de 77
  edificios posicionados y 462 apartamentos interactivos; los elementos aún no
  iniciados permanecen al 0 % y se colorean al publicar su avance.
- `Planificación`: avance físico, referencias del plan, paquetes desviados,
  criticidad y previsión de fin.
- `Observaciones`: diferencias conservadas entre fuentes, con acceso directo a
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

### Reglas de limpieza y precedencia (21/08/2026)

- El registro principal oculta por defecto versiones `superseded`, pero conserva
  el original, su historial y su trazabilidad. `includeDeleted` permite a un
  administrador auditar tambien esas versiones historicas.
- Los contadores de pendientes y discrepancias usan exclusivamente propuestas
  de la generacion vigente. Una observacion historica no se presenta como una
  conciliacion abierta ni como una accion activa.
- Para una misma clave gana primero la fecha de corte del negocio y despues la
  revision. Por ello, reprocesar tarde una semana antigua no puede sobrescribir
  el ultimo corte de Seguridad, Obra o Finanzas.
- Seguridad mantiene una serie S1-S4 que distingue valores de la semana y
  acumulados. La Curva S representa los meses futuros sin dato como `null`, no
  como un falso 0 % ejecutado.
- El resumen financiero se calcula desde el ultimo libro publicado de cuentas
  de coste; las etiquetas son periodo actual/anterior y ya no quedan fijadas a
  un mes concreto.
- El saneamiento reproducible esta en
  `scripts/production-cleanup-2026-08-21.sql`. No elimina archivos ni altera el
  avance fisico vigente; reclasifica duplicados, publica hechos conciliados y
  convierte la discrepancia critica del flujo de proveedores en una accion.

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

## Reprocesar y recuperar un informe (workflows en Actions)

Cada expediente conserva `ingestion_version`. Cuando mejora un lector, el cron
**Reprocesar archivos con lector nuevo** detecta los antiguos y reanaliza tres
por ciclo, sobre la misma fila y sin duplicar el original. También permanecen
estas herramientas manuales en **Actions** (requieren `DEPLOY_VERIFY`):

- **Reprocesar archivos con el pipeline actual** — re-analiza un archivo ya
  subido con la ingesta de hoy. Campos: `filtro` (parte del nombre), `formatos`
  (p. ej. `pptx`), `reemplazar` (0 = re-publica encima; 1 = retira el previo y
  re-sube como alta nueva), `aplicar` (0 = simula, 1 = publica), `debug` (1 =
  muestra el texto del error si la publicación no se confirma).
- **Diagnóstico del reproceso de julio** — muestra en qué estado quedó un
  archivo (revisión, resumen y **nombres** de clave; nunca valores).
- **Restaurar / Recuperar** — devuelven al panel un expediente retirado por un
  reemplazo que no llegó a publicar.

Regla: **simular siempre antes de aplicar**, y **nunca** imprimir cifras en los
logs; sólo nombres de clave, estados y metadatos.

## Operación técnica y publicación

> **Aviso (18/08/2026).** La plataforma vigente es **Cloudflare Workers**:
> `https://araya-centro-control.grupobricket.workers.dev`, con `npm run deploy`
> (typecheck, build, pruebas, `wrangler deploy` y verificación real contra
> producción). Los puntos de más abajo que hablan de Sites, del dominio
> corporativo y de la URL `chatgpt.site` describen una vía que no se ha tocado
> ni verificado desde el inicio del proyecto: **no asumir que sigue activa**.
> La cadena de migraciones tampoco acaba en la `0016`; ver `HANDOFF.md`.

- **Las tres claves de notificación (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`) van como Secret del Worker, nunca como variable de texto.**
  `wrangler deploy` conserva los secretos pero borra las variables de texto
  plano puestas a mano en el panel, así que una sola de ellas mal guardada
  apaga los avisos en el siguiente despliegue, sin error en ninguna parte. El
  despliegue lo comprueba y falla en rojo si faltan.
- La cadena de migraciones D1 llega hasta
  `drizzle/0025_yellow_bullseye.sql` y debe desplegarse junto con
  `drizzle/meta/_journal.json`. La `0024` versiona la ingesta y registra archivos
  derivados/superados; la `0025` añade `document_templates` e
  `ingestion_agent_runs`, memoria y trazabilidad del agente documental.
  Aplicar el journal completo antes de desplegar el Worker que usa esas tablas.
- Las escrituras críticas de publicación y baja/restauración usan batches
  atómicos acotados. Las recomputaciones son set-based, una publicación admite
  como máximo 250 cambios y ningún listado debe ejecutar una consulta por fila.
- La migración `0027_confused_rage.sql` añade el registro económico del
  asistente y de la ingesta, además del presupuesto mensual administrable.
- El agente documental normal usa como máximo dos iteraciones y dieciséis
  herramientas por documento; el escalado excepcional a Terra admite tres
  iteraciones. Los formatos conocidos siguen el lector determinista; la IA
  se usa para documentos narrativos, imágenes o huecos no cubiertos. Cada
  recorrido registra modelo, versión de prompt, herramientas, validación,
  tokens, coste estimado y resultado, pero no guarda preguntas, respuestas,
  razonamiento privado ni duplica el
  contenido del archivo. `OPENAI_API_KEY` continúa siendo un Secret del Worker.
- Una publicación correcta actualiza la plantilla de esa familia documental.
  Borrar o restaurar un archivo no se resuelve por la plantilla: el ciclo
  reversible existente vuelve a calcular el ganador efectivo desde el
  historial publicado, por lo que cifras y secciones dinámicas retroceden o
  reaparecen con su fuente real.
- Producción vigente:
  `https://araya-centro-control.grupobricket.workers.dev`. Fuente canónica:
  GitHub `Montpla/ARAYA-Centro-de-control`. El dominio corporativo (punto 7)
  está descartado por ahora; no cambiar DNS ni reactivar Sites.

## Continuidad

El estado técnico, las fuentes incorporadas, las decisiones de diseño y la
última publicación se mantienen en `HANDOFF.md`. Cualquier LLM que continúe el
trabajo debe leer primero `HANDOFF.md` —empezando por su aviso de plataforma y
por la sección fechada más reciente, donde están las trampas que ya costaron un
fallo—, después `AGENTS.md` si existe y esta guía. `.openai/hosting.json`
pertenece a la vía de Sites y sólo es relevante si se decide reactivarla.
