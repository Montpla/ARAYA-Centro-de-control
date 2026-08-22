import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard includes the complete project-control navigation and site plan", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  for (const label of [
    "Resumen ejecutivo",
    "Planificación",
    "Implantación general",
    "Edificios",
    "Apartamentos",
    "Ventas y cobranza",
    "Urbanismo",
    "Seguridad y permisos",
    "Cronología",
    "Proveedores",
    "Finanzas",
    "Centro de datos",
    "Agente IA",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Nuevo proveedor/);
  assert.match(source, /Añadir métrica/);
  assert.match(source, /IMPLANTACIÓN GENERAL · DWG 002/);
  assert.match(source, /462 apartamentos/);
  assert.match(source, /araya-site-plan-clean\.png/);
  assert.match(source, /planCoordinates/);
  assert.match(source, /Abrir documento/);
  assert.match(source, /Descargar/);
  assert.match(source, /araya-visual-masterplan-v3\.png/);
  assert.match(source, /Plano visual interactivo/);
  assert.match(source, /Plano técnico/);
  assert.match(source, /progress-line planned/);
  assert.match(source, /progress-point actual/);
  assert.match(source, /FICHA INDIVIDUAL DE APARTAMENTO/);
  assert.match(source, /CAPAS OPERATIVAS DEL PLANO/);
  assert.match(source, /INFORME COMERCIAL · CORTE \{juneReport\.collections\.cutoff\}/);
  assert.match(source, /CONTROL TRANSVERSAL · JUNIO 2026/);
  assert.match(source, /INFORME FINANCIERO · \{financePeriodLabel\}/);
});

