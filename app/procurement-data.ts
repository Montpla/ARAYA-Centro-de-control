export type SupplierContactRow = {
  sourceRow: number;
  name: string;
  service: string;
  size: string;
  legalId: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
  relationship: string;
  creditTerms: string;
  creditLimitDop: number | null;
};

type SupplierContactTuple = readonly [
  number,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number | null,
];

export type SupplierDirectoryEntry = {
  id: string;
  name: string;
  services: string[];
  size: string;
  legalIds: string[];
  addresses: string[];
  contacts: string[];
  phones: string[];
  emails: string[];
  relationships: string[];
  creditTerms: string[];
  creditLimitDop: number;
  sourceRows: number[];
  qualityIssues: string[];
};

export type ProcurementPackage = {
  id: string;
  name: string;
  supplier: string;
  unitPricePerBuildingDop: number;
  reportedContractDop: number;
  buildings: number;
  scheduledTotalDop: number;
};

export type ProcurementMonth = {
  month: string;
  amountDop: number;
  cumulativeDop: number;
};

export type SupplierOffer = {
  supplier: string;
  totalDop: number | null;
  score: number | null;
};

export type SupplierComparison = {
  id: string;
  sheet: string;
  title: string;
  date: string;
  budgetDop: number;
  offers: SupplierOffer[];
  observations: string[];
};

export type BudgetChapter = {
  name: string;
  originalDop: number;
  updatedDop: number;
  differenceDop: number;
  deviation: number;
};

export type MonthlyDeviationLine = BudgetChapter & {
  observation: string;
  buildingCount: number;
  projectImpactDop: number;
};

