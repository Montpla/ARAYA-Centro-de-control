# ARAYA Centro de Control

Centro de Control operativo del Grupo Bricket para ARAYA. La fuente canónica
es este repositorio de GitHub y la aplicación se ejecuta exclusivamente en
Cloudflare Workers.

## Producción

- URL: `https://araya-centro-control.grupobricket.workers.dev`
- Worker: `araya-centro-control`
- Base de datos: Cloudflare D1 `araya-centro-control-d1`
- Documentos: Cloudflare R2 `araya-centro-control-files`
- Configuración: `wrangler.deploy.jsonc`

Sites, Railway y el antiguo dominio corporativo no forman parte de la plataforma
vigente y no deben reactivarse.

## Desarrollo

Requiere Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm test
```

## Publicación

```bash
npm run deploy
```

El pipeline ejecuta TypeScript, build, pruebas, despliegue a Cloudflare,
sincronización de documentos corporativos con R2 y comprobación de producción.
Los secretos se gestionan en Cloudflare/GitHub; nunca se guardan en el código.

Lee `HANDOFF.md` para el último estado funcional y `OPERATIONS.md` para la
operación, recuperación y diagnóstico.
