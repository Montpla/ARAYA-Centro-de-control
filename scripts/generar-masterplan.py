"""Genera las dos vistas y sus coordenadas desde la geometría extraída del DWG.

Los trazados se conservan a precisión de extracción. Los polígonos de relleno
se unen a una malla de un decímetro para cerrar las discontinuidades del CAD;
son un tratamiento gráfico y nunca sustituyen los contornos originales.
"""
from pathlib import Path
import json, html

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'scripts/data/masterplan-20261119.json').read_text(encoding='utf-8'))
X0,Y0,X1,Y1=data['bounds'];S=data['scale'];P=data['padding']
W=(Y1-Y0)*S+2*P;H=(X1-X0)*S+2*P
def point(x,y):return ((y-Y0)*S+P,(x-X0)*S+P)
def pct(x,y):
 a,b=point(x,y);return {'x':round(a/W*100,5),'y':round(b/H*100,5)}
def path(points,close=False):
 return ' '.join(('M' if i==0 else 'L')+f'{a:.2f},{b:.2f}' for i,(a,b) in enumerate(point(*v[:2]) for v in points))+(' Z' if close else '')
def rect(bounds,fill,stroke='none',width=.7,extra=''):
 x0,y0,x1,y1=bounds;x,y=point(x0,y0)
 return f'<rect x="{x:.2f}" y="{y:.2f}" width="{(y1-y0)*S:.2f}" height="{(x1-x0)*S:.2f}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" {extra}/>'

features=[
 ('cancha','Cancha múltiple','Deporte',749.5,4021,'Cancha múltiple del eje central norte; se conserva el trazado deportivo del DWG.'),
 ('salon-social','Salón social','Servicios comunes',775,4021,'Salón social de una planta, al sur de la cancha múltiple.'),
 ('parque-infantil','Parque infantil','Parques',791,4021,'Zona de juegos infantiles entre el salón social y el gimnasio.'),
 ('gimnasio','Gimnasio','Servicios comunes',817,4021,'Gimnasio situado en el eje central, al norte de la piscina deportiva.'),
 ('piscina-deportiva','Piscina deportiva','Piscinas',840.3,4020.5,'Vaso longitudinal de uso deportivo. Se conservan su contorno y carriles del plano.'),
 ('edificio-auxiliar','Edificación auxiliar','Servicios comunes',863,4021,'Edificación situada entre los dos sectores de piscinas. El DWG no aporta un rótulo de uso inequívoco.'),
 ('piscina-recreativa','Piscina recreativa','Piscinas',886,4025,'Piscina de contorno orgánico situada al sur de la piscina deportiva, con su entorno de estancia.'),
 ('parque-abierto','Parque abierto','Parques',925,4027,'Parque abierto del eje central sur, próximo a la glorieta de acceso.'),
 ('tanque-elevado','Tanque elevado','Instalaciones',870,4127.5,'Reserva para tanque elevado en el borde oriental del conjunto.'),
 ('zona-mascotas','Zona de mascotas','Parques',875,4112.5,'Zona PET identificada junto al extremo oriental de la urbanización.'),
 ('comercio','Comercio','Accesos y comercio',982,4061,'Sector comercial y su acceso propio desde la calle Las Cayenas.'),
 ('porteria','Portería','Accesos y comercio',995.8,4034.5,'Control de acceso del proyecto, junto a la glorieta y al eje central.'),
 ('plazoleta','Plazoleta','Accesos y comercio',1014.4,4039.5,'Espacio de acceso rotulado como plazoleta en el DWG.'),
 ('acceso','Acceso ARAYA','Accesos y comercio',1019.5,4037.3,'Ingreso desde la calle Las Cayenas, diferenciado de la salida.'),
 ('salida','Salida ARAYA','Accesos y comercio',1025.5,4026.1,'Salida del proyecto hacia la calle Las Cayenas.'),
 ('cuartos-tecnicos','Cuartos técnicos','Instalaciones',1017,4010.5,'Sector de cuartos técnicos al sur de los primeros edificios.'),
 ('cuarto-empleados','Cuarto de empleados','Instalaciones',1015,3940.5,'Cuarto de empleados en la franja de servicios del extremo suroeste.'),
 ('basuras','Cuarto de basuras','Instalaciones',1015.5,3934,'Recinto de basuras en la franja de servicios del extremo suroeste.'),
 ('tratamiento-aguas','Tratamiento de aguas residuales','Instalaciones',1037,3940,'Planta de tratamiento de aguas residuales identificada en el DWG.'),
 ('cesion-publica','Cesión pública institucional','Reservas del plano',1025,3974,'Superficie rotulada como cesión pública institucional. Se conserva su alcance gráfico.'),
]
layout={'source':data['name'],'sha256':data['sha256'],'width':W,'height':H,
 'buildings':{b['code']:{**pct((b['bounds'][0]+b['bounds'][2])/2,(b['bounds'][1]+b['bounds'][3])/2),'bounds':b['bounds']} for b in data['buildings']},
 'features':[{'id':i,'name':n,'category':c,**pct(x,y),'detail':d} for i,n,c,x,y,d in features],
 'parkingCount':len(data['parking']),'treeCount':len(data['trees'])}
