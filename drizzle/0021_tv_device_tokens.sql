-- Custom SQL migration file, put your code below! --
-- Tokens de dispositivo para el modo TV/obra (pantallas siempre encendidas).
-- Igual que las sesiones: se guarda solo el hash SHA-256 del token, nunca el
-- token en claro. Los crea y revoca un administrador desde Usuarios y
-- accesos; dan acceso únicamente al resumen no financiero de /api/tv.
CREATE TABLE `tv_device_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_by_email` text DEFAULT '' NOT NULL,
	`created_by_name` text DEFAULT '' NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text DEFAULT '' NOT NULL,
	`last_used_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tv_device_tokens_token_hash_idx` ON `tv_device_tokens` (`token_hash`);