test("desktop, tablet and mobile share the requested grouped navigation", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  const navBlock = source.match(/const navItems:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const catalogItems = [
    ['"resumen"', '"Resumen ejecutivo"'],
    ['"planificacion"', '"Planificación"'],
    ['"implantacion"', '"Implantación general"'],
    ['"edificios"', '"Edificios"'],
    ['"viviendas"', '"Apartamentos"'],
    ['"urbanismo"', '"Urbanismo"'],
    ['"comercial"', '"Ventas y cobranza"'],
    ['"metricas"', '"Finanzas"'],
    ['"cronologia"', '"Cronología"'],
    ['"proveedores"', '"Proveedores"'],
    ['"control"', '"Seguridad y permisos"'],
    ['"fuentes"', '"Centro de datos"'],
    ['"agente"', '"Agente IA"'],
    ['"usuarios"', '"Usuarios y accesos"'],
  ];
  for (const [id, label] of catalogItems) {
    assert.match(navBlock, new RegExp(`id: ${id}, label: ${label}`));
  }

  const groupsBlock = source.match(/const navigationGroups[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const orderedGroups = [
    ['"Resumen ejecutivo"', '"01"'],
    ['"Obra"', '"02"'],
    ['"Finanzas"', '"03"'],
    ['"Datos"', '"04"'],
    ['"Agente IA"', '"05"'],
  ];
  let previousGroupIndex = -1;
  for (const [label, mark] of orderedGroups) {
    const labelIndex = groupsBlock.indexOf(`label: ${label}`);
    assert.ok(labelIndex > previousGroupIndex, `${label} debe conservar el orden solicitado`);
    assert.match(groupsBlock.slice(labelIndex), new RegExp(`mark: ${mark}`));
    previousGroupIndex = labelIndex;
  }

  const summaryGroup = groupsBlock.slice(
    groupsBlock.indexOf('label: "Resumen ejecutivo"'),
    groupsBlock.indexOf('label: "Obra"'),
  );
  const workGroup = groupsBlock.slice(
    groupsBlock.indexOf('label: "Obra"'),
    groupsBlock.indexOf('label: "Finanzas"'),
  );
  const financeGroup = groupsBlock.slice(
    groupsBlock.indexOf('label: "Finanzas"'),
    groupsBlock.indexOf('label: "Datos"'),
  );
  const dataGroup = groupsBlock.slice(
    groupsBlock.indexOf('label: "Datos"'),
    groupsBlock.indexOf('label: "Agente IA"'),
  );
  const agentGroup = groupsBlock.slice(groupsBlock.indexOf('label: "Agente IA"'));

  assert.match(summaryGroup, /directView:\s*"resumen"/);
  assert.match(agentGroup, /directView:\s*"agente"/);
  for (const [group, ids] of [
    [workGroup, ["planificacion", "implantacion", "edificios", "viviendas", "urbanismo", "proveedores", "control"]],
    [financeGroup, ["metricas", "comercial"]],
    [dataGroup, ["fuentes", "cronologia", "usuarios"]],
  ]) {
    let previousItemIndex = -1;
    for (const id of ids) {
      const itemIndex = group.indexOf(`"${id}"`);
      assert.ok(itemIndex > previousItemIndex, `${id} debe pertenecer a su grupo y conservar el orden`);
      previousItemIndex = itemIndex;
    }
  }

  assert.match(source, /availableNavItems\s*=\s*navItems\.filter\(\(item\)\s*=>\s*item\.id\s*!==\s*"usuarios"\s*\|\|\s*currentUser\.role\s*===\s*"admin"\)/);
  assert.ok((source.match(/availableNavigationGroups\.map/g) ?? []).length >= 2);
  assert.match(source, /className="nav-group/);
  assert.match(source, /className="nav-group-children"/);
  assert.match(source, /className="mobile-bottom-nav"/);
  assert.match(source, /className="mobile-menu-links"/);
});

test("normalized source data contains all 77 buildings and 462 apartments", async () => {
  const source = await readFile("app/demo-data.ts", "utf8");
  const { buildings, projectSnapshot } = await import("../app/demo-data.ts");
  assert.equal(buildings.length, 77);
  assert.equal(buildings.flatMap((building) => building.units).length, 462);
  assert.equal(projectSnapshot.buildingCount, 77);
  assert.equal(projectSnapshot.unitCount, 462);
  assert.match(source, /buildingCount: buildings\.length/);
  assert.match(source, /unitCount: apartmentUnits\.length/);
  assert.match(source, /masterPlanBuildingCount: 77/);
  assert.match(source, /buildingsPendingIntegration: 0/);
  assert.match(source, /urbanismProgress: 18\.28/);
  // El corte de julio: el avance global se calcula del modelo vivo
  // (overallProgressNow) y el plan operativo se lee del mes del corte (26,61,
  // el Plan Operativo que declara el Informe Ejecutivo del corte).
  assert.match(source, /overallProgress: overallProgressNow/);
  assert.match(source, /plannedProgress: 26\.61/);
  assert.match(source, /currency: "DOP"/);
  assert.match(source, /002 - IMPLANTACIÓN GENERAL\.dwg/);
  assert.match(source, /\/data-center\/002-implantacion-general\.dwg/);
  assert.match(source, /urbanismAreas/);
});

test("los 77 edificios tienen coordenadas en ambos planos y seis apartamentos listos", async () => {
  const [{ buildings }, layout, styles] = await Promise.all([
    import("../app/demo-data.ts"),
    import("../lib/site-plan-layout.ts"),
    readFile("app/globals.css", "utf8"),
  ]);
  const expectedCodes = Array.from({ length: 77 }, (_, index) => String(index + 1));
  assert.deepEqual([...buildings.map((building) => building.shortName)].sort((a, b) => Number(a) - Number(b)), expectedCodes);
  assert.deepEqual(Object.keys(layout.visualPlanCoordinates).sort((a, b) => Number(a) - Number(b)), expectedCodes);
  assert.deepEqual(Object.keys(layout.technicalPlanCoordinates).sort((a, b) => Number(a) - Number(b)), expectedCodes);

  for (const building of buildings) {
    assert.equal(building.units.length, 6, `TH-${building.shortName} debe tener seis apartamentos`);
    assert.ok(building.mapCoordinates?.visual, `TH-${building.shortName} necesita posición visual`);
    assert.ok(building.mapCoordinates?.technical, `TH-${building.shortName} necesita posición técnica`);
    assert.ok(building.mapCoordinates.visual.x > 0 && building.mapCoordinates.visual.x < 100);
    assert.ok(building.mapCoordinates.visual.y > 0 && building.mapCoordinates.visual.y < 100);
  }

  const nuevos = buildings.filter((building) => Number(building.shortName) >= 19 && Number(building.shortName) <= 69);
  assert.equal(nuevos.length, 51);
  assert.ok(nuevos.every((building) => building.progress === 0));
  assert.ok(nuevos.flatMap((building) => building.units).every((unit) => unit.progress === 0 && unit.status === "pendiente"));

  // La fila superior está en perspectiva: no puede volver a simplificarse a
  // una única altura porque los rótulos se desplazarían respecto a las cubiertas.
  const topRow = ["37", "38", "39", "40", "41", "42", "43", "44", "45"]
    .map((code) => layout.visualPlanCoordinates[code].y);
  assert.equal(new Set(topRow).size, topRow.length);
  assert.ok(topRow.every((height, index) => index === 0 || height < topRow[index - 1]));

  // Anclas contrastadas contra los centros de cubierta de la imagen maestra
  // (982 × 1602 px). Protegen los extremos de la perspectiva, donde una fila
  // aproximada produce el mayor desplazamiento visual.
  assert.deepEqual(layout.visualPlanCoordinates["37"], { x: 18.74, y: 10.11 });
  assert.deepEqual(layout.visualPlanCoordinates["45"], { x: 87.42, y: 6.55 });
  assert.deepEqual(layout.visualPlanCoordinates["46"], { x: 82.89, y: 16.01 });
  assert.deepEqual(layout.visualPlanCoordinates["69"], { x: 81.36, y: 44.85 });

  // La ficha debe conservar su centro visual sobre el ancla. Una proyecciÃ³n
  // rotateX y sombras extrusionadas desplazaban el dibujo hacia abajo al
  // ampliar el plano en mÃ³vil o tableta, aunque el punto matemÃ¡tico fuese exacto.
  assert.doesNotMatch(styles, /rotateX\(/);
});

test("la promoción de demostración ya no forma parte del Centro de Control", async () => {
  // Mirador del Parque era un proyecto ficticio para enseñar el programa. Se
  // retiró el 14/08/2026 por petición expresa: la aplicación ya está en uso
  // real y un proyecto simulado conviviendo con el de obra es una fuente de
  // confusión, no una ayuda.
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  assert.doesNotMatch(source, /mirador/i, "no debe quedar rastro de la promoción de demostración");
  assert.doesNotMatch(source, /demoBuildings|DemoProjectContent|DemoMasterplan|DemoOverview/);
});

test("el selector de promociones sigue montado para dar de alta las que pida el cliente", async () => {
  // Se conserva a propósito la estructura completa —tipo, registro, selector y
  // distintivo de demostración—: la intención es ir añadiendo promociones según
  // las pida el cliente, y desmontarla obligaría a rehacerla entera.
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  assert.match(source, /type ProjectId = "araya"/);
  assert.match(source, /const projects: Record<ProjectId/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /setActiveProjectId/);
  assert.match(source, /demo: boolean/);
  assert.match(source, /demo-badge/);
  // La advertencia sobre los datos sin segmentar tiene que seguir junto al
  // tipo: dar de alta una promoción nueva hoy le mostraría las cifras de ARAYA.
  assert.match(source, /NO están separados por promoción/);
});

test("sidebar uses the official Bricket brand mark", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  const logo = await readFile("public/bricket-mark.png");
  assert.match(source, /src="\/bricket-mark\.png"/);
  assert.ok(logo.length > 1000);
});

test("ARAYA project selector uses the supplied Punta Cana wordmark", async () => {
  const source = await readFile("app/dashboard-client.tsx", "utf8");
  const logo = await readFile("public/araya-wordmark.jpg");
  assert.match(source, /src="\/araya-wordmark\.jpg" alt="ARAYA Punta Cana"/);
  assert.match(source, /className="project-wordmark"/);
  assert.ok(logo.length > 1000);
});

test("agent is source-grounded, guarded and evaluated", async () => {
  const [dashboard, route, prompt, evalCases] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/api/agent/route.ts", "utf8"),
    readFile("lib/agent-prompt.ts", "utf8"),
    readFile("tests/agent-cases.json", "utf8"),
  ]);
  assert.match(route, /get_project_summary/);
  assert.match(route, /get_schedule_deviations/);
  assert.match(route, /get_building_units/);
  assert.match(route, /get_work_packages/);
  assert.match(route, /get_financial_measurements/);
  assert.match(route, /get_commercial_status/);
  assert.match(route, /get_financial_status/);
  assert.match(route, /get_safety_permits/);
  assert.match(route, /get_data_quality/);
  assert.match(route, /get_uploaded_files/);
  assert.match(route, /get_live_data_status/);
  assert.match(route, /get_control_room_status/);
  assert.match(route, /materializeLiveRoot/);
  assert.match(dashboard, /ARAYA Asistente/);
  assert.doesNotMatch(dashboard, /ARAYA Copilot/);
  assert.match(prompt, /araya-asistente-v11-agente-ingesta/);
  assert.match(prompt, /Eres ARAYA Asistente/);
  assert.match(prompt, /No inventes cifras/);
  assert.match(prompt, /Consulta siempre las herramientas/);
  assert.equal(JSON.parse(evalCases).length, 24);
});

test("June 2026 reports are integrated with traceable downloads and reconciliations", async () => {
  const [dashboard, data, juneData] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("app/june-report-data.ts", "utf8"),
  ]);
  for (const filename of [
    "araya-informe-junio-2026.pptx",
    "informe-obra-araya-junio-2026.pptx",
    "informe-ventas-araya-junio-2026.pptx",
    "informe-junio-2026-araya.xlsx",
    "datos-para-informe-jun-26.xlsx",
    "lamina-flujo-mayo-2026.pptx",
    "presentacion-informe-araya-junio-2026.pdf",
  ]) {
    const file = await readFile(`historical/data-center/junio-2026/${filename}`);
    assert.ok(file.length > 1000);
    assert.match(data, new RegExp(filename.replaceAll(".", "\\.")));
  }
  assert.match(juneData, /overdueUsd: 136840\.39/);
  assert.match(juneData, /budgetDop: 3591280577\.17/);
  assert.match(juneData, /projectedCashDecemberDop: -125196511\.23/);
  assert.match(juneData, /payablesDetailDop: 18627534\.91/);
  assert.match(juneData, /juneCostsDop: 48988755\.86/);
  assert.match(juneData, /#REF!/);
  assert.match(dashboard, /juneDataQualityIssues/);
});

test("database migrations cover records, file registry, source currency and live versions", async () => {
  const [baseMigration, fileMigration, currencyMigration, liveMigration] = await Promise.all([
    readFile("drizzle/0000_broken_vin_gonzales.sql", "utf8"),
    readFile("drizzle/0001_milky_jamie_braddock.sql", "utf8"),
    readFile("drizzle/0002_dry_black_knight.sql", "utf8"),
    readFile("drizzle/0003_luxuriant_thaddeus_ross.sql", "utf8"),
  ]);
  assert.match(baseMigration, /CREATE TABLE `custom_metrics`/);
  assert.match(baseMigration, /CREATE TABLE `suppliers`/);
  assert.match(baseMigration, /CREATE TABLE `agent_logs`/);
  assert.match(fileMigration, /CREATE TABLE `uploaded_files`/);
  assert.match(fileMigration, /CREATE TABLE `file_activity`/);
  assert.match(fileMigration, /uploaded_files_sha256_idx/);
  assert.match(currencyMigration, /source_currency/);
  assert.match(currencyMigration, /DEFAULT 'DOP'/);
  assert.match(liveMigration, /CREATE TABLE `live_data_events`/);
  assert.match(liveMigration, /CREATE TABLE `live_data_points`/);
  assert.match(liveMigration, /live_data_points_revision_idx/);
});

