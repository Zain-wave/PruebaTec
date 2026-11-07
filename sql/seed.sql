-- Datos de prueba (generado por scripts/make_seed.js). Registros y archivo son idempotentes; el resumen inserta una fila nueva en cada ejecución.
insert into records (row_key, fecha, cliente, referencia, categoria, cantidad, valor, estado, source_type, source_file, email_message_id, email_received_at, quality_flag, quality_note) values
('2026 10 01|cliente a||servicio a|1|1500|completado', '2026-10-01', 'Cliente A', null, 'Servicio A', 1, 1500, 'Completado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 02|cliente b||servicio b|2|3000|pendiente', '2026-10-02', 'Cliente B', null, 'Servicio B', 2, 3000, 'Pendiente', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 03|cliente c||servicio c|3|4500|cancelado', '2026-10-03', 'Cliente C', null, 'Servicio C', 3, 4500, 'Cancelado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 04|cliente d||servicio a|4|6000|completado', '2026-10-04', 'Cliente D', null, 'Servicio A', 4, 6000, 'Completado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 05|cliente a||servicio b|5|1500|pendiente', '2026-10-05', 'Cliente A', null, 'Servicio B', 5, 1500, 'Pendiente', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 06|cliente b||servicio c|1||cancelado', '2026-10-06', 'Cliente B', null, 'Servicio C', 1, null, 'Cancelado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'error', 'Valor vacío'),
('2026 10 07|cliente c||servicio a|2|4500|completado', '2026-10-07', 'Cliente C', null, 'Servicio A', 2, 4500, 'Completado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 15|cliente d||servicio b|3|6000|pendiente', '2026-10-15', 'Cliente D', null, 'Servicio B', 3, 6000, 'Pendiente', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 09|cliente a||servicio c|4|1500|cancelado', '2026-10-09', 'Cliente A', null, 'Servicio C', 4, 1500, 'Cancelado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 10|cliente b||servicio a|5|3000|raro', '2026-10-10', 'Cliente B', null, 'Servicio A', 5, 3000, 'Raro', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'warning', 'Estado fuera del catálogo: "Raro"'),
('2026 10 11|cliente c||servicio b|1|4500|pendiente', '2026-10-11', 'Cliente C', null, 'Servicio B', 1, 4500, 'Pendiente', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 12|cliente d||servicio c|2|9500000|cancelado', '2026-10-12', 'Cliente D', null, 'Servicio C', 2, 9500000, 'Cancelado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 13|cliente a||servicio a|3|1500|completado', '2026-10-13', 'Cliente A', null, 'Servicio A', 3, 1500, 'Completado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 14|cliente b||servicio b|4|3000|pendiente', '2026-10-14', 'Cliente B', null, 'Servicio B', 4, 3000, 'Pendiente', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 15|cliente c||servicio c|5|4500|cancelado', '2026-10-15', 'Cliente C', null, 'Servicio C', 5, 4500, 'Cancelado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 16|cliente d||servicio a|1|6000|completado', '2026-10-16', 'Cliente D', null, 'Servicio A', 1, 6000, 'Completado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 17|cliente a||servicio b|2|1500|pendiente', '2026-10-17', 'Cliente A', null, 'Servicio B', 2, 1500, 'Pendiente', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 18|cliente b||servicio c|3|3000|cancelado', '2026-10-18', 'Cliente B', null, 'Servicio C', 3, 3000, 'Cancelado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 19|cliente c||servicio a|4|4500|completado', '2026-10-19', 'Cliente C', null, 'Servicio A', 4, 4500, 'Completado', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null),
('2026 10 20|cliente d||servicio b|5|6000|pendiente', '2026-10-20', 'Cliente D', null, 'Servicio B', 5, 6000, 'Pendiente', 'excel', 'sample_registros.xlsx', '<seed@demo>', '2026-11-07T15:58:58.502Z', 'ok', null)
on conflict (row_key) do nothing;

insert into processed_files (message_id, filename, source_type, sender, subject)
values ('<seed@demo>', 'sample_registros.xlsx', 'excel', 'remitente@ejemplo.com', 'Registros de octubre (demo)')
on conflict (message_id, filename) do nothing;

insert into ai_summaries (period_from, period_to, total_records, valor_total, summary, model, used_fallback)
values ('2026-10-01', '2026-10-20', 20, 9566000, 'Resumen de ejemplo cargado desde seed.sql. Ejecuta el workflow 2 en n8n para generar el real.', 'plantilla', true);
