import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Check the DB binding in wrangler.deploy.jsonc or let the Cloudflare runtime inject it before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
