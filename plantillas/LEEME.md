# Plantillas de carga de datos

Rellena la columna **`valor`** y sube el archivo al Centro de datos, como
cualquier otro documento. No hace falta tocar nada más.

## Por qué existen

Un Excel o un PDF los lee la IA, que interpreta: normalmente acierta, pero
puede confundir un campo o no saber a qué edificio se refiere una cifra. Un CSV
con columnas `clave` y `valor` entra por otra vía, sin IA de por medio: **lo
que escribes es exactamente lo que se publica**. Es el camino a usar cuando
importa que el dato entre bien y a la primera.

## Cómo se rellenan

| clave | valor | descripcion | valor actual |
|---|---|---|---|
| `buildings.TH-14.progress` | **62,5** | TH-14 · avance ejecutado (%) | 3.1 |

- **`valor`** es la única columna que tienes que tocar.
- **`descripcion`** y **`valor actual`** son ayudas para orientarte; el sistema
  las ignora. `valor actual` es la cifra que hay publicada ahora mismo.
- **Una fila que dejes en blanco no se toca.** Puedes rellenar tres filas y
  subir el archivo entero: las demás se quedan como están.
- Los porcentajes admiten coma o punto (`62,5` y `62.5` valen igual).
- Las fechas van como `dd/mm/aaaa`.

## Qué hay en cada archivo

**Obra**

| Archivo | Para qué |
|---|---|
| `01-avance-edificios-*.csv` | Avance, previsto, desviación y fin previsto de cada edificio |
| `02-avance-apartamentos-*.csv` | Avance y fase de cada apartamento — es lo que **da color** a la implantación |
| `03-urbanismo.csv` | Avance de cada área de urbanismo |
| `04-curva-s-mensual.csv` | Plan mensual: previsto y ejecutado. De aquí sale el **avance físico global** |
| `05-resumen-proyecto.csv` | Los indicadores generales del proyecto |
| `06-paquetes-de-obra.csv` | Avance y desviación por paquete |
| `07-disciplinas.csv` | Avance por disciplina de construcción |
| `08-urbanismo-informe.csv` | Urbanismo según el informe mensual |

**Economía**

| Archivo | Para qué |
|---|---|
| `09-cxp-por-categoria.csv` | Cuentas por pagar por categoría |
| `10-cxp-vencimientos.csv` | Cuentas por pagar por antigüedad |
| `11-desglose-de-coste.csv` | Desglose de coste acumulado y del mes |
| `12-anticipos.csv` | Anticipos a proveedores |
| `14-proyeccion-financiera.csv` | Ingresos, costes, neto y acumulado por mes |
| `15-financiacion.csv` | Procesos de financiación |
| `16-cubicaciones.csv` | Cubicaciones medidas y contabilizadas |
| `18-balance-fideicomiso.csv` | Balance, patrimonio y balance de comprobación del fideicomiso |
| `19-resultados-fideicomiso.csv` | Estado de resultados mensual y acumulado del fideicomiso |
| `20-flujo-mensual-finanzas.csv` | Flujo mensual reprogramado: total, Urbanismo y Edificios |

**Comercial**

| Archivo | Para qué |
|---|---|
| `17-ventas-por-modelo.csv` | Unidades vendidas por modelo |
| `18-ventas-por-ubicacion.csv` | Ventas por ubicación |
| `19-morosidad.csv` | Clientes e importes en mora |

Los edificios y apartamentos se reparten automáticamente en tantos archivos
como sean necesarios porque cada carga admite un máximo de 250 filas. Puedes
subirlos por separado y en cualquier orden.

Las cifras económicas y comerciales las puede entregar cualquier usuario que
tenga habilitado **Entregar documentos financieros**. Ese permiso no permite
abrir ni consultar las cifras: el administrador concede por separado
**Consultar Finanzas** y **Aprobar publicaciones financieras**.

Las plantillas financieras se comprueban antes de publicar. El balance debe
cumplir `activo = pasivo + patrimonio`; el resultado debe cumplir `ingresos -
gastos = resultado`; el balance de comprobación debe tener débitos y créditos
iguales; y cada mes del flujo debe cumplir `total = urbanismo + edificios`.
Si una comprobación falla, sólo se aísla el grupo afectado y el recibo explica
la diferencia. El resto de datos seguros del mismo archivo sigue su curso.

La moneda indicada al cargar el documento se conserva como origen. Las claves
terminadas en `Dop` se guardan en pesos dominicanos y las terminadas en `Usd`
en dólares, con la conversión y el tipo aplicado registrados en el recibo.

## Cómo se regeneran

Si cambian los edificios o aparecen campos nuevos:

```
node scripts/generar-plantillas.mjs
```

Se rehacen desde el modelo real, así que nunca se quedan desfasadas.

## Un detalle importante

Los edificios se nombran **como los nombra la obra**: `TH-14`, nunca `14` a
secas. Los 26 edificios no están guardados en orden, así que un número suelto
significa "posición en la lista" y apunta a otro edificio distinto. Las
plantillas ya traen el nombre correcto; si añades filas a mano, respeta ese
formato.