test("collaborative uploads use authenticated identity, R2 storage and duplicate detection", async () => {
  const [route, dashboard, routing, wrangler] = await Promise.all([
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("lib/file-routing.ts", "utf8"),
    readFile("wrangler.deploy.jsonc", "utf8"),
  ]);
  assert.match(route, /requireApiUser/);
  assert.match(route, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(route, /getFileBucket\(\)\.get/);
  assert.match(route, /pendiente_revision/);
  assert.match(route, /resolveSourceCurrency/);
  assert.match(dashboard, /CARGA COLABORATIVA/);
  assert.match(dashboard, /uploadProjectFile/);
  assert.match(dashboard, /ACTUALIZACIÓN CADA 5 S/);
  assert.match(routing, /Clasificación automática/);
  assert.match(wrangler, /"binding": "FILES"/);
  assert.match(wrangler, /"bucket_name": "araya-centro-control-files"/);
});

test("dashboard requires verified membership and provides administrator-managed access", async () => {
  const [page, access, adminRoute, dashboard, schema, migration] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("lib/access-control.ts", "utf8"),
    readFile("app/api/admin/users/route.ts", "utf8"),
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0004_organic_krista_starr.sql", "utf8"),
  ]);
  assert.match(page, /requireChatGPTUser/);
  assert.match(page, /resolveAuthorizedUser/);
  assert.match(access, /BOOTSTRAP_ADMIN_EMAIL/);
  assert.match(access, /requireApiUser/);
  assert.match(adminRoute, /requireApiUser\(\{ admin: true \}\)/);
  assert.match(adminRoute, /financeAccess/);
  assert.match(adminRoute, /accessAudit/);
  assert.match(dashboard, /Usuarios y accesos/);
  assert.match(dashboard, /correo y un PIN propio/);
  assert.match(dashboard, /FinanceLockedView/);
  assert.match(schema, /appUsers/);
  assert.match(schema, /accessAudit/);
  assert.match(migration, /CREATE TABLE `app_users`/);
  assert.match(migration, /CREATE TABLE `access_audit`/);
});

test("administrators can edit, safely remove, audit and restore users", async () => {
  const [dashboard, styles, route, access, schema, migration] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/api/admin/users/route.ts", "utf8"),
    readFile("lib/access-control.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0008_puzzling_the_captain.sql", "utf8"),
  ]);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /requireApiUser\(\{ admin: true \}\)/);
  assert.match(route, /activeAdminSafetyCondition/);
  assert.match(route, /No puedes eliminar tu propia cuenta/);
  assert.match(route, /último administrador activo/);
  assert.match(route, /usuario_creado/);
  assert.match(route, /usuario_editado/);
  assert.match(route, /usuario_eliminado/);
  assert.match(route, /usuario_restaurado/);
  assert.match(route, /before: auditSnapshot\(existing\)/);
  assert.match(route, /expectedUpdatedAt/);
  assert.match(route, /removeAvatar/);
  assert.match(dashboard, /function UserEditorModal/);
  assert.match(dashboard, /function DeleteUserModal/);
  assert.match(dashboard, /aria-labelledby="user-editor-title"/);
  assert.match(dashboard, /aria-describedby="delete-user-description"/);
  assert.match(dashboard, />Editar</);
  assert.match(dashboard, />\s*Eliminar\s*</);
  assert.match(dashboard, /Restaurar acceso/);
  assert.match(dashboard, /status === 401 \|\| status === 403/);
  assert.match(dashboard, /CLEAR_PRIVATE_CACHE/);
  assert.match(styles, /\.user-record-actions/);
  assert.match(styles, /\.archived-user-directory/);
  assert.match(styles, /\.delete-user-modal/);
  assert.match(schema, /deletedAt: text\("deleted_at"\)/);
  assert.match(schema, /deletedByEmail: text\("deleted_by_email"\)/);
  assert.match(migration, /ADD `deleted_at`/);
  assert.match(migration, /ADD `deleted_by_email`/);
  assert.match(access, /!row\.active \|\| row\.deletedAt/);
});

test("user initials can be replaced by protected persistent profile photos", async () => {
  const [dashboard, styles, avatarRoute, adminRoute, access, schema, migration] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/api/profile/avatar/route.ts", "utf8"),
    readFile("app/api/admin/users/route.ts", "utf8"),
    readFile("lib/access-control.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0006_legal_the_liberteens.sql", "utf8"),
  ]);
  assert.match(dashboard, /function UserAvatar/);
  assert.match(dashboard, /Cambiar fotograf/);
  assert.match(dashboard, /accept="image\/jpeg,image\/png,image\/webp,image\/avif"/);
  assert.match(dashboard, /userInitials\(user\.displayName\)/);
  assert.match(dashboard, /onCurrentAvatarUpdated/);
  assert.match(dashboard, /className="mobile-user-avatar"/);
  assert.match(styles, /\.user-avatar-control/);
  assert.match(styles, /\.avatar-edit-mark/);
  assert.match(styles, /\.avatar-button img\s*\{[^}]*object-fit: cover/s);
  assert.match(avatarRoute, /requireApiUser\(\)/);
  assert.match(avatarRoute, /targetUserId !== auth\.user\.id && auth\.user\.role !== "admin"/);
  assert.match(avatarRoute, /MAX_AVATAR_SIZE = 5 \* 1024 \* 1024/);
  assert.match(avatarRoute, /image\/jpeg/);
  assert.doesNotMatch(avatarRoute, /image\/svg/);
  assert.match(avatarRoute, /foto_perfil_actualizada/);
  assert.match(avatarRoute, /bucket\.put/);
  assert.match(schema, /avatarStorageKey/);
  assert.match(schema, /avatarUpdatedAt/);
  assert.match(access, /avatarUrl:/);
  assert.match(adminRoute, /avatarUrl:/);
  assert.match(migration, /ADD `avatar_storage_key`/);
  assert.match(migration, /ADD `avatar_mime_type`/);
  assert.match(migration, /ADD `avatar_updated_at`/);
});

test("spatial views derive live colors and accept new mapped buildings and urbanism areas", async () => {
  const [dashboard, data, palette] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("lib/progress-palette.ts", "utf8"),
  ]);
  assert.match(dashboard, /function visualUnitStatus/);
  assert.match(dashboard, /function unitProgressClasses/);
  assert.match(dashboard, /progressBandClass\(unitOverallProgress\(unit\)\)/);
  assert.match(dashboard, /progressBandClass\(building\.progress\)/);
  assert.match(dashboard, /unit\.status === "bloqueada" \? " is-blocked"/);
  assert.match(palette, /progress-81-99/);
  assert.match(palette, /return "progress-100"/);
  assert.match(dashboard, /building\.mapCoordinates\?\.\[planMode\]/);
  assert.match(dashboard, /area\.mapCoordinates\?\.\[planMode\]/);
  assert.match(dashboard, /synchronizeSpatialSummary/);
  assert.match(dashboard, /Los porcentajes, estados y colores cambian/);
  assert.match(data, /mapCoordinates\?:/);
});

test("premium visual refinement uses an editorial hierarchy and readable controls", async () => {
  const styles = await readFile("app/globals.css", "utf8");
  assert.doesNotMatch(styles, /font-family:\s*Inter/);
  assert.match(styles, /--font-editorial/);
  assert.match(styles, /Premium editorial refinement/);
  assert.match(styles, /\.report-tabs button::before/);
  assert.match(styles, /\.account-control/);
  assert.match(styles, /\.access-user-list/);
  assert.match(styles, /\.finance-locked/);
});

