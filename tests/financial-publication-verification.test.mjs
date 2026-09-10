import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [filesRoute, reviewRoute, publisher, verifier, schema, migration, dashboard] = await Promise.all([
  readFile("app/api/files/route.ts", "utf8"),
  readFile("app/api/files/review/route.ts", "utf8"),
  readFile("lib/publish-live-data.ts", "utf8"),
  readFile("lib/post-publish-verification.ts", "utf8"),
  readFile("db/schema.ts", "utf8"),
  readFile("drizzle/0028_smooth_fantastic_four.sql", "utf8"),
  readFile("app/dashboard-client.tsx", "utf8"),
]);

test("la carga financiera persiste controles, autoridad, moneda y recibo", () => {
  assert.match(filesRoute, /canonicalizeFinancialUpdates/);
  assert.match(filesRoute, /validateFinancialPublication/);
  assert.match(filesRoute, /processingReceiptJson: JSON\.stringify\(storedReceipt\)/);
  assert.match(filesRoute, /financialValidation\.blockingKeys/);
  assert.match(filesRoute, /numericBeforeAfter/);
  assert.match(filesRoute, /audit: currencyPreparation\.audit/);
  assert.match(schema, /processingReceiptJson: text\("processing_receipt_json"\)/);
  assert.match(migration, /ADD `processing_receipt_json`/);
});

test("la aprobación manual no puede publicar un grupo financiero que siga descuadrado", () => {
  assert.match(reviewRoute, /validateFinancialPublication/);
  assert.match(reviewRoute, /financialValidation\.blockingKeys\.length/);
  assert.match(reviewRoute, /storedMonetaryAudit/);
  assert.match(reviewRoute, /sourceAuthority: financialValidation\.authority/);
});

test("cada revisión publicada se relee y verifica en todas sus vistas", () => {
  // La comprobación cruzada tras publicar ya no vuelve a ejecutar
  // validateFinancialPublication: un descuadre aritmético no bloquea ni
  // marca una publicación como fallida (se publica "cuadre o no cuadre" y
  // el descuadre queda como advertencia en el recibo, no aquí). Esta
  // segunda barrera sigue confirmando que la escritura realmente ganó en
  // el snapshot vivo y respeta el contrato de datos.
  assert.match(publisher, /verifyPublishedLiveData/);
  assert.match(verifier, /readEffectiveLiveData\(true\)/);
  assert.match(verifier, /point\.revision !== input\.eventId/);
  assert.match(verifier, /verification\.status === "failed"/);
  assert.match(verifier, /post_publish_verification_failed/);
  for (const column of ["financial_validation_json", "monetary_audit_json", "source_authority_json", "affected_views_json", "verification_json"]) {
    assert.match(migration, new RegExp(column));
  }
});

test("una verificación fallida avisa aunque la publicación no venga de un archivo", () => {
  // Una corrección manual (sin sourceFileIds, por ejemplo un ajuste puntual
  // de datos vivos) puede fallar esta misma comprobación transversal. Antes
  // el aviso sólo salía si había un archivo de origen al que marcar
  // "requiere revisión"; una corrección sin archivo fallaba en silencio
  // hasta que alguien lo notara a simple vista (pasó con "Movimiento de
  // tierra" al 72,76%). El bloque de aviso debe ejecutarse siempre que
  // status === "failed"; sólo el marcado del archivo depende de que existan
  // sourceFileIds.
  const block = verifier.slice(verifier.indexOf('if (verification.status === "failed") {'));
  const fileFlagIf = block.indexOf("if (input.sourceFileIds.length) {");
  const emitCall = block.indexOf("await emitMissingNotifications([{");
  assert.ok(fileFlagIf >= 0 && emitCall >= 0, "no se encontró la estructura esperada del bloque de fallo");
  assert.ok(emitCall > fileFlagIf, "emitMissingNotifications debe quedar fuera del if de sourceFileIds, no anidado dentro");
  const fileFlagBlock = block.slice(fileFlagIf, emitCall);
  assert.match(fileFlagBlock, /requiresReview: true/);
  assert.doesNotMatch(fileFlagBlock, /emitMissingNotifications/);
});

test("reconocer una verificación posterior fallida nunca publica ni toca datos vivos", () => {
  // acknowledge_verification cierra el aviso de un expediente que quedó
  // "verificacion_posterior_fallida" (otra fuente con más autoridad ya tenía
  // esas claves y las conservó) sin publicar nada ni alterar ninguna cifra:
  // sólo cambia el estado de revisión del propio archivo, con un motivo
  // auditable, y exige que venga justo de ese estado.
  const branch = reviewRoute.slice(
    reviewRoute.indexOf("isAcknowledgeVerification) {"),
    reviewRoute.indexOf("const action = payload.action as ReviewAction;"),
  );
  assert.match(branch, /reviewStatus !== "verificacion_posterior_fallida"/);
  assert.match(branch, /if \(!note\)/);
  assert.match(branch, /requiresReview: false/);
  assert.match(branch, /reviewStatus: "aprobado"/);
  assert.doesNotMatch(branch, /publishLiveDataUpdates/);
  assert.doesNotMatch(branch, /documentDataProposals/);
});

test("el recibo financiero explica controles, conversiones, cambios y comprobación final", () => {
  assert.match(dashboard, /FinancialReceiptPanel/);
  assert.match(dashboard, /Controles contables/);
  assert.match(dashboard, /Autoridad y periodo/);
  assert.match(dashboard, /Conversion monetaria/);
  assert.match(dashboard, /financial-receipt-changes/);
  assert.match(dashboard, /financial-receipt-alerts/);
});