const rawSupplierContactRows: SupplierContactTuple[] = [
  [3,"GERDAU METALDOM","Acero de refuerzo","GRANDE","1-01-00484-3","Carretera Villa Mella a orillas rio Isabela","MARIA DEL CARMEN","829-916-2641 -809 239-4622","ventas@gerdaumetaldom.com","Credito","15 dias varillas-30 dias Mallas",3000000],
  [4,"FERRETERIA BELLON","Acero de refuerzo-ferreteria","GRANDE","102000621","FRIUSA-BAVARO","LUIS TEJADA","829-451-1307",": ventas@bellon.com.do","Credito","16 dias varillas-30-60 dias otros productos",8000000],
  [5,"KINNOX SA","Acero de refuerzo","GRANDE","1-0163165-1","Autopista duarte, Los alcarrizos","MIOSOTIS","809-796-6641   809-563-8600","venyas@kinnox.com","Credito","15 dias varillas-60 dias mallas",1500000],
  [6,"VALIENTE FERNADEZ","Acero de refuerzo","GRANDE","1-0163165-1","Av. Luperón #89 Apartado Postal 4823, Santo Domingo","","(809) 549-5220","ventas@vf.com.do","Negociacion","",null],
  [7,"MADESOL","Encofrado de madera","GRANDE","1-0167633-7","Carretera Veron Punta Cana km 3 1/2 Bavaro","Carlos Jimenez","809-248-1632  809-549-3059","www.madesol.com","Contado","",null],
  [8,"Importadora Dominicana de Madera SAS","Encofrado de madera","GRANDE","1-0102369-4","Dirección Local 4-F, Naves del Caribe III, Carretera Cruce Verón Km. 1, Bávaro, Rep Dom.","Georgina Mateo","829-420-8231","imdomaca@.com.do","Negociacion","",null],
  [9,"FERRETERIA DETALLISTA SA","Acero de refuerzo-ferreteria","MEDIANA","1-1200215-2","Carretera Verón 23000 Punta Cana 23000 Republica Dominicana","Melissa Roa","(809)-747-1463","ejecproyectob1@ferreteriadetallista.com","Credito","varillas-cemento contado\n30 Dias Otros productos",4000000],
  [10,"RODFOR TEAM S R L","PLOMERIA-FERRETERIA","MEDIANA","J-130-259-976","Parque Industrial J Sued Nave 23 Alameda","Omar Minaya","(809)-658-1924","ventas@rodfor.com","Credito","30 dias",1500000],
  [11,"EUROTUBOS","PLOMERIA","MEDIANA","","C/ Invierno entre primera y proyecto (Urbanización Moisés, Los Mina). Santo Domingo Este","Robin Rodriguez","(809)-780-6836","https://eurotubos.net/","Negociacion","",null],
  [12,"ISOTEX DOMINICANA SAS","Termopanel","GRANDE","J-130773793","Parque Industrial Duarte Autopista Duarte KM 22","Ivan","(809)-480-8202","www.isotexdominicana.com","Contado","",null],
  [13,"ALUFUERTE EUROPEO SRL","Termopanel-Estructura Metalica-Aluzinc","GRANDE","J-131758657","Carretera Mella, San Luis Proximo al Instituto Tecnico Superior Comunitario (ITSC), San Luis\nSanto Domingo Este","Marlene sosa","8098704264","sosa@alufuerte.com","Contado","",null],
  [14,"HORMIGON INDUSTRIAL DEL ESTE SRL","Hormigon","GRANDE","J-130812901","C. 4ta N.01 Sector Chino Poueriet Higuey Rep. Dom Higüey","Lenin Liranzo","(809)-399-0742","ingenieria@hormigonindustrialdeleste.com","Credito","30 dias",5000000],
  [15,"CANAMIX SRL","Hormigon","GRANDE","131-95905-9","Boulevard Turistico Del Este Del Sector bvaro de la ciudad de Veron Punta Cana","Maria Virginia Verenzuela","849-855-1422","creditosycobranza@cana-mix.com","Contado","",null],
  [16,"BLUE WAVE AGREGADOS SRL","Hormigon","GRANDE","J-131644007","km 5-1/2 Av. Barcelo Bavaro la Altagracia","Luis Eduardo Francis","829-259-3478","eduardo.francis@bluewave.com.do","Credito","30 dias",8000000],
  [17,"CONCREMAX","Hormigon","GRANDE","J-130-558361","Carretera Arena Gorda,Riu Bavaro,RD","Alberty Director Comercial","829-340-4593","grupoconcremax.com.do","Credito","30 dias",5000000],
  [18,"APH","Hormigon","GRANDE","","Av. Las mercedes Central Park-404 Bavaro la Altagracia","Daniel Barrios","829-655-3143","info@aphconcretedelivery.com","Sin negociacion","",null],
  [19,"HORMIGONES HENRIQUEZ","Hormigon","GRANDE","J-132-645456","Carretera Veron Bavaro Antes de Bajar de veron","","809-231-2121","hormigoneshenriquez@gmail.com","Sin negociacion","",null],
  [20,"IMPORTADORA DACIAGROUP.NET","Revestimiento piso de vinyl","GRANDE","","","Alex Amblard","809-769-0346","alex@daciagroup.net","Sin negociacion","",null],
  [21,"IMPORTADORA TYRVAL","Revestimiento piso de vinyl","GRANDE","","PUNTA CANA (EMPRESA ESPANOLA)","Ivan Saldivia","8098409757","delegacion.republicadominicana@tyrval.com","Sin negociacion","",null],
  [22,"INTERDECO","Revestimiento piso de vinyl","PEQUENA","130217793","Av. Nunez de Carece, Las Praderas, Santo Domingo","Yuleisi Williams","809 227-7700","www.interdeco.do","Sin negociacion","",null],
  [23,"MARMOTECH","Revestimiento piso de vinyl","GRANDE","","Santo Domingo","BETTY CHECO","809-390-6146","www.marmotech.com.do","Sin negociacion","",null],
  [24,"CIELOS ACUSTICOS","Revestimiento piso de vinyl","PEQUENA","101756373","Carr. Higüey-Miches al lado \nde Helidosa T.","Manuela Volquez","809-466-1019","ventas@cielosacusticos.com","Sin negociacion","",null],
  [25,"EBANISTERIA MARIO","CARPINTERIA","GRANDE","131-304621","Jarabaco,RD","Mario del Rosario","829-383-8627","marioebanisteria@hotmail.com","Sin negociacion","",null],
  [26,"SPAZIO DI CASA","CARPINTERIA","GRANDE","","","","","","Sin negociacion","",null],
  [27,"OPPEIN HOME GROUP INC.","CARPINTERIA","GRANDE","","Add: Oppein Industrial Park, 366#, Guanghua 3rd Road, Baiyun District, Guangzhou, China\nMob: +86-13265372730; E-mail: miameng@oppein.com","VIVIAN","","E-mail: miameng@oppein.com","Sin negociacion","",null],
  [28,"COIMTRA","CARPINTERIA","GRANDE","","","","","","Sin negociacion","",null],
  [29,"EDSOLUCIONESYSERVICIOS2021","CARPINTERIA","PEQUENA","","Edif. Noriega Piso 4 Ofic. 413 Punta Cana Village","Sra. Enza","809-615-1632","edsolucionesyservicios2021@gmail.com","Sin negociacion","",null],
  [30,"EGKITCHEN DETAILING","CARPINTERIA","PEQUENA","131-21714-1","Luis F. Thomen, 525-B, El Millón","","809-796-1435","kitchendetailing@gmail.com","Sin negociacion","",null],
  [31,"GERMANY KITCHEN &CLOSETS","CARPINTERIA","GRANDE","130-96290-1","Santo Domingo","Agata Beracasa","829-520-5006","asesor@germanykitchen.com","Sin negociacion","",null],
  [32,"MADEGLASS","CARPINTERIA","GRANDE","","Av. Estados Unidos Plaza Tres Center Nave #7 Bavaro Punta Cana","Grace Baez","829-761-7101","presupuestos@madeglass.com","Sin negociacion","",null],
  [33,"SUPLIDORES ELECTRICOS DEL  CARIBE","ELECTRICIDAD","GRANDE","J-130-381-372","Carretera Higuey-Miches Pareque Tecnol Punta Cana Nave 4","YULI","849-353-1780","ventas@suplidoresdelcaribe.com","Credito","30 dias",1500000],
  [34,"JJ ELECTRIC","ELECTRICIDAD","GRANDE","","Santo Domingo","JORDANY","829-640-0039","","Credito","30 dias",1500000],
  [35,"RJ ELECTRIC","ELECTRICIDAD","GRANDE","","Santo Domingo","RONNY","809-801-0309","","Credito","30 dias",1500000],
  [36,"TARGETLUX","ELECTRICIDAD","GRANDE","","Santo Domingo","ANGEL GILBERTO PENA","829-858-7632","gilbertop.targetlux@gmail.com","Sin negociacion","",null],
  [37,"PALACIO ELECTRICO SRL","ELECTRICIDAD","GRANDE","","Santo Domingo","Esmelin sanchez","809-498-7869","dionisioespejo@palacioelectrico","Sin negociacion","",null],
  [38,"GRUPO ALUGAV SAS","Vidrio y aluminio","GRANDE","J-131-260-895","Santo Domingo","Guillermo Turull","809-820-9090","g.turull@alugav.co>","Sin negociacion","",null],
  [39,"FERRAL SRL","Vidrio y aluminio","GRANDE","1-30-44191-4","Calle Paraguay #188 Ensanche La Fe RD","Martin Doorly","809-878-7227","mdoorlyferral.com.do","Sin negociacion","",null],
  [40,"GLOBALUM","Vidrio y aluminio","GRANDE","","Centro logistico del Pilar Nave 20, Veron- Punta Cana","Veronica Medina","829-962-5062","vmedina@globalumrd.com","Sin negociacion","",null],
  [41,"MADEGLASS","Vidrio y aluminio","GRANDE","","Av. Estados Unidos Plaza Tres Center Nave #7 Bavaro Punta Cana","Grace Baez","829-761-7101","presupuestos@madeglass.com","Sin negociacion","",null],
  [42,"ARBOLEDA GROUP","Vidrio y aluminio","GRANDE","","Moca #149, Villa Juana, Santo Domingo","Ramsés Gomera","809-334-6111","info@grupoarboleda.com","Sin negociacion","",null],
  [43,"VANTA","Vidrio y aluminio","GRANDE","","Ave. De La Vega Real No. 17\nArroyo Hondo, Santo Domingo\nRepublica Dominicana","","","www.vanta.com.do","Sin negociacion","",null],
  [44,"RENSA SOLAR","Energia Solar","GRANDE","","Rensa Punta Cana\n4to Piso. Local 32.\nKm 5, Boulevard Turístico del Este\nPunta Cana. 23000","Saul Torres","829-745-3469","info@rensa.com.do","Sin negociacion","",null],
  [45,"SOLELEC HISPANIOLA","Energia Solar","PEQUENA","","Santo Domingo","Christophe dahyot","809-519-2332","christophe.dahyot@solelec.net","Sin negociacion","",null],
  [46,"ENSO SOLAR","Energia Solar","GRANDE","","Santo Domingo","Leonela Tejada","","letejeda@marti.do","Sin negociacion","",null],
  [47,"TECNICA ELECTROMECANICA NUNEZ SRL","Energia Solar","PEQUENA","","Santo Domingo","DENNYS NUNEZ","809-860-7581","electromecanica nunez@gmail.com","Sin negociacion","",null],
  [48,"DEPOSITO FERRETERO","PVC, CERAMICA, GRIFERIA, CEMENTO, ACERO,PIEZAS SANITARIAS","GRANDE","","PUNTA CANA","JOARY","829-344-9863","","Sin negociacion","",null],
  [49,"CORVI","PVC","GRANDE","","AUTOPISTA DUARTE KM24, SANTO DOMINGO","Luis Brito","809-200-8113","","Sin negociacion","",null],
  [50,"MANUEL CORRIPIO","PVC, CERAMICA, GRIFERIA, CEMENTO, ACERO,PIEZAS SANITARIAS","GRANDE","","AUTOPISTA DUARTE KM24, SANTO DOMINGO","MIRIAM ENCARNACION","829-344-9863","","Sin negociacion","",null],
  [51,"COMERCIALIZADORA ROSARIO","PVC, CERAMICA, GRIFERIA, CEMENTO, ACERO,PIEZAS SANITARIAS","GRANDE","","AUTOPISTA DUARTE KM18, SANTO DOMINGO","RAYMOND THEN","829-421-7590","reymond.then.r@gmail.com","Sin negociacion","",null],
  [52,"ALMACENES UNIDOS","PVC, CERAMICA, GRIFERIA, CEMENTO, ACERO,PIEZAS SANITARIAS","GRANDE","","SANTO DOMINGO Y PUNTA CANA","Odanny Montero","829-599-9011","cotizaciones pc2@almacenesunidos.net","Negociacion","",null],
  [53,"IMPORTADORA TYRVAL","GRIFERIA, ,PIEZAS SANITARIAS","GRANDE","","PUNTA CANA (EMPRESA ESPANOLA)","Ivan Saldivia","8098409757","delegacion.republicadominicana@tyrval.com","Sin negociacion","",null],
  [54,"BCACCESORY IMPORT SRL","GRIFERIA,PIEZAS SANITARIAS","GRANDE","","REPUBLICA DOMINICANA","Angela Salamanca","8097962726","asalamanca@baccesory.net","Sin negociacion","",null],
  [55,"MATICES","PINTURA Y MATERIALES DE PINTAR","PEQUENA","","Santo Domingo","Yaniris de Jesús","829-301-3318","ventas03@matices.com.do","Sin negociacion","",null],
  [56,"CONSTRUCTORA SOSA MERCADO SRL","MATERIALES ENCOFRADO METALICO","MEDIANA","J-131762581","Aut. Duarte km 22 carretera a la cuaba No.10 La Guayiga Pedro Brand","Robinson Sosa","809-994-5814","constructorasosamercado@gmail.com","Contado","",null],
  [57,"FEW GROUP SRL","MATERIALES ENCOFRADO METALICO","GRANDE","J-130679967","Calle principal lo Guayabos Nave 33 Km 10 1/2 Autopista Duarte detras de Carrefour","Carlos","(849)-354-1693","fewgrouprd@gmail.com","Credito","30 dias",150000],
  [58,"SERVICIOS Y PRODUCTOS PARA LA CONSTRUCCION SRL","MATERIALES ENCOFRADO METALICO","GRANDE","J-101624371","Calle Bienvenido Garcia Gautier Esq. Luis Amiami Tio Arroyo Hondo","Mariela","(809)-658-3273","ventas3@spcrd.com","Contado","",null],
  [59,"ENCOFORMAS SRL","MATERIALES ENCOFRADO METALICO","GRANDE","J-131688551","Calle Principal #5-km 10.5 Autopista Duarte","Edward Cuevas","(829)-884-2949","Info@encoformas.com","Contado","",null],
  [60,"ROCAENCA","ENSAYOS HORMIGON-DENSIDAD","MEDIANA","J-132594916","Prolongacion domingo maiz Punta Cana Veron","Tomas Casilla","(829)-423-1338","rocaenca@gmail.com","Credito","30 dias",500000],
  [61,"GRUPO SANIDOM","FUMIGACION","MEDIANA","J-133236613","Av. Imbert La Vega 41000, Bavaro","Jorge","(829)-910-7811","dasamcaribe@gmail.com","Credito","30 dias",500000],
  [62,"ACABADOS AUTOMOTRICES","PINTURA","GRANDE","","Santo Domingo","DAURRYS GUERRERO","(809) 449-4442","","Sin negociacion","",null],
  [63,"TONOS Y COLORES","PINTURA Y MATERIALES DE PINTAR","PEQUENA","","Punta Cana","Amy Villar","(849) 876-0722","","Sin negociacion","",null],
  [64,"MARMOTECH","CERAMICAS","GRANDE","","Santo Domingo","BETTY CHECO","809-390-6146","","Sin negociacion","",null],
  [65,"CERARTE","CERAMICAS","GRANDE","","SANTO DOMINGO Y PUNTA CANA","YOKASTA","849-427-7301","","Sin negociacion","",null],
  [66,"FERRETERIA OCHOA","CERAMICAS Y VARIOS","GRANDE","","Santo Domingo","YANIRA","809-747-6747","","Sin negociacion","",null],
  [67,"DASS SRL","CERAMICAS Y ENCHAPE","GRANDE","131-12503-4","Santo Domingo","","","","Sin negociacion","",null],
  [68,"Iberocomercial del Caribe, S. A.","CERAMICAS","GRANDE","1-01-55607-2","Ave. Núñez de Cáceres #597","","809-547-2277","www.laiberica.com.do","Sin negociacion","",null],
  [69,"TEJAR DEL REY","CERAMICAS","PEQUENA","J-101685794","Veron Punta Cana la Altagracia","Yasmina Gonzalez","809-501-2185","www.tejardelrey.com","Contado","",null],
  [70,"IMPORTADORA TYRVAL","CERAMICAS Y RECUBRIMIENTOS","GRANDE","","PUNTA CANA (EMPRESA ESPANOLA)","Ivan Saldivia","8098409757","delegacion.republicadominicana@tyrval.com","Sin negociacion","",null],
  [71,"SUPLIPUCANSA","HERRERIA","MEDIANA","","","JESUS PADILLA","829-344-4401","jpadilla@sipc.com.do","Sin negociacion","",null],
  [72,"GERIPSA","HERRERIA","MEDIANA","J-130786641","AV. PRESIDENTE ANTONIO GUZMAN FERNANDEZ#9","ELIGIO","809-350-5100","ELIGIO.C@GERIPSA.COM","Credito","30 dias",null],
  [73,"TALLER INDUSTRIAL J NIVAR SRL","HERRERIA","MEDIANA","J-133510154","C/VILLA PROGRESO C. LINDO VERON PUNTA CAN","Jose","829-761-7101","tallerindustrialjnivar@gmail.com","Credito","30 dias",null],
];

