-- Custom SQL migration file, put your code below! --
-- Tokens de carga automática: permiten que un equipo de la oficina envíe un
-- archivo al Centro de Control sin que nadie inicie sesión, para que el corte
-- mensual de obra llegue solo desde Microsoft Project.
--
-- Mismo patrón que las sesiones y que los tokens de TV: se guarda únicamente el
-- hash SHA-256, nunca el token en claro, y quedan la caducidad, la revocación y
-- el último uso para poder cortarlos en cualquier momento.
--
-- La diferencia con los de TV es que estos ESCRIBEN, así que llevan además a
-- qué usuario se atribuyen las cargas: el expediente resultante tiene un
-- responsable con nombre y apellidos en la auditoría, igual que si lo hubiera
-- subido a mano. Un token no crea un usuario nuevo ni concede permisos
-- propios; hereda los de quien lo emitió, incluido el acceso financiero.
CREATE TABLE `upload_agent_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`owner_email` text NOT NULL,
	`created_by_email` text DEFAULT '' NOT NULL,
	`created_by_name` text DEFAULT '' NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text DEFAULT '' NOT NULL,
	`last_used_at` text DEFAULT '' NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_agent_tokens_token_hash_idx` ON `upload_agent_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `upload_agent_tokens_owner_idx` ON `upload_agent_tokens` (`owner_email`);
