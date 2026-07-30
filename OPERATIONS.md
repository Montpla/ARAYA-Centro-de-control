# Centro de Control ARAYA · Guía operativa

## Funcionamiento diario

1. Cargar el archivo desde `Centro de datos` o desde el agente.
2. Confirmar proyecto, área, tipo documental, periodo y moneda.
3. Revisar las propuestas en la bandeja de validación.
4. Comparar siempre `Valor vigente → Valor propuesto`.
5. Aprobar, observar o rechazar desde el expediente. El agente no toma esta
   decisión.
6. Comprobar la nueva revisión en la Sala operativa y en la sección afectada.

El refresco de cinco segundos consulta la base de datos y no usa tokens. El
agente sólo consume recursos de IA cuando se le formula una consulta o se le
pide interpretar un formato no estructurado.

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

## Permisos

- Todos los usuarios autorizados pueden consultar controles no financieros y
  crear acciones dentro de su ámbito.
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

## Continuidad

El estado técnico, las fuentes incorporadas, las decisiones de diseño y la
última publicación se mantienen en `HANDOFF.md`. Cualquier LLM que continúe el
trabajo debe leer primero `HANDOFF.md`, `AGENTS.md`,
`.openai/hosting.json` y esta guía.