export const supplierContactRows: SupplierContactRow[] = rawSupplierContactRows.map((row) => ({
  sourceRow: row[0],
  name: row[1],
  service: row[2],
  size: row[3],
  legalId: row[4],
  address: row[5],
  contact: row[6],
  phone: row[7],
  email: row[8],
  relationship: row[9],
  creditTerms: row[10],
  creditLimitDop: row[11],
}));

const normalizedSupplierName = (value: string) => value.toLocaleUpperCase("es").replace(/[^A-Z0-9ÁÉÍÓÚÑ]/g, "");

function appendDistinct(target: string[], value: string) {
  const clean = value.trim();
  if (clean && !target.includes(clean)) target.push(clean);
}

const supplierDirectoryMap = new Map<string, SupplierDirectoryEntry>();

for (const row of supplierContactRows) {
  const key = normalizedSupplierName(row.name);
  const current = supplierDirectoryMap.get(key) ?? {
    id: `supplier-${row.sourceRow}`,
    name: row.name,
    services: [],
    size: row.size,
    legalIds: [],
    addresses: [],
    contacts: [],
    phones: [],
    emails: [],
    relationships: [],
    creditTerms: [],
    creditLimitDop: 0,
    sourceRows: [],
    qualityIssues: [],
  };
  appendDistinct(current.services, row.service);
  appendDistinct(current.legalIds, row.legalId);
  appendDistinct(current.addresses, row.address);
  appendDistinct(current.contacts, row.contact);
  appendDistinct(current.phones, row.phone);
  appendDistinct(current.emails, row.email);
  appendDistinct(current.relationships, row.relationship);
  appendDistinct(current.creditTerms, row.creditTerms);
  current.creditLimitDop += row.creditLimitDop ?? 0;
  current.sourceRows.push(row.sourceRow);
  supplierDirectoryMap.set(key, current);
}

