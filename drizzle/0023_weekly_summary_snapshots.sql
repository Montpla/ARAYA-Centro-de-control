-- Instantánea semanal del avance para el resumen automático por correo.
--
-- Cada envío del resumen guarda aquí una foto del avance —global, por edificio
-- y documentos subidos— y el envío de la semana siguiente compara contra la
-- última para contar la variación ("TH-07 subió 4 puntos esta semana"). El
-- modelo vivo sólo sabe cómo están las cosas ahora; esta tabla es la memoria
-- de cómo estaban el lunes pasado, que es lo único que permite contar el
-- avance de la semana en vez de un total suelto.
CREATE TABLE `weekly_summary_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`overall_progress` real DEFAULT 0 NOT NULL,
	`buildings_json` text DEFAULT '{}' NOT NULL,
	`documents_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weekly_summary_snapshots_created_at_idx` ON `weekly_summary_snapshots` (`created_at`);
