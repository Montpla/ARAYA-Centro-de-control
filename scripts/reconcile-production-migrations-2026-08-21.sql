-- Producción ya contenía exactamente los objetos de 0019-0024, creados por
-- despliegues operativos anteriores, pero la tabla de control de Wrangler no
-- registró esas seis migraciones. Se verificaron columnas, tablas, trigger e
-- índices antes de ejecutar este archivo. Registrar los nombres evita que
-- Wrangler intente volver a crearlos; 0025 queda deliberadamente fuera para
-- que la aplique la herramienta de migraciones de forma normal.
INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0019_common_thor_girl.sql'),
  ('0020_notify_unmapped_field_candidate_created.sql'),
  ('0021_tv_device_tokens.sql'),
  ('0022_upload_agent_tokens.sql'),
  ('0023_weekly_summary_snapshots.sql'),
  ('0024_sleepy_nightshade.sql');