export const supplierDirectory = [...supplierDirectoryMap.values()]
  .map((supplier) => {
    if (supplier.legalIds.length === 0) supplier.qualityIssues.push("RNC pendiente");
    if (supplier.contacts.length === 0) supplier.qualityIssues.push("Contacto pendiente");
    if (supplier.phones.length === 0) supplier.qualityIssues.push("Teléfono pendiente");
    if (supplier.emails.length === 0) supplier.qualityIssues.push("Correo pendiente");
    if (supplier.emails.some((email) => !email.includes("@") || email.includes("@.") || email.includes(" "))) {
      supplier.qualityIssues.push("Correo o web pendiente de normalizar");
    }
    return supplier;
  })
  .sort((left, right) => left.name.localeCompare(right.name, "es"));

export const supplierContactAudit = {
  sourceRows: supplierContactRows.length,
  uniqueSuppliers: supplierDirectory.length,
  large: supplierContactRows.filter((item) => item.size.toLocaleUpperCase("es") === "GRANDE").length,
  medium: supplierContactRows.filter((item) => item.size.toLocaleUpperCase("es") === "MEDIANA").length,
  small: supplierContactRows.filter((item) => item.size.toLocaleUpperCase("es") === "PEQUENA").length,
  creditRelationships: supplierContactRows.filter((item) => item.relationship.toLocaleLowerCase("es").includes("credito")).length,
  cashRelationships: supplierContactRows.filter((item) => item.relationship.toLocaleLowerCase("es").includes("contado")).length,
  pendingNegotiation: supplierContactRows.filter((item) => item.relationship.toLocaleLowerCase("es").includes("sin negociacion")).length,
  creditLimitDop: supplierContactRows.reduce((total, item) => total + (item.creditLimitDop ?? 0), 0),
  missingLegalId: supplierContactRows.filter((item) => !item.legalId).length,
  missingEmail: supplierContactRows.filter((item) => !item.email).length,
  duplicateWorkbookSha256: "C4F6EBBD2824A8934F952ACEA333D4F44B773A9AB8E222D574D1F2E718414CDF",
};