(ROOT/'lib/masterplan-layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

for mode in ['visual','tecnico']:
 visual=mode=='visual'
 out=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
      '<title>ARAYA · implantación del master plan actualizado</title>',
      '<desc>Geometría del DWG aportado el 19 de noviembre de 2026: edificios, aparcamientos, piscinas, parques y servicios comunes.</desc>',
      f'<rect width="{W}" height="{H}" fill="'+('#f6f2e9' if visual else '#fff')+'"/>']
 # Islas y zonas de estancia: relleno gráfico bajo el trazado original.
 if visual:
  for fill in sorted(data['fills'],key=lambda f:f['area'],reverse=True):
   if fill['area']<8:continue
   pts=fill['points'];cx=sum(p[0] for p in pts)/len(pts);cy=sum(p[1] for p in pts)/len(pts)
   color='#e9e7d8'
   if fill['area']>500:color='#dce5cf'
   if 734<cx<765 and 4012<cy<4031:color='#d4b58a' if fill['area']>150 else '#76a69e'
   if 828<cx<853 and 4016<cy<4025 and fill['area']>90:color='#65bcd4'
   if 873<cx<896 and 4017<cy<4034 and fill['area']>45:color='#75c5db'
   if 904<cx<946 and 4014<cy<4040 and fill['area']>400:color='#bed3a7'
   d=path(pts,True)+' '+ ' '.join(path(h,True) for h in fill['holes'])
   out.append(f'<path d="{d}" fill="{color}" fill-rule="evenodd"/>')
 # Plazas individuales con sus dimensiones de CAD, sin inventar ocupación.
 if visual:
  # El vaso deportivo es rectangular; su tramado interior no recorta el agua.
  out.append(rect([829.0,4017.6,851.6,4023.4],'#65bcd4'))
 for bounds in data['parking']:
  out.append(rect(bounds,'#e1dfd0' if visual else '#fff','#aaa995' if visual else '#999',.65))
 # Contornos originales, incluidos radios de giro, juegos y piscinas.
 for item in data['paths']:
  color='#9c9c8f' if visual else '#51565b';width=.65
  if item['layer']=='Walls':color='#696d64';width=1.0
  if item['layer'].startswith('Cour_'):continue
  out.append(f'<path d="{path(item["points"],item["closed"])}" fill="none" stroke="{color}" stroke-width="{width}"/>')
 for item in data.get('furniture',[]):
  out.append(f'<path d="{path(item["points"],item["closed"])}" fill="none" stroke="'+('#657a70' if visual else '#555')+'" stroke-width=".7"/>')
 # Edificios: la huella procede del bloque arquitectónico, no de la numeración.
 for building in data['buildings']:
  bounds=building['bounds'];x,y=point(bounds[0],bounds[1]);w=(bounds[3]-bounds[1])*S;h=(bounds[2]-bounds[0])*S
  if visual:out.append(f'<rect x="{x+3:.2f}" y="{y+4:.2f}" width="{w:.2f}" height="{h:.2f}" fill="#c4c6ba"/>')
  out.append(rect(bounds,'#626e73' if visual else '#f4f5f5','#f8f8ef' if visual else '#4c5358',2.0))
  out.append(f'<rect x="{x+4:.2f}" y="{y+4:.2f}" width="{w-8:.2f}" height="{h-8:.2f}" fill="none" stroke="'+('#8d999c' if visual else '#b7bdc0')+'" stroke-width="1"/>')
 # Edificaciones comunes: se conservan sus detalles de muros y huecos.
 for service in data['services']:
  if not service['name'].startswith('ROA-E02') and not service['name'].startswith('ROA-E06'):
   out.append(f'<path d="{path(service["hull"],True)}" fill="'+('#c1ad8c' if visual else '#eee')+'" stroke="#8f8574" stroke-width="1.2"/>')
  for item in service['paths']:
   out.append(f'<path d="{path(item["points"],item["closed"])}" fill="none" stroke="'+('#8f8473' if visual else '#535353')+'" stroke-width=".55"/>')
 if visual:
  for bounds in data['trees']:
   x0,y0,x1,y1=bounds;cx,cy=point((x0+x1)/2,(y0+y1)/2);rx=max(2,(y1-y0)*S/2);ry=max(2,(x1-x0)*S/2)
   out.append(f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="#91ad76" stroke="#718c60" stroke-width=".8" opacity=".85"/>')
 # Numeración discreta de referencia; los controles interactivos se superponen.
 for b in data['buildings']:
  x,y=point(*b['center']);color='#f6f4eb' if visual else '#333'
  out.append(f'<text x="{x:.2f}" y="{y+4:.2f}" text-anchor="middle" fill="{color}" font-family="Arial,sans-serif" font-size="12" font-weight="700">TH-{int(b["code"]):02}</text>')
 out.append('</svg>')
 (ROOT/f'public/araya-masterplan-20261119-{mode}.svg').write_text('\n'.join(out),encoding='utf-8')
print('Vistas generadas:',len(data['buildings']),'edificios,',len(data['parking']),'plazas y',len(features),'elementos identificados.')