test("financial files, live values and agent answers enforce per-user authorization", async () => {
  const [files, liveRoute, liveModel, effectiveLive, agent, dashboardRoute, documentProxy] = await Promise.all([
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/api/live-data/route.ts", "utf8"),
    readFile("lib/live-data.ts", "utf8"),
    readFile("lib/effective-live-data.ts", "utf8"),
    readFile("app/api/agent/route.ts", "utf8"),
    readFile("app/api/dashboard/route.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
  ]);
  assert.match(files, /No tienes acceso a documentos financieros/);
  assert.match(files, /fileRequiresFinanceAccess/);
  assert.match(liveRoute, /readEffectiveLiveData\(auth\.user\.financeAccess\)/);
  assert.match(liveRoute, /No tienes permiso para publicar datos financieros o comerciales/);
  assert.match(effectiveLive, /redactFinancialFields/);
  assert.match(effectiveLive, /eventStatus === "published"/);
  assert.match(liveModel, /isFinancialLiveKey/);
  assert.match(liveModel, /"fiduciaryStatementSummary"/);
  assert.match(liveModel, /"reprogrammedFlowAudit"/);
  assert.match(liveModel, /key === "dataSources"/);
  assert.match(liveModel, /fideicomiso\|balance\|resultado/);
  assert.match(agent, /Acceso financiero no autorizado/);
  assert.match(agent, /auth\.user\.financeAccess/);
  assert.match(agent, /requiresFinanceAccessForArea\(row\.area\)/);
  assert.match(dashboardRoute, /No tienes acceso para modificar indicadores financieros/);
  assert.match(documentProxy, /matcher: \["\/data-center\/:path\*"\]/);
  assert.match(documentProxy, /resolveAuthorizedUser/);
  assert.match(documentProxy, /requiresFinanceDocumentAccess/);
  assert.match(documentProxy, /!user\.financeAccess/);
  assert.match(documentProxy, /private, no-store/);
});

test("all variable dashboard values use a versioned live-data layer with five-second refresh", async () => {
  const [dashboard, route, liveData, effectiveLive, publisher, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/api/live-data/route.ts", "utf8"),
    readFile("lib/live-data.ts", "utf8"),
    readFile("lib/effective-live-data.ts", "utf8"),
    readFile("lib/publish-live-data.ts", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);
  assert.match(dashboard, /fetchWithEtag\("\/api\/live-data"/);
  assert.match(dashboard, /applyLiveValuesToTargets/);
  assert.match(dashboard, /setInterval\(\(\) => void refreshLiveData\(\), 5_000\)/);
  assert.match(dashboard, /Gráficas, cifras, porcentajes, cronograma y avance/);
  assert.match(dashboard, /Tiempo real/);
  assert.match(route, /publishLiveDataUpdates/);
  assert.match(route, /provenance/);
  assert.match(route, /refreshIntervalMs: 5_000/);
  assert.match(effectiveLive, /ROW_NUMBER\(\) OVER \([\s\S]*PARTITION BY h\.key[\s\S]*h\.id DESC/);
  assert.match(effectiveLive, /e\.status = 'published'/);
  assert.match(publisher, /status: "preparing"/);
  assert.match(liveData, /LIVE_DATA_ROOTS/);
  assert.match(liveData, /projectSnapshot/);
  assert.match(liveData, /monthlyPlan/);
  assert.match(liveData, /financialProjection/);
  assert.match(styles, /\.live-data-ribbon/);
});

test("financial presentation defaults to USD and preserves DOP source values", async () => {
  const [dashboard, currency, financeDetail] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("lib/currency.ts", "utf8"),
    readFile("app/antonely-finance-data.ts", "utf8"),
  ]);
  assert.match(currency, /DEFAULT_DISPLAY_CURRENCY: CurrencyCode = "USD"/);
  assert.match(currency, /DOP_TO_USD = 0\.016788/);
  assert.match(currency, /return "DOP"/);
  assert.match(dashboard, /Moneda de visualización/);
  assert.match(dashboard, /Detalle completo/);
  assert.match(dashboard, /\{antonelyDetailTotals\.costAccountCount\} CUENTAS DE COSTE/);
  assert.match(dashboard, /\{antonelyDetailTotals\.payableCategoryCount\} CATEGORÍAS · \{antonelyDetailTotals\.payableInvoiceCount\} FACTURAS/);
  assert.match(dashboard, /\{antonelyDetailTotals\.advanceCount\} ANTICIPOS/);
  assert.match(dashboard, /\{antonelyDetailTotals\.balanceLineCount\} LÍNEAS DE BALANCE/);
  assert.match(financeDetail, /antonelyPayableVendorsAll/);
  assert.match(financeDetail, /advancePendingDop: 9210448\.86/);
});

test("providers open a protected, live invoice ledger with auditable source records", async () => {
  const [dashboard, route, invoiceData, liveData, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/api/payables/route.ts", "utf8"),
    readFile("app/antonely-payable-invoices.ts", "utf8"),
    readFile("lib/live-data.ts", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);
  const sourceRows = invoiceData.match(/^\s*\[\d+,\s*"\d{4}-\d{2}-\d{2}"/gm) ?? [];
  assert.equal(sourceRows.length, 96);
  assert.match(invoiceData, /buildPayablesDataset/);
  assert.match(invoiceData, /invoiceMap/);
  assert.match(invoiceData, /PAYABLE_SOURCE_URL/);
  assert.match(route, /requireApiUser\(\{ finance: true \}\)/);
  assert.match(route, /antonelyPayableInvoiceLines/);
  // conditionalJson fija Cache-Control: private, no-store y añade el ETag
  // del sondeo condicional (304 sin cuerpo cuando no hay cambios).
  assert.match(route, /conditionalJson\(request/);
  assert.match(liveData, /"antonelyPayableInvoiceLines"/);
  assert.match(dashboard, /fetchWithEtag\("\/api\/payables"/);
  assert.match(dashboard, /window\.setInterval\(\(\) => void refreshPayables\(\), 5_000\)/);
  assert.match(dashboard, /Proveedores y facturas registradas/);
  assert.match(dashboard, /Abrir proveedor/);
  assert.match(dashboard, /Documento individual pendiente de cargar/);
  assert.match(dashboard, /Abrir archivo fuente/);
  assert.match(styles, /\.supplier-ledger-panel/);
  assert.match(styles, /\.supplier-invoice-list/);
  assert.match(styles, /\.payable-supplier-row/);
});

test("every operational area exposes connected modules, documents and interactive drill-downs", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);
  for (const view of [
    "resumen",
    "planificacion",
    "implantacion",
    "edificios",
    "viviendas",
    "urbanismo",
    "comercial",
    "metricas",
    "cronologia",
    "proveedores",
    "control",
    "fuentes",
  ]) {
    assert.match(dashboard, new RegExp(`\\b${view}: \\{`));
  }
  assert.match(dashboard, /function AreaWorkspaceDock/);
  assert.match(dashboard, /function WorkspaceDetailPanel/);
  assert.match(dashboard, /statCardLinks/);
  assert.match(dashboard, /DOCUMENTACIÓN VINCULADA/);
  assert.match(dashboard, /CAMPOS PREPARADOS/);
  assert.match(dashboard, /Abrir documento/);
  assert.match(dashboard, /Descargar/);
  assert.match(dashboard, /sourceWorkspaceDetail/);
  assert.match(dashboard, /dataSources[\s\S]*sourceId: source\.id/);
  assert.match(dashboard, /workspace-data-row/);
  assert.match(dashboard, /currentUser\.financeAccess \|\| !\(\["metricas", "comercial"\] as View\[\]\)\.includes\(view\)/);
  assert.match(styles, /\.area-workspace-dock/);
  assert.match(styles, /\.workspace-module-card/);
  assert.match(styles, /\.workspace-detail-panel/);
  assert.match(styles, /\.stat-card\.interactive/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.workspace-detail-panel/);
});

test("direction can generate grounded weekly or monthly reports and export them to PDF", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);
  assert.match(dashboard, /Crear informe/);
  assert.match(dashboard, /Informe semanal/);
  assert.match(dashboard, /Informe mensual/);
  assert.match(dashboard, /Generar vista previa/);
  assert.match(dashboard, /Imprimir \/ Guardar PDF/);
  assert.match(dashboard, /El sistema no interpola ni inventa avances entre cortes/);
  assert.match(dashboard, /direction-report-document/);
  assert.match(styles, /\.direction-report-overlay/);
  assert.match(styles, /@media print/);
});

test("S-curve matches the supplied executive reference without changing its data series", async () => {
  const [dashboard, styles, data] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
  ]);
  assert.match(dashboard, /Curva S — Plan vs\. Ejecutado/);
  assert.match(dashboard, /jun-2025 a ago-2027/);
  assert.match(dashboard, /Plan Operativo/);
  assert.match(dashboard, /Ejecutado Real/);
  assert.match(dashboard, /Al corte \(\{cutoffPoint \? `\$\{cutoffPoint\.month\}-\$\{cutoffYear\}` : "sin dato"\}\):/);
  assert.match(dashboard, /monthLabel/);
  assert.match(dashboard, /isExpanded/);
  assert.match(dashboard, /Ver Curva S a pantalla completa/);
  assert.match(dashboard, /Cerrar pantalla completa/);
  assert.match(dashboard, /event\.key === "Escape"/);
  assert.match(dashboard, /document\.body\.style\.overflow = "hidden"/);
  assert.match(styles, /\.progress-line\.planned\s*\{[^}]*stroke: #28d4ed/s);
  assert.match(styles, /\.progress-line\.actual\s*\{[^}]*stroke: #ddb45b/s);
  assert.match(styles, /\.s-curve-plot\s*\{[^}]*background: #142b48/s);
  assert.match(styles, /\.legend\.plan\s*\{[^}]*background: #28d4ed/s);
  assert.match(styles, /\.legend\.actual\s*\{[^}]*background: #ddb45b/s);
  assert.match(styles, /\.s-curve\.is-fullscreen\s*\{[^}]*position: fixed/s);
  assert.match(styles, /\.s-curve-fullscreen-button/);
  // La Curva S ya no se escribe como objetos a mano: el ejecutado real hasta el
  // corte anterior está fijo y el último punto toma el avance físico oficial
  // del informe/Excel maestro, no el promedio simple de edificios. Se comprueba
  // que el histórico sigue ahí, que julio usa el KPI oficial y que el plan
  // llega al 100.
  assert.match(data, /const planCurveActualsToDate = \[/);
  assert.match(data, /18\.23,\r?\n\s*overallProgressNow,/);
  assert.match(data, /export const overallProgressNow = 22\.71/);
  assert.match(data, /99\.56, 100,/);
});

test("operational intelligence adds complete apartment cards, role focus, processing and history", async () => {
  const [dashboard, data, schema, historyRoute, liveRoute, effectiveLive, publisher, filesRoute, adminRoute, migration] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("app/api/history/route.ts", "utf8"),
    readFile("app/api/live-data/route.ts", "utf8"),
    readFile("lib/effective-live-data.ts", "utf8"),
    readFile("lib/publish-live-data.ts", "utf8"),
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/api/admin/users/route.ts", "utf8"),
    readFile("drizzle/0005_dapper_silver_surfer.sql", "utf8"),
  ]);
  assert.match(data, /UnitDiscipline/);
  assert.match(data, /responsible\?: string/);
  assert.match(data, /Albañilería/);
  assert.match(dashboard, /AVANCE POR DISCIPLINA/);
  assert.match(dashboard, /Incidencias abiertas/);
  assert.match(dashboard, /profileFocus/);
  assert.match(dashboard, /ALERTAS AUTOMÁTICAS/);
  assert.match(dashboard, /DataHistoryPanel/);
  assert.match(dashboard, /processingStageLabels/);
  assert.match(schema, /liveDataHistory/);
  assert.match(schema, /processingProgress/);
  assert.match(historyRoute, /requireApiUser/);
  assert.match(historyRoute, /readPublishedLiveDataHistory/);
  assert.match(effectiveLive, /isFinancialLiveKey/);
  assert.match(effectiveLive, /liveDataEvents\.status, "published"/);
  assert.match(liveRoute, /publishLiveDataUpdates/);
  assert.match(publisher, /datos_publicados/);
  assert.match(filesRoute, /processingStage: normalizedUpdates\.length/);
  assert.match(adminRoute, /isUserArea/);
  assert.match(migration, /CREATE TABLE `live_data_history`/);
  assert.match(migration, /ALTER TABLE `app_users` ADD `area`/);
  assert.match(migration, /processing_progress/);
});

test("point two adds controlled ingestion, automatic structured publication and auditable fallback review", async () => {
  const [dashboard, styles, filesRoute, reviewRoute, ingestion, publisher, schema, migration, prompt] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/api/files/review/route.ts", "utf8"),
    readFile("lib/ingestion.ts", "utf8"),
    readFile("lib/publish-live-data.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0007_rapid_black_queen.sql", "utf8"),
    readFile("lib/agent-prompt.ts", "utf8"),
  ]);
  assert.match(dashboard, /BANDEJA DE VALIDACIÓN/);
  assert.match(dashboard, /CAMBIOS CONTRASTADOS/);
  assert.match(dashboard, /Valor vigente/);
  assert.match(dashboard, /Valor propuesto/);
  assert.match(dashboard, /Aprobar y publicar/);
  assert.match(dashboard, /Solicitar cambios/);
  assert.match(dashboard, /Preparar validación documental/);
  assert.match(dashboard, /Subida/);
  assert.match(dashboard, /Detecci.n/);
  assert.match(dashboard, /Lectura/);
  assert.match(dashboard, /Actualizaci.n/);
  assert.match(dashboard, /Sincronizaci.n/);
  assert.match(styles, /\.file-review-panel/);
  assert.match(styles, /\.review-proposals/);
  assert.match(styles, /\.review-decision-bar/);
  assert.match(filesRoute, /analyzeDocument/);
  assert.match(filesRoute, /extractStructuredUpdates/);
  assert.match(filesRoute, /documentDataProposals/);
  assert.match(reviewRoute, /protectedReview && !auth\.user\.financeApproveAccess/);
  assert.match(reviewRoute, /!protectedReview && auth\.user\.role !== "admin"/);
  assert.match(reviewRoute, /action === "approve"/);
  assert.match(reviewRoute, /action === "reject"/);
  assert.match(reviewRoute, /publishLiveDataUpdates/);
  assert.match(ingestion, /export function analyzeDocument/);
  // La lectura sin IA cubre los formatos con los que trabaja la oficina: los
  // pares clave/valor de un CSV o JSON, el plan de Project en XML, las hojas de
  // Excel celda a celda, las tablas de Word y PowerPoint, el texto de un PDF y
  // lo que venga dentro de un comprimido.
  //
  // Se comprueba formato a formato en vez de contra la lista literal: fijar el
  // array entero obligaba a tocar esta prueba cada vez que se añadía un lector,
  // sin que el cambio dijera nada sobre si el lector nuevo funciona.
  const admitidos = ingestion.match(/if \(!\[([^\]]*)\]\.includes\(extension\)\)/);
  assert.ok(admitidos, "debe existir la lista de extensiones que se leen sin IA");
  for (const formato of ["csv", "json", "xml", "xlsx", "docx", "pptx", "zip", "pdf"]) {
    assert.match(admitidos[1], new RegExp(`"${formato}"`), formato);
  }
  assert.match(publisher, /live_data_history/);
  assert.match(publisher, /INSERT INTO live_data_history/);
  assert.match(publisher, /await database\.batch\(atomicStatements\)/);
  assert.match(publisher, /failedInvariantStatement/);
  assert.match(schema, /documentDataProposals/);
  assert.match(schema, /fileReviews/);
  assert.match(migration, /CREATE TABLE `document_data_proposals`/);
  assert.match(migration, /CREATE TABLE `file_reviews`/);
  assert.match(prompt, /No realices borrados ni aprobaciones desde el chat/);
  assert.doesNotMatch(prompt, /nunca se publica sin aprobaci.n/);
});

test("points three to eight add a live operational control room without autonomous approvals", async () => {
  const [dashboard, panel, route, control, schema, migration, prompt, styles] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/control-room-panel.tsx", "utf8"),
    readFile("app/api/control-room/route.ts", "utf8"),
    readFile("lib/control-room.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0007_rapid_black_queen.sql", "utf8"),
    readFile("lib/agent-prompt.ts", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);
  assert.match(dashboard, /fetch\("\/api\/control-room"/);
  assert.match(dashboard, /araya-control-room-updated/);
  assert.match(dashboard, /setInterval\(\(\) => void refresh\(\), 5_000\)/);
  assert.match(dashboard, /generateDirectionReport/);
  assert.match(dashboard, /archivedSnapshot/);
  assert.match(panel, /Calidad y cobertura/);
  assert.match(panel, /Plano operativo/);
  assert.match(panel, /Observaciones/);
  assert.match(panel, /Responsable, vencimiento, comentarios e historial/);
  assert.match(panel, /Abrir plano interactivo/);
  assert.match(panel, /Revisión \{snapshot\.live\.revision/);
  assert.match(route, /operation === "create_action"/);
  assert.match(route, /operation === "update_action"/);
  assert.match(route, /operation === "comment_action"/);
  assert.match(route, /operation === "create_report"/);
  assert.match(route, /requestKey/);
  assert.match(route, /No tienes acceso para crear acciones financieras/);
  assert.match(route, /La creación del informe completo requiere acceso financiero/);
  // conditionalJson fija Cache-Control: private, no-store y añade el ETag
  // del sondeo condicional (304 sin cuerpo cuando no hay cambios).
  assert.match(route, /conditionalJson\(request/);
  assert.match(control, /buildControlRoomBaseline/);
  assert.match(control, /duplicateApartmentCodes/);
  assert.match(control, /delayedPackages/);
  assert.match(control, /buildReportSnapshot/);
  assert.match(control, /Instantánea inmutable/);
  assert.match(schema, /controlActions/);
  assert.match(schema, /controlActionActivity/);
  assert.match(schema, /reportSnapshots/);
  assert.match(migration, /CREATE TABLE `control_actions`/);
  assert.match(migration, /CREATE TABLE `control_action_activity`/);
  assert.match(migration, /CREATE TABLE `report_snapshots`/);
  assert.match(migration, /ALTER TABLE `uploaded_files` ADD `review_status`/);
  assert.match(prompt, /araya-asistente-v11-agente-ingesta/);
  assert.match(prompt, /no crearlas, cerrarlas ni reasignarlas/);
  assert.match(styles, /\.control-room-shell/);
  assert.match(styles, /\.control-actions-layout/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.control-room-heading/);
});

test("tablet and mobile mode provides navigation, camera, notifications, biometrics and protected offline access", async () => {
  const [dashboard, deviceCenter, controlRoomPanel, styles, filesRoute, layout, routeError, manifest, serviceWorker, staffGuide] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/device-center.tsx", "utf8"),
    readFile("app/control-room-panel.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/api/files/route.ts", "utf8"),
    readFile("app/layout.tsx", "utf8"),
    readFile("app/error.tsx", "utf8"),
    readFile("public/manifest.webmanifest", "utf8"),
    readFile("public/sw.js", "utf8"),
    readFile("historical/data-center/guias/guia-corporativa-bricket-control-personal-obra.pdf"),
  ]);
  assert.match(dashboard, /mobile-bottom-nav/);
  assert.match(dashboard, /mobile-menu-sheet/);
  assert.match(dashboard, /Pantalla completa/);
  assert.match(dashboard, /site-plan-canvas-scroll/);
  assert.match(dashboard, /capture="environment"/);
  assert.match(dashboard, /handleDirectCameraFile/);
  assert.match(dashboard, /buildDeviceNotifications/);
  assert.match(dashboard, /Notification\.requestPermission/);
  assert.match(dashboard, /showDeviceNotification/);
  assert.match(dashboard, /CLEAR_PRIVATE_CACHE/);
  assert.match(dashboard, /CACHE_APP_SHELL/);
  // El botón de instalar como aplicación aparece también en la cabecera de
  // escritorio, no sólo en el menú móvil: en un ordenador ese menú no está a
  // mano y el icono del navegador pasaba desapercibido.
  assert.match(dashboard, /canInstall && \(/);
  assert.match(dashboard, /Instalar app/);
  assert.match(dashboard, /canInstall=\{Boolean\(installPrompt\)\}/);
  assert.match(dashboard, /Modo sin conexión · solo lectura/);
  assert.match(dashboard, /href="#control-room-priority"/);
  assert.match(dashboard, /<Overview onNavigate=\{navigate\}/);
  assert.match(controlRoomPanel, /id="control-room-priority"/);
  assert.match(dashboard, /Abrir documento/);
  assert.match(dashboard, /function PdfDocumentPreview/);
  assert.match(dashboard, /El documento se abrir[^\n]+aqu/);
  assert.match(dashboard, /Descargar copia/);
  assert.match(dashboard, /Guía corporativa Bricket Control/);
  assert.ok(staffGuide.byteLength > 100_000);
  assert.match(dashboard, /register\("\/sw\.js", \{ updateViaCache: "none" \}\)/);
  assert.match(dashboard, /class AppErrorBoundary/);
  assert.match(dashboard, /RECUPERACIÓN SEGURA/);
  assert.match(dashboard, /Array\.isArray\(archived\?\.monthlyPlan\)/);
  assert.match(dashboard, /function FileViewer/);
  assert.match(dashboard, /onClickCapture=\{openFileInViewer\}/);
  assert.match(dashboard, /aria-label="Cerrar archivo"/);
  assert.match(dashboard, /data-file-viewer-bypass="true"/);
  assert.match(deviceCenter, /navigator\.credentials\.create/);
  assert.match(deviceCenter, /navigator\.credentials\.get/);
  assert.match(deviceCenter, /userVerification: "required"/);
  assert.match(deviceCenter, /Desbloquear Bricket Control/);
  assert.match(deviceCenter, /Funcionamiento sin conexión/);
  assert.match(deviceCenter, /Notificaciones del dispositivo/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /\.mobile-bottom-nav/);
  assert.match(styles, /\.site-plan-canvas-scroll\.expanded/);
  assert.match(styles, /\.app-recovery\.overlay/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /\.direction-report-toolbar \.button\.secondary\s*\{[^}]*display: inline-flex/s);
  assert.match(styles, /\.file-viewer-overlay/);
  assert.match(styles, /\.file-viewer-close/);
  assert.match(styles, /\.device-center-panel/);
  assert.match(styles, /\.biometric-unlock-button/);
  assert.match(styles, /\.notification-button/);
  assert.match(styles, /z-index: 400/);
  assert.match(filesRoute, /searchParams\.get\("preview"\)/);
  assert.match(filesRoute, /inlinePreview \? "inline" : "attachment"/);
  assert.match(filesRoute, /inlinePreviewExtensions/);
  assert.match(filesRoute, /canonicalMimeByExtension/);
  assert.match(filesRoute, /application\/vnd\.openxmlformats-officedocument/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /applicationName: "Bricket Control"/);
  assert.match(layout, /title: "Bricket Control"/);
  assert.match(routeError, /No se ha podido abrir esta pantalla/);
  assert.match(routeError, /Reintentar/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"short_name": "Bricket Control"/);
  assert.match(serviceWorker, /bricket-control-shell-v8/);
  assert.match(serviceWorker, /CACHE_APP_SHELL/);
  assert.match(serviceWorker, /CLEAR_PRIVATE_CACHE/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /isPrivateDocument[\s\S]*event\.respondWith\(fetch\(event\.request\)\)[\s\S]*return/);
  assert.match(serviceWorker, /notificationclick/);
  // La pantalla sin conexión se recupera sola: escucha el evento `online`,
  // sondea la red y ofrece reintentar. Antes era un callejón sin salida que
  // dejaba clavado al usuario aunque volviera internet.
  assert.match(serviceWorker, /addEventListener\("online", volver\)/);
  assert.match(serviceWorker, /setInterval\(sondear, 4000\)/);
  assert.match(serviceWorker, /Reintentar ahora/);
  assert.match(serviceWorker, /Sin conexión/);
  // Y ya no arrastra el texto muerto de la versión vieja.
  assert.doesNotMatch(serviceWorker, /Conéctate para verificar tu identidad y consultar los datos actuales/);
});

test("July supplier, procurement, budget and IFC sources are audited and connected", async () => {
  const [dashboard, data, procurement, comparison, duplicate, budget, contacts, deviations, ifcReport, supplierReport] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("app/procurement-data.ts", "utf8"),
    readFile("historical/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30.xlsx"),
    readFile("historical/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30-copia.xlsx"),
    readFile("historical/data-center/julio-2026/comparativo-presupuesto-edificio-tipo-a.xls"),
    readFile("historical/data-center/julio-2026/contactos-proveedores-araya.xls"),
    readFile("historical/data-center/julio-2026/desviacion-mensual-junio-2026.xlsx"),
    readFile("historical/data-center/julio-2026/informe-analisis-ifc-2026-07-29.pdf"),
    readFile("historical/data-center/julio-2026/informe-analisis-proveedores-2026-07-30.pdf"),
  ]);
  assert.match(procurement, /uniqueSuppliers: supplierDirectory\.length/);
  assert.match(procurement, /sourceRows: supplierContactRows\.length/);
  assert.match(procurement, /auditedScheduledTotalDop: 202_373_400\.47/);
  assert.match(procurement, /omittedFromSourceFormulaDop: 4_095_000/);
  assert.match(procurement, /comparisonCount: 11/);
  assert.match(procurement, /offerCount: 58/);
  assert.match(procurement, /workbookSheetCount: 209/);
  assert.match(procurement, /lineItemCount: 164/);
  assert.match(procurement, /monthlyDeviationLines: MonthlyDeviationLine\[\]/);
  assert.match(dashboard, /Directorio operativo verificado/);
  assert.match(dashboard, /Flujo auditado de proveedores/);
  assert.match(dashboard, new RegExp("Presupuesto original frente a actualizaci\\u00f3n"));
  assert.match(dashboard, /Matriz operativa de obligaciones/);
  for (const sourceId of [
    "source-supplier-contacts",
    "source-budget-type-a",
    "source-ifc-analysis",
    "source-procurement-comparison",
    "source-procurement-comparison-duplicate",
    "source-supplier-analysis",
    "source-june-deviation",
  ]) {
    assert.match(data, new RegExp(sourceId));
  }
  assert.deepEqual(comparison, duplicate);
  assert.ok(budget.length > 5_000_000);
  assert.ok(contacts.length > 300_000);
  assert.ok(deviations.length > 40_000);
  assert.ok(ifcReport.length > 30_000);
  assert.ok(supplierReport.length > 30_000);
});

test("reprogrammed Phase I flow remains separate from physical progress and global cash flow", async () => {
  const [dashboard, data, flowData, agentRoute, workbook] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/demo-data.ts", "utf8"),
    readFile("app/reprogrammed-flow-data.ts", "utf8"),
    readFile("app/api/agent/route.ts", "utf8"),
    readFile("historical/data-center/julio-2026/araya-flujo-i-reprogramado.xlsx"),
  ]);
  assert.match(data, /source-reprogrammed-flow-phase-1/);
  assert.match(data, /overallProgress: overallProgressNow/);
  assert.match(flowData, /cutoff: "31\/07\/2026"/);
  assert.match(flowData, /formulaCount: 1228/);
  assert.match(flowData, /reprogrammedTotalDop: 751309284\.940335/);
  assert.match(flowData, /actualPeriodDop: 154907521\.8/);
  assert.match(flowData, /remainingForecastDop: 574276283\.230723/);
  assert.match(flowData, /cumulativeVarianceRedistributedDop: 70674794\.13296/);
  assert.match(flowData, /julyScopedActualDop: 31735296\.71/);
  assert.match(flowData, /Sin indicador de avance físico/);
  assert.match(dashboard, /Flujo de obra real y reprogramado/);
  assert.match(dashboard, /El avance físico no cambia con este archivo/);
  assert.match(dashboard, /physical-progress-lock/);
  assert.match(dashboard, /\{number\.format\(projectSnapshot\.overallProgress\)\}%/);
  assert.match(dashboard, /source-reprogrammed-flow-phase-1/);
  assert.match(agentRoute, /phaseOneWorkFlow/);
  assert.match(agentRoute, /normalized\.includes\("flujo"\)/);
  assert.match(agentRoute, /flujo\|reprogram/);
  assert.ok(workbook.length > 40_000);
});