export const procurementPackages: ProcurementPackage[] = [
  { id: "package-1", name: "INS. Y PIEZAS SANITARIAS", supplier: "DACIA", unitPricePerBuildingDop: 573137.88, reportedContractDop: 14901584.88, buildings: 26, scheduledTotalDop: 14901584.88 },
  { id: "package-2", name: "CABLEADO", supplier: "PROVEEDOR ELECTRICO", unitPricePerBuildingDop: 157126.44, reportedContractDop: 4085287.44, buildings: 26, scheduledTotalDop: 4085287.44 },
  { id: "package-3", name: "SPC FLOORING", supplier: "AQUAARMOR CHINA", unitPricePerBuildingDop: 394951.48, reportedContractDop: 10268738.48, buildings: 26, scheduledTotalDop: 10268738.48 },
  { id: "package-4", name: "REVESTIMIENTOS PISO DE PARED DE DUCHA", supplier: "PROVEEDOR CERAMICA", unitPricePerBuildingDop: 157500, reportedContractDop: 4095000, buildings: 26, scheduledTotalDop: 4095000 },
  { id: "package-5", name: "REVESTIMIENTOS PISO DE BANOS", supplier: "PROVEEDOR CERAMICA", unitPricePerBuildingDop: 850662, reportedContractDop: 22117212, buildings: 26, scheduledTotalDop: 22117212 },
  { id: "package-6", name: "TABLILLA", supplier: "DASCLAY", unitPricePerBuildingDop: 98201.49, reportedContractDop: 1374820.86, buildings: 14, scheduledTotalDop: 1374820.86 },
  { id: "package-7", name: "REVESTIMIENTO ESCALERA, BALCONES", supplier: "CONTE DIRECTO", unitPricePerBuildingDop: 112488.65, reportedContractDop: 2587238.95, buildings: 23, scheduledTotalDop: 2587238.95 },
  { id: "package-8", name: "CLOSETS", supplier: "GRS", unitPricePerBuildingDop: 701125.32, reportedContractDop: 18229258.32, buildings: 26, scheduledTotalDop: 18229258.32 },
  { id: "package-9", name: "COCINAS", supplier: "GERMANY KITCHEN", unitPricePerBuildingDop: 1194890.47, reportedContractDop: 31067152.22, buildings: 26, scheduledTotalDop: 31067152.22 },
  { id: "package-10", name: "PUERTAS", supplier: "MARIO EBANISTERIA", unitPricePerBuildingDop: 499000, reportedContractDop: 12974000, buildings: 26, scheduledTotalDop: 12974000 },
  { id: "package-11", name: "VIDRIO-ALUMINIO", supplier: "ALUGAV", unitPricePerBuildingDop: 1117728.86, reportedContractDop: 29060950.36, buildings: 26, scheduledTotalDop: 29060950.36 },
  { id: "package-12", name: "BARANDAS-PERGOLAS", supplier: "TITAN", unitPricePerBuildingDop: 472873.03, reportedContractDop: 12294698.78, buildings: 26, scheduledTotalDop: 12294698.78 },
  { id: "package-13", name: "ESTRUC. METALICA TECHO", supplier: "GERIPSA-SUPLIPUCANSA", unitPricePerBuildingDop: 823799.93, reportedContractDop: 21418798.18, buildings: 26, scheduledTotalDop: 21418798.18 },
  { id: "package-14", name: "SIST. FOTOVOLTAICO", supplier: "SOLELEC HISPANIOLA", unitPricePerBuildingDop: 688410, reportedContractDop: 17898660, buildings: 26, scheduledTotalDop: 17898660 },
];

export const procurementMonthlySchedule: ProcurementMonth[] = [
  { month: "Jul-26", amountDop: 12730214.489, cumulativeDop: 12730214.489 },
  { month: "Ago-26", amountDop: 32072673.001, cumulativeDop: 44802887.49 },
  { month: "Sep-26", amountDop: 39348919.5172, cumulativeDop: 84151807.0072 },
  { month: "Oct-26", amountDop: 41317733.0672, cumulativeDop: 125469540.0744 },
  { month: "Nov-26", amountDop: 23575234.7822, cumulativeDop: 149044774.8566 },
  { month: "Dic-26", amountDop: 26589725.3972, cumulativeDop: 175634500.2538 },
  { month: "Ene-27", amountDop: 11323708.3752, cumulativeDop: 186958208.629 },
  { month: "Feb-27", amountDop: 9671086.177, cumulativeDop: 196629294.806 },
  { month: "Mar-27", amountDop: 3766985.832, cumulativeDop: 200396280.638 },
  { month: "Abr-27", amountDop: 1977119.832, cumulativeDop: 202373400.47 },
];

