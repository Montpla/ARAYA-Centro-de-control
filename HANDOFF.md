# ARAYA Centro de Control — Estado de continuidad

Actualizado: 28/07/2026
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
- Última versión publicada: 11.
- Commit desplegado: `5459e738eea782049ec8a72410432966ef4feddb`.
- Acceso: privado, únicamente para el propietario configurado en Sites.
- Rama y remoto de publicación: rama `main`, remoto `sites`.

## Estado funcional

El dashboard dispone de estas vistas:

1. Resumen ejecutivo.
2. Planificación.
3. Implantación general.
4. Edificios.
5. Viviendas.
6. Urbanismo.
7. Cronología.
8. Proveedores.
9. Métricas y finanzas.
10. Centro de datos.
11. Agente IA de consulta, en modo de solo lectura.

La implantación general incluye:

- Plano visual arquitectónico como vista predeterminada.
- Plano técnico original como vista alternativa.
- 26 edificios interactivos.
- 156 viviendas interactivas, seis por edificio.
- Colores de estado para terminada, en curso, pendiente y bloqueada.
- Fichas individuales de vivienda.
- Fichas conjuntas de edificio.
- Seis puntos interactivos de urbanismo.

El cronograma se representa con líneas:

- Línea gris para el plan operativo.
- Línea naranja para el avance ejecutado.
- Un punto por cada mes del plan.
- Puntos ejecutados únicamente en meses con datos reales.
- No extender ni inventar valores ejecutados futuros.

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
- 156 viviendas en seguimiento.
- Urbanismo ejecutado: 18,28%.
- Urbanismo planificado: 16,18%.
- La moneda de cubicaciones no está identificada en la fuente y no debe
  presentarse como USD ni convertirse sin confirmación.

Edificios con datos:

- TH-01 a TH-18.
- TH-70 a TH-77.

## Fuentes y activos

Fuente DWG original del usuario:

`C:\Users\Usuario1\Downloads\Telegram Desktop\002 - IMPLANTACIÓN GENERAL.dwg`

Copia incorporada al Centro de datos:

`public/data-center/002-implantacion-general.dwg`

Activos principales:

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

Las 26 posiciones de `visualPlanCoordinates` fueron calibradas contra el centro
real de cada cubierta de la imagen de 982 × 1602 píxeles. No volver a desplazar
las viviendas sin una captura anotada del usuario.

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
- `app/globals.css`: sistema visual y diseño responsive.
- `app/api/agent/route.ts`: consultas del agente.
- `app/api/dashboard/route.ts`: lectura y creación de métricas/proveedores.
- `tests/rendered-html.test.mjs`: pruebas de navegación, fuentes, datos y
  componentes.
- `drizzle/`: esquema y migraciones de D1.
- `.openai/hosting.json`: identificador de Sites y bindings lógicos.

## Validación

Comando habitual:

`npm test`

Este comando ejecuta el build de vinext y las pruebas. En el último corte:

- 4 pruebas superadas.
- 0 fallos.
- La compilación de producción fue correcta.

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
6. Empaquetar `dist/`, `.openai/hosting.json` y `drizzle/`.
7. Guardar una nueva versión de Sites con el SHA exacto.
8. Desplegar de forma privada.
9. Esperar a `status: succeeded`.
10. Abrir el mismo enlace de producción con un parámetro de actualización si
    el navegador conserva una versión anterior en caché.

Nunca registrar credenciales, tokens ni enlaces con autenticación incrustada.

## Criterios de continuidad

- Mostrar únicamente datos aportados o derivados de las fuentes.
- Marcar campos futuros como pendientes.
- Conservar el DWG original descargable.
- Mantener el masterplan visual y el plano técnico.
- No cambiar la geometría visual para resolver un problema de coordenadas.
- Mantener accesibilidad mediante títulos y etiquetas `aria`.
- Conservar el dashboard privado salvo instrucción explícita del usuario.
- No borrar archivos históricos ni cambios ajenos.

## Próximos pasos probables

El usuario seguirá entregando datos para completar:

- Avance por vivienda.
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