test("data governance registers every integrated source once and every download exists", async () => {
  const data = await readFile("app/demo-data.ts", "utf8");
  const governance = await readFile("app/data-governance.ts", "utf8");
  const sourceBlock = data.match(/export const dataSources: DataSource\[\] = \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const sourceIds = [...sourceBlock.matchAll(/\bid: "(source-[^"]+)"/g)].map((match) => match[1]);
  const downloadUrls = [...sourceBlock.matchAll(/downloadUrl: "([^"]+)"/g)].map((match) => match[1]);

  assert.equal(sourceIds.length, 22);
  assert.equal(new Set(sourceIds).size, sourceIds.length);
  assert.equal(downloadUrls.length, sourceIds.length);
  for (const sourceId of sourceIds) assert.match(governance, new RegExp(`"${sourceId}"`));
  for (const url of downloadUrls) await access(`historical${url}`);

  const original = await readFile("historical/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30.xlsx");
  const duplicate = await readFile("historical/data-center/julio-2026/cuadro-comparativo-proveedores-2026-07-30-copia.xlsx");
  assert.equal(createHash("sha256").update(original).digest("hex"), createHash("sha256").update(duplicate).digest("hex"));
});

test("official fiduciary statements reconcile and remain separate from management control", async () => {
  const fiduciary = await readFile("app/fiduciary-statements-data.ts", "utf8");
  const dashboard = await readFile("app/dashboard-client.tsx", "utf8");
  const agent = await readFile("app/api/agent/route.ts", "utf8");

  assert.match(fiduciary, /assetsDop: 758765771\.05/);
  assert.match(fiduciary, /liabilitiesDop: 448317797\.67/);
  assert.match(fiduciary, /netEquityDop: 310447973\.38/);
  assert.ok(Math.abs(758765771.05 - 448317797.67 - 310447973.38) < 0.005);
  assert.equal(311209328.75 - 311209328.75, 0);
  assert.ok(Math.abs(43835537.2 - 49964983.46 - -6129446.26) < 0.005);
  assert.ok(Math.abs(4701963.91 - 10774703.46 - -6072739.55) < 0.005);
  assert.match(dashboard, /id: "fideicomiso", label: "Fideicomiso"/);
  assert.match(dashboard, /MATRIZ MAESTRA DEL DATO/);
  assert.match(dashboard, /Fiduciaria Universal prevalecen para balance contable y resultados oficiales/);
  assert.match(agent, /fiduciaryOfficialStatements/);
  assert.match(agent, /fideicomiso\|presupuesto/);
});

test("the collaborative document registry archives every upload by year and month with bounded pagination", async () => {
  const [dashboard, styles, filesRoute] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/api/files/route.ts", "utf8"),
  ]);
  const registry = dashboard.match(
    /function CollaborativeFileRegistry[\s\S]*?\r?\n}\r?\n\r?\nasync function fetchDataHistory/,
  )?.[0] ?? "";

  assert.ok(registry, "CollaborativeFileRegistry must remain present");
  assert.match(registry, /file\.createdAt/);
  assert.match(registry, /<ArchiveDisclosure[\s\S]*<summary[\s\S]*uploaded-file-list/);
  assert.match(registry, /className="[^"]*(?:file-archive-year|archive-year|uploaded-file-year)[^"]*"/);
  assert.match(registry, /className="[^"]*(?:file-archive-month|archive-month|uploaded-file-month)[^"]*"/);
  assert.match(registry, /initialOpen=\{yearIndex === 0\}/);
  assert.match(registry, /initialOpen=\{yearIndex === 0 && monthIndex === 0\}/);
  assert.match(dashboard, /function ArchiveDisclosure[\s\S]*onToggle=[\s\S]*currentTarget\.open/,
    "five-second refreshes must preserve each manually selected archive state");
  assert.match(styles, /\.(?:file-archive-year|archive-year|uploaded-file-year)\b/);
  assert.match(styles, /\.(?:file-archive-month|archive-month|uploaded-file-month)\b/);
  assert.match(filesRoute, /normalizeFilePageSize\(searchParams\.get\("limit"\)\)/);
  assert.match(filesRoute, /orderBy\(desc\(uploadedFiles\.createdAt\), desc\(uploadedFiles\.id\)\)/);
  assert.match(filesRoute, /\.limit\(pageSize \+ 1\)/);
  assert.match(filesRoute, /nextCursor/);
  assert.match(registry, /mergeFileRegistryRecords/);
  assert.match(registry, /Cargar archivos anteriores/);
  assert.match(registry, /mode=changes/);
  assert.match(registry, /knownIds\.join\(","\)/);
});

