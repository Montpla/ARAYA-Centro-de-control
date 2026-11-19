# Arreglar una carga que no entró bien en el Centro de Control

Te lanza `.github/workflows/verificar-carga.yml` porque la verificación automática
de un archivo recién subido encontró una **anomalía**. El diagnóstico está en
`.verificacion/diagnostico.md` (en la raíz del repositorio). Léelo primero.

Trabajas solo y sin nadie mirando: el dueño del proyecto está en España y la
obra en República Dominicana. Tu trabajo es averiguar por qué el archivo no
entró bien y, si es un fallo del programa, corregir el código. El workflow se
encarga después de fusionar, desplegar, reprocesar el archivo y avisar.

## Reglas que no se rompen nunca

- Escribe en **español de España** (commits, PR, comentarios, mensajes).
- **Nunca imprimas ni escribas importes de dinero** (montos, saldos, cifras de
  facturas, cubicaciones en pesos o dólares) en registros, commits, PR ni
  issues. Sí puedes citar nombres de clave, motivos y porcentajes de avance.
- **No modifiques datos de producción a mano.** Nada de SQL contra D1 ni de
  llamadas a la API que publiquen, aprueben, borren o reprocesen. Todo arreglo
  va por código + pruebas; el workflow reprocesa después.
- No toques secretos ni los escribas en ningún archivo.
- No hagas `git push --force` ni reescribas historia. No toques `main`
  directamente: trabaja en la rama que se te indica.
- No desactives, saltes ni debilites pruebas para que pasen.
- No añadas el directorio `.verificacion/` a ningún commit.

## Cómo diagnosticar

Tienes acceso de lectura a producción con las credenciales del entorno
(`DEPLOY_VERIFY_EMAIL`, `DEPLOY_VERIFY_PIN`):

- `node scripts/verificar-carga.mjs` con `FILE_ID=<id> NOTIFICAR=0` repite la
  verificación (no avisa a nadie).
- `HORAS=24 node scripts/comprobar-cargas.mjs` resume las cargas recientes.
- `node scripts/diagnostico-actualizacion.mjs` enseña qué claves escribió cada
  revisión y el avance vigente.
- El original se descarga con una sesión iniciada en
  `https://araya-centro-control.grupobricket.workers.dev/api/auth/login`
  (POST de formulario `email`, `pin`) y luego
  `GET /api/files?download=<id>`. Guárdalo fuera del repositorio
  (por ejemplo en `$RUNNER_TEMP`) y no lo añadas a git.

Piezas del programa que suelen estar implicadas:

- `app/api/files/route.ts`: recepción, lectura, publicación automática y
  motivos de descarte (`rejectionReason`, `isSafeLiveValue`,
  `isSafeAutomaticStructuredUpdate`).
- `lib/ingestion.ts`: clasificación, `detectPeriod` (fecha de corte) y la
  lectura determinista de hojas de cálculo (cubicación, Curva S, etc.).
- `lib/ai-document-extraction.ts`: lectura asistida de PDF y presentaciones.
- `lib/live-data-contract.ts`: forma que debe tener cada dato vivo.
- `lib/effective-live-data.ts`: qué valor gana cuando hay varios.
- `lib/upload-verification.ts`: las reglas de la propia verificación.

Motivos de descarte que son **correctos** y no hay que "arreglar": un dato con
corte anterior al ya publicado no debe pisar al vigente.

## Qué hacer según lo que encuentres

1. **Fallo del programa claro** (un lector que no reconoce un formato, una
   validación que rechaza un dato válido, un corte mal calculado…):
   - Corrige la causa en el código, no el síntoma.
   - Añade o amplía una prueba en `tests/` que falle sin tu cambio.
   - Ejecuta `npm run typecheck` y `node --test tests/*.mjs`; todo en verde.
   - Haz commit en la rama indicada y súbela con `git push -u origin <rama>`.
   - Abre un PR **en borrador** contra `main` con `gh pr create --draft`,
     explicando en español qué fallaba, por qué y qué cambia.
   - Escribe `.verificacion/decision.json`:
     `{"accion": "arreglado", "pr": <número>, "resumen": "<una frase>"}`.

2. **Dudoso o fuera de tu alcance** (el propio documento está mal, dos
   fuentes se contradicen y no sabes cuál vale, hace falta una decisión del
   negocio, o el arreglo sería un cambio grande de arquitectura):
   - No cambies código.
   - Escribe `.verificacion/decision.json`:
     `{"accion": "dudoso", "resumen": "<qué pasa y qué decisión hace falta, en dos o tres frases>"}`.

3. **Falsa alarma** (la verificación se equivocó y la carga está bien):
   - Si la regla de la verificación es la que falla, corrígela como en el
     caso 1. Si no, escribe
     `{"accion": "sin_accion", "resumen": "<por qué está bien>"}`.

Si la anomalía mezcla las dos cosas (por ejemplo, un retroceso que es una
corrección legítima y, al investigarlo, encuentras un fallo real en otra
parte), **arregla el fallo real y usa `"arreglado"`**, explicando en el resumen
qué parte era legítima. `"dudoso"` es sólo para cuando no has cambiado código.
Si has hecho commits, abre siempre el PR.

El aviso al móvil sólo muestra unas 400 letras: empieza el resumen por lo
importante (qué fallaba y qué has hecho).

Escribe siempre `.verificacion/decision.json` antes de terminar.
