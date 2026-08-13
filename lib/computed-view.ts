// Envuelve un objeto "resumen" (antonelyDetailTotals, procurementAudit, etc.)
// en un Proxy que recalcula sus campos en cada lectura, en vez de guardar una
// copia que haya que acordarse de resincronizar a mano cada vez que cambian
// sus datos de origen. No hay copia que se pueda quedar congelada porque no
// existe copia: cada `objeto.campo` ejecuta `compute()` en el momento.
// `compute` normalmente es una de las funciones liveX(...) de
// lib/live-derivations.ts, aplicada sobre el estado en vivo actual.
export function computedView<T extends object>(base: T, compute: () => T): T {
  return new Proxy(base, {
    get(target, prop, receiver) {
      const current = compute();
      if (Object.prototype.hasOwnProperty.call(current, prop)) {
        return Reflect.get(current, prop, receiver);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