export const supplierComparisons: SupplierComparison[] = [
  {
    id: "comparison-closets",
    sheet: "CLOSETS",
    title: "Cuadro comparativo closets",
    date: "2026-05-28",
    budgetDop: 585946.2,
    offers: [
      { supplier: "GRS", totalDop: 701125.32, score: 16 },
      { supplier: "GRUPO BELLONA", totalDop: 688800, score: 18 },
      { supplier: "COIMTRA", totalDop: 714168.252, score: 16 },
      { supplier: "GERMANY KITCHEN", totalDop: 885425.4528, score: 16 },
      { supplier: "SPAZIO DI CASA", totalDop: 786368.52, score: 16 },
    ],
    observations: ["Las opciones indicadas en la hoja son GRS y Coimtra; deben realizar una muestra antes de decidir."],
  },
  {
    id: "comparison-cocinas",
    sheet: "COCINAS",
    title: "Cuadro comparativo cocinas",
    date: "2026-05-28",
    budgetDop: 1003592.82,
    offers: [
      { supplier: "ONE", totalDop: 1138601.94672, score: 18 },
      { supplier: "COIMTRA", totalDop: 1324854.603912, score: 16 },
      { supplier: "GERMANY KITCHEN", totalDop: 1194890.473392, score: 16 },
      { supplier: "SPAZIO DI CASA", totalDop: 1219830.192, score: 16 },
      { supplier: "PACIFIC", totalDop: 1239999.02208, score: 16 },
    ],
    observations: [],
  },
  {
    id: "comparison-puertas",
    sheet: "PUERTAS",
    title: "Cuadro comparativo puertas",
    date: "2026-05-28",
    budgetDop: 460030.72,
    offers: [
      { supplier: "GRS", totalDop: 549824.96, score: 16 },
      { supplier: "SABAL", totalDop: 534376.729776, score: 14 },
      { supplier: "MARIO EBANISTERIA (PUERTAS MODELO)", totalDop: 499000, score: 18 },
      { supplier: "PACIFIC LTD", totalDop: 525384.369064, score: 16 },
      { supplier: "COIMTRA", totalDop: 525759.408, score: 16 },
      { supplier: "CIELOS ACUSTICOS", totalDop: 617204.02672, score: 16 },
      { supplier: "MAGSA", totalDop: 636127.68, score: 14 },
    ],
    observations: ["La hoja señala preferencia por Coimtra, aunque sea el segundo precio menor, por la calidad de la puerta."],
  },
  {
    id: "comparison-lavamanos",
    sheet: "LAVAMANO-LAVADERO",
    title: "Cuadro comparativo lavamanos y lavaderos",
    date: "2026-05-28",
    budgetDop: 239304,
    offers: [
      { supplier: "GERMANY KITCHEN", totalDop: 378241.820544, score: 16 },
      { supplier: "COIMTRA (LAVADERO-LAVAMANO)", totalDop: 259794.458112, score: 16 },
      { supplier: "SPAZIO DI CASA", totalDop: 394676.016, score: 16 },
      { supplier: "DACIA", totalDop: 214552.8, score: 18 },
      { supplier: "PACIFIC", totalDop: 341861.932005, score: 16 },
    ],
    observations: [],
  },
  {
    id: "comparison-spc",
    sheet: "SPC FOORING",
    title: "Cuadro comparativo SPC flooring",
    date: "2026-05-28",
    budgetDop: 696467.77,
    offers: [
      { supplier: "TYRVAL", totalDop: 651301.237888, score: 18 },
      { supplier: "DACIA", totalDop: 653493.12848, score: 18 },
      { supplier: "AQUAARMOR EMPRESA CHINA", totalDop: 473941.77138, score: 21 },
      { supplier: "CIELOS ACUSTICOS", totalDop: 828766.385014, score: 16 },
      { supplier: "MAGSA", totalDop: 734632.376083, score: 16 },
      { supplier: "INTERDECO", totalDop: 692309.9056, score: 16 },
    ],
    observations: [],
  },
  {
    id: "comparison-barandas",
    sheet: "BARANDAS Y PERGOLAS",
    title: "Estructura metálica, techos, pérgolas y barandas",
    date: "",
    budgetDop: 595509.34616,
    offers: [
      { supplier: "ALUGAV · galvanizado", totalDop: 607361.424912, score: 16 },
      { supplier: "ALUGAV · aluminio", totalDop: 843240.666072, score: 18 },
      { supplier: "TITAN EMPRESA CHINA · aluminio", totalDop: 475831.71, score: 20 },
      { supplier: "SUPLIPUCANSA · galvanizado", totalDop: 472873.0328, score: 20 },
      { supplier: "ALUMSERVICES · aluminio", totalDop: 607269, score: 16 },
    ],
    observations: ["La hoja no contiene fecha de comparación."],
  },
  {
    id: "comparison-vidrio",
    sheet: "VIDRIO-ALUMINIO",
    title: "Vidrio y aluminio · ventanas y puertas-ventanas",
    date: "2026-05-21",
    budgetDop: 1196600.26,
    offers: [
      { supplier: "NAFA INTERNATIONAL", totalDop: 1262030.67068, score: 16 },
      { supplier: "FERRAL", totalDop: 1241246.555994, score: 17 },
      { supplier: "ALUMSERVICES", totalDop: 1192884.0306, score: 14 },
      { supplier: "ALUGAV", totalDop: 1206147.610657, score: 21 },
      { supplier: "TITAN CHINA", totalDop: 0, score: null },
      { supplier: "GLOBALUM", totalDop: 1506489.49888, score: 16 },
      { supplier: "ARBOLEDA", totalDop: 2088549.124209, score: 16 },
      { supplier: "CORTIZO", totalDop: 1340679.3728, score: 16 },
      { supplier: "DOMIWINDOWS", totalDop: 1267198.712, score: 13 },
      { supplier: "PACIFIC", totalDop: 1523988.692519, score: 16 },
    ],
    observations: ["Titan China aparece sin importe ni puntuación; no se considera una oferta completa."],
  },
  {
    id: "comparison-tablilla",
    sheet: "TABLILLA",
    title: "Cuadro comparativo tablilla",
    date: "2026-05-28",
    budgetDop: 145376,
    offers: [
      { supplier: "TEJAR DEL REY", totalDop: 126440.93, score: 18 },
      { supplier: "JORGE TABAR SRL", totalDop: 254100, score: 16 },
      { supplier: "DASCLAY (COTIZAR)", totalDop: 98201.488, score: 18 },
      { supplier: "CADEMAC COLOMBIA", totalDop: 65480.03, score: 20 },
    ],
    observations: [],
  },
  {
    id: "comparison-banos",
    sheet: "BANOS",
    title: "Cuadro comparativo baño compacto",
    date: "2026-05-28",
    budgetDop: 375263.781,
    offers: [
      { supplier: "TYRVAL-CONTE-DACIA", totalDop: 274156.17, score: 14 },
      { supplier: "MARMOLES PRAMA-CONTE-DACIA", totalDop: 244066.17, score: 16 },
      { supplier: "LA IBERICA-CONTE-DACIA", totalDop: 248668.17, score: 14 },
    ],
    observations: [],
  },
  {
    id: "comparison-griferias",
    sheet: "GRIFERIAS",
    title: "Cuadro comparativo griferías",
    date: "2026-05-28",
    budgetDop: 385860,
    offers: [
      { supplier: "DELTA", totalDop: 434557.656, score: 16 },
      { supplier: "DACIA", totalDop: 326537.88, score: 18 },
      { supplier: "PACIFIC", totalDop: 312139.44, score: 20 },
      { supplier: "TYRVAL", totalDop: 336969.1728, score: 18 },
    ],
    observations: [],
  },
  {
    id: "comparison-fotovoltaico",
    sheet: "S FOTOVOLTAICO",
    title: "Cuadro comparativo sistema fotovoltaico",
    date: "2026-05-28",
    budgetDop: 820100,
    offers: [
      { supplier: "RENSA", totalDop: 1249299.632, score: 16 },
      { supplier: "SOLELEC HISPANIOLA", totalDop: 688410, score: 18 },
      { supplier: "RAAS SOLAR", totalDop: 646188, score: 18 },
      { supplier: "EMN", totalDop: 522107.44, score: 16 },
    ],
    observations: ["El título interno de la hoja fue copiado de la comparación de piezas sanitarias; el contenido corresponde al sistema fotovoltaico."],
  },
];