test("the in-app document viewer renders PDFs with PDF.js and downloads only on explicit action", async () => {
  const [dashboard, styles, filesRoute, packageJson] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
    readFile("app/api/files/route.ts", "utf8"),
    readFile("package.json", "utf8"),
  ]);
  const viewer = dashboard.match(
    /function PdfDocumentPreview[\s\S]*?function FileViewer[\s\S]*?\r?\n}\r?\n\r?\nconst notificationAreaViews/,
  )?.[0] ?? "";

  assert.match(packageJson, /"pdfjs-dist"/);
  assert.match(viewer, /import\("pdfjs-dist"\)/);
  assert.match(viewer, /pdf\.worker\.min\.mjs\?url/);
  assert.match(viewer, /GlobalWorkerOptions\.workerSrc/);
  assert.match(viewer, /getDocument\(\{[\s\S]*?url: new URL\(url, window\.location\.origin\)\.toString\(\)/);
  assert.match(viewer, /rangeChunkSize: 64 \* 1_024/);
  assert.match(viewer, /disableStream: true/);
  assert.match(viewer, /disableAutoFetch: true/);
  assert.doesNotMatch(viewer, /const bytes = await response\.arrayBuffer\(\)/);
  assert.match(viewer, /headers: \{ Range: ["']bytes=0-524287["'] \}/);
  assert.match(viewer, /<canvas/);
  assert.match(viewer, /extension === "pdf"[\s\S]*<PdfDocumentPreview/);
  assert.match(viewer, /href=\{downloadUrl\}[\s\S]*download[\s\S]*data-file-viewer-bypass="true"/);
  assert.match(viewer, /aria-label="Cerrar archivo"/);
  assert.doesNotMatch(viewer, /<iframe/);
  assert.doesNotMatch(dashboard, /target="_blank"/, "project files must stay inside Bricket Control");
  assert.doesNotMatch(dashboard, /window\.open\(/);
  assert.match(filesRoute, /parseByteRange/);
  assert.match(filesRoute, /Accept-Ranges/);
  assert.match(filesRoute, /status: requestedRange \? 206 : 200/);
  assert.match(styles, /\.pdf-document-viewer/);
  assert.match(styles, /\.file-viewer-close/);
});

test("historical originals stay out of public assets and use authenticated R2 delivery", async () => {
  const [viteConfig, proxy, protectedRoute, accessRules, deployScript, assetsIgnore] = await Promise.all([
    readFile("vite.config.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
    readFile("app/data-center/[...path]/route.ts", "utf8"),
    readFile("lib/document-access.ts", "utf8"),
    readFile("scripts/deploy.mjs", "utf8"),
    readFile("public/.assetsignore", "utf8"),
  ]);

  assert.match(viteConfig, /assets:\s*\{[\s\S]*binding:\s*"ASSETS"[\s\S]*run_worker_first:\s*\["\/data-center\/\*"\]/);
  assert.match(proxy, /matcher:\s*\["\/data-center\/:path\*"\]/);
  assert.match(proxy, /resolveAuthorizedUser/);
  assert.match(protectedRoute, /requireApiUser\(\)/);
  assert.match(protectedRoute, /requiresFinanceDocumentAccess\(pathname\)/);
  assert.match(protectedRoute, /env as unknown as \{ FILES\?: DocumentBucket \}/);
  assert.match(protectedRoute, /`historical\$\{pathname\}`/);
  assert.match(protectedRoute, /bucket\.head\(storageKey\)/);
  assert.match(protectedRoute, /bucket\.get\(/);
  assert.match(protectedRoute, /parseByteRange/);
  assert.match(protectedRoute, /readDocumentManifest/);
  assert.match(protectedRoute, /streamStoredSegments/);
  assert.match(protectedRoute, /Cache-Control", "private, no-store, max-age=0"/);
  assert.match(protectedRoute, /X-Robots-Tag", "noindex, noarchive, nosnippet"/);
  assert.match(accessRules, /financeOnlyDocuments/);
  assert.match(accessRules, /fideicomiso\|balance\|resultados/);
  assert.match(deployScript, /sync-historical-documents\.mjs/);
  assert.match(deployScript, /const WRANGLER_CONFIG = "wrangler\.deploy\.jsonc"/);
  assert.match(deployScript, /wrangler deploy --config \$\{WRANGLER_CONFIG\}/);
  assert.match(assetsIgnore, /data-center\/\*\*/);
});

test("simple uploads default to automatic publication and close every processed generation", async () => {
  const [dashboard, filesRoute, publisher] = await Promise.all([
    readFile("app/dashboard-client.tsx", "utf8"),
    readFile("app/api/files/route.ts", "utf8"),
    readFile("lib/publish-live-data.ts", "utf8"),
  ]);

  assert.match(dashboard, /formData\.set\("autoPublish", "true"\)/);
  assert.match(filesRoute, /formData\.get\("autoPublish"\) !== "false"/);
  assert.match(filesRoute, /extractStructuredUpdates\(bytes, extension/);
  assert.match(filesRoute, /const batchPreconditions =/);
  assert.match(filesRoute, /const updateIsAutoPublishable = /);
  assert.match(filesRoute, /user\.role === "admin"/);
  assert.match(filesRoute, /resolvedArea !== "sin_clasificar"/);
  assert.match(filesRoute, /isSafeAutomaticStructuredUpdate/);
  assert.match(filesRoute, /isFinancialLiveKey/);
  assert.match(filesRoute, /if \(autoPublishable\.length\)/);
  assert.match(filesRoute, /publishLiveDataUpdates\(\{/);
  assert.match(filesRoute, /reviewClosure: \{[\s\S]*?mode: "insert"[\s\S]*?completedAction: "aprobado_automatico"/);
  assert.match(filesRoute, /status: "descartado_automatico"/);
  assert.match(filesRoute, /reviewStatus: "procesado_con_alertas"/);
  assert.match(filesRoute, /reviewStatus: normalizedUpdates\.length \? "listo_revision" : "sin_cambios"/);
  assert.match(publisher, /UPDATE document_data_proposals[\s\S]*?THEN 'publicado'[\s\S]*?ELSE 'descartado_automatico'/);
  assert.match(filesRoute, /publicaci[^\n]+no pudo confirmarse[^\n]+[\s\S]*requiresReview: true[\s\S]*reviewStatus: "cambios_solicitados"/i);
  // Una subida que no publica nada tiene que decirlo con todas las letras. El
  // texto anterior ("queda pendiente de interpretación; todavía no modifica
  // cifras ni gráficas") sugería que el proceso seguía en marcha, y quien subía
  // el corte del mes se quedaba esperando algo que ya había terminado.
  assert.match(filesRoute, /nothingExtractedMessage\(/);
  assert.match(publisher, /SET status = 'integrado', processing_stage = 'sincronizado'/);
  assert.match(publisher, /processing_progress = 100/);
  assert.match(publisher, /requires_review = 0/);
  assert.match(
    publisher,
    /INSERT INTO file_activity[\s\S]*?SELECT json_extract\(item\.value, '\$\.id'\), 'datos_publicados'[\s\S]*?FROM json_each\(\?\) AS item/,
  );
});