export const typeABudgetChapters: BudgetChapter[] = [
  { name: "CARPINTERIA", originalDop: 2049569.74, updatedDop: 2400730.33266, differenceDop: 351160.59266, deviation: 0.17133381012 },
  { name: "PIEZAS SANITARIAS", originalDop: 823373.5, updatedDop: 928242.1752, differenceDop: 104868.6752, deviation: 0.127364647028 },
  { name: "INFRAESTRUCTURA", originalDop: 1387237.51, updatedDop: 1475727.83, differenceDop: 88490.32, deviation: 0.063788874913 },
  { name: "HERRERIA", originalDop: 1387881.08, updatedDop: 1392513.90307, differenceDop: 4632.82307, deviation: 0.003338054778 },
  { name: "SUPERESTRUCTURA", originalDop: 4310739.02, updatedDop: 4452077.44, differenceDop: 141338.42, deviation: 0.032787514935 },
  { name: "ALBANILERIA", originalDop: 1034844.83, updatedDop: 1042573.18, differenceDop: 7728.35, deviation: 0.007468124472 },
  { name: "INSTALACIONES ELECTRICAS", originalDop: 860818.84, updatedDop: 851358.04, differenceDop: -9460.8, deviation: -0.010990465776 },
  { name: "INSTALACIONES TELECOMUNICACIONES", originalDop: 127665.96, updatedDop: 127665.96, differenceDop: 0, deviation: 0 },
  { name: "INSTALACIONES SANITARIAS", originalDop: 558187.35, updatedDop: 558187.35, differenceDop: 0, deviation: 0 },
  { name: "INSTALACIONES DE INCENDIO", originalDop: 8849.64, updatedDop: 8849.64, differenceDop: 0, deviation: 0 },
  { name: "PINTURA", originalDop: 1741020.9, updatedDop: 1741020.9, differenceDop: 0, deviation: 0 },
  { name: "LIMPIEZA", originalDop: 173990.77, updatedDop: 173990.77, differenceDop: 0, deviation: 0 },
  { name: "REVESTIMIENTO", originalDop: 2626497.9, updatedDop: 2334267.754, differenceDop: -292230.146, deviation: -0.111262280469 },
  { name: "MISCELANEOS", originalDop: 1796012.98, updatedDop: 1670202.9858, differenceDop: -125809.9942, deviation: -0.070049601869 },
  { name: "VIDRIO Y ALUMINIO", originalDop: 1016412.5, updatedDop: 907917.8, differenceDop: -108494.7, deviation: -0.106742784057 },
];

export const monthlyDeviationLines: MonthlyDeviationLine[] = [
  { name: "CARPINTERIA", originalDop: 2049569.74, updatedDop: 2400730.33266, differenceDop: 351160.59266, deviation: 0.17133381012, observation: "Aumento por mayor cantidad/precio", buildingCount: 26, projectImpactDop: 9130175.40916 },
  { name: "PIEZAS SANITARIAS", originalDop: 823373.5, updatedDop: 928242.1752, differenceDop: 104868.6752, deviation: 0.127364647028, observation: "Aumento por mayor cantidad/precio", buildingCount: 26, projectImpactDop: 2726585.5552 },
  { name: "INFRAESTRUCTURA", originalDop: 1387237.51, updatedDop: 1475727.83, differenceDop: 88490.32, deviation: 0.063788874913, observation: "Aumento hormigón (Bluewave) y acero", buildingCount: 11, projectImpactDop: 973393.52 },
  { name: "HERRERIA", originalDop: 1387881.08, updatedDop: 1392513.90307003, differenceDop: 4632.82307003, deviation: 0.003338054778, observation: "Variación menor", buildingCount: 26, projectImpactDop: 120453.399821 },
  { name: "SUPERESTRUCTURA", originalDop: 4310739.02, updatedDop: 4452077.44, differenceDop: 141338.42, deviation: 0.032787514935, observation: "Aumento hormigón (Bluewave)", buildingCount: 15, projectImpactDop: 2120076.3 },
  { name: "ALBANILERIA", originalDop: 1034844.83, updatedDop: 1042573.18, differenceDop: 7728.35, deviation: 0.007468124472, observation: "Variación menor", buildingCount: 15, projectImpactDop: 115925.25 },
  { name: "INSTALACIONES ELECTRICAS-CAJA DE BREAKER", originalDop: 414331.38, updatedDop: 404870.58, differenceDop: -9460.8, deviation: -0.022833896868, observation: "Leve disminución", buildingCount: 0, projectImpactDop: 0 },
  { name: "PIEZAS ELECTRICAS Y CABLEADO", originalDop: 446487.46, updatedDop: 446487.46, differenceDop: 0, deviation: 0, observation: "Sin variación", buildingCount: 0, projectImpactDop: 0 },
  { name: "INSTALACIONES TELECOMUNICACIONES", originalDop: 127665.96, updatedDop: 127665.96, differenceDop: 0, deviation: 0, observation: "Sin variación; el precio de materiales podría disminuir", buildingCount: 0, projectImpactDop: 0 },
  { name: "INSTALACIONES SANITARIAS", originalDop: 558187.35, updatedDop: 558187.35, differenceDop: 0, deviation: 0, observation: "Sin variación", buildingCount: 0, projectImpactDop: 0 },
  { name: "INSTALACIONES DE INCENDIO", originalDop: 8849.64, updatedDop: 8849.64, differenceDop: 0, deviation: 0, observation: "Sin variación", buildingCount: 0, projectImpactDop: 0 },
  { name: "PINTURA", originalDop: 1741020.9, updatedDop: 1741020.9, differenceDop: 0, deviation: 0, observation: "Sin variación; el precio de pintura podría disminuir", buildingCount: 0, projectImpactDop: 0 },
  { name: "LIMPIEZA", originalDop: 173990.77, updatedDop: 173990.77, differenceDop: 0, deviation: 0, observation: "Sin variación", buildingCount: 0, projectImpactDop: 0 },
  { name: "TORTA DE NIVELACION", originalDop: 163656.17, updatedDop: 163656.1696, differenceDop: -0.0004, deviation: -0.000000002444, observation: "Sin variación", buildingCount: 0, projectImpactDop: 0 },
  { name: "REVESTIMIENTO PISO DE VINIL", originalDop: 1167000.92, updatedDop: 955856.861028, differenceDop: -211144.058972, deviation: -0.180928785362, observation: "Ahorro respecto al original; precio AquaArmor China", buildingCount: 26, projectImpactDop: -5489745.533272 },
  { name: "CERAMICA PISO DE BANO", originalDop: 70449.82, updatedDop: 75242.64165, differenceDop: 4792.82165, deviation: 0.068031708953, observation: "Sin variación notable; bajó el material y se ajustó la mano de obra", buildingCount: 25, projectImpactDop: 119820.54125 },
  { name: "CERAMICA PISO DE DUCHA", originalDop: 92169.75, updatedDop: 76305.096, differenceDop: -15864.654, deviation: -0.172124303256, observation: "Aumento de colocación de plato de ducha", buildingCount: 26, projectImpactDop: -412481.004 },
  { name: "CERAMICA PISO DE BALCON", originalDop: 30502.77, updatedDop: 23760.565764, differenceDop: -6742.204236, deviation: -0.221035802191, observation: "Ahorro en el precio de porcelanato", buildingCount: 25, projectImpactDop: -168555.1059 },
  { name: "CERAMICA PISO DE ESCALERA", originalDop: 342436.18, updatedDop: 324989.576912, differenceDop: -17446.603088, deviation: -0.050948480642, observation: "Ahorro en el precio de porcelanato", buildingCount: 26, projectImpactDop: -453611.680288 },
  { name: "TABLILLA", originalDop: 270541.04, updatedDop: 372603.924, differenceDop: 102062.884, deviation: 0.377254718914, observation: "Menor precio de tablilla, menor rendimiento y mayor mano de obra", buildingCount: 20, projectImpactDop: 2041257.68 },
  { name: "PARED DE BANO", originalDop: 472720.43, updatedDop: 326690, differenceDop: -146030.43, deviation: -0.308914996545, observation: "Ahorro por menor cantidad y precio de porcelanato", buildingCount: 25, projectImpactDop: -3650760.75 },
  { name: "PARED COCINA", originalDop: 17020.82, updatedDop: 0, differenceDop: -17020.82, deviation: -1, observation: "Ahorro por eliminación de la partida", buildingCount: 26, projectImpactDop: -442541.32 },
  { name: "MISCELANEOS", originalDop: 1796012.98, updatedDop: 1583592.98, differenceDop: -212420, deviation: -0.118273087314, observation: "Ahorro respecto al original", buildingCount: 26, projectImpactDop: -5522920 },
  { name: "VIDRIO Y ALUMINIO", originalDop: 1016412.5, updatedDop: 907917.8, differenceDop: -108494.7, deviation: -0.106742784057, observation: "Ahorro respecto al original", buildingCount: 26, projectImpactDop: -2820862.2 },
];

export const procurementAudit = {
  phaseBuildings: 26,
  packageCount: 14,
  sourceReportedTotalDop: 198_278_400.47,
  auditedScheduledTotalDop: 202_373_400.47,
  omittedFromSourceFormulaDop: 4_095_000,
  offerCount: 58,
  comparisonCount: 11,
};

export const typeABudgetSummary = {
  lineItemCount: 164,
  workbookSheetCount: 209,
  originalPerBuildingDop: 19_903_102.52,
  updatedPerBuildingDop: 20_065_326.06073003,
  differencePerBuildingDop: 162_223.54073003,
  deviationPerBuilding: 0.008150665986220568,
  original77BuildingsDop: 1_532_538_894.04,
  updated77BuildingsDop: 1_545_030_106.6762123,
  difference77BuildingsDop: 12_491_212.63621211,
};

export const juneDeviationSummary = {
  originalPerBuildingDop: 19_903_102.52,
  updatedPerBuildingDop: 19_963_553.135884035,
  differencePerBuildingDop: 60_450.615884035826,
  deviationPerBuilding: 0.0030372458677380026,
  original26BuildingsDop: 517_480_665.52,
  updated26BuildingsDop: 519_052_381.5329849,
  difference26BuildingsDop: 1_571_716.0129849315,
  weightedProjectImpactDop: -1_613_789.9380292105,
  weightedProjectImpactRatio: -0.0031185511760281207,
};

export const procurementQualityIssues = [
  {
    title: "Total del flujo de proveedores incompleto",
    detail: "La fórmula D126/K126 omite la partida de revestimiento de pared de ducha por RD$4.095.000. El calendario mensual sí la incluye y suma RD$202.373.400,47.",
    severity: "critical" as const,
  },
  {
    title: "Valores de prueba en el flujo",
    detail: "Las celdas M8, I10, I11 y K11 contienen textos o cifras de prueba. No participan en los totales auditados y quedan excluidas del dashboard.",
    severity: "warning" as const,
  },
  {
    title: "Fechas con año incoherente",
    detail: "F61, F62, F105, F123, F124 y F125 no coinciden con los meses de pago de sus columnas. El dashboard usa las cabeceras mensuales hasta que se confirme el año correcto.",
    severity: "warning" as const,
  },
  {
    title: "Notas del resumen mensual desactualizadas",
    detail: "Los puntos clave de las filas 35–39 no coinciden con las fórmulas vigentes. Se sustituyen visualmente por los valores calculados de las filas 28–32.",
    severity: "warning" as const,
  },
  {
    title: "Maestro de proveedores incompleto",
    detail: "Hay 37 filas sin RNC, 13 sin correo y un mismo RNC asignado a Kinnox SA y Valiente Fernández. Se mantienen como incidencias de depuración.",
    severity: "warning" as const,
  },
];

export const ifcComplianceGroups = [
  {
    title: "Compromisos afirmativos",
    items: [
      "Mantener existencia legal y conducir el negocio con diligencia.",
      "Aplicar los fondos exclusivamente al proyecto.",
      "Mantener contabilidad y gestión financiera adecuadas.",
      "Cumplir leyes, requisitos ambientales y sociales.",
      "Adoptar políticas antiacoso y de protección infantil dentro de los tres meses del contrato.",
    ],
  },
  {
    title: "Compromisos negativos",
    items: [
      "No realizar pagos restringidos sin aprobación.",
      "Limitar la deuda financiera a la permitida.",
      "No realizar transacciones de derivados.",
      "Respetar las restricciones sobre gravámenes.",
    ],
  },
  {
    title: "Información y seguros",
    items: [
      "Entregar reportes financieros y operativos mensuales.",
      "Presentar estados financieros auditados anualmente.",
      "Notificar incidentes significativos dentro de tres días.",
      "Mantener seguros y notificar reclamos significativos.",
    ],
  },
  {
    title: "Puntos de negociación",
    items: [
      "Ratios financieros y metas de propiedad de mujeres sujetos a negociación.",
      "Revisar la amplitud de la cláusula de nación más favorecida.",
      "Solicitar exclusión de la deuda con Alaver y de la deuda local en DOP.",
    ],
  },
];
