// Genera sql/seed.sql con los datos del Excel de muestra, pasados por la MISMA lógica de n8n.
// Uso: node scripts/make_seed.js  -> luego pega sql/seed.sql en el SQL Editor de Supabase.
const fs = require('fs'), path = require('path');
const { runNode } = require('../tests/harness');
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, '../tests/fixtures/excel_rows.json'), 'utf8'));
const meta = [{ json: { message_id: '<seed@demo>', filename: 'sample_registros.xlsx', received_at: new Date().toISOString() } }];
const all = runNode('04_validar.js', runNode('02_normalizar_excel.js', rows.map((json) => ({ json })), meta), meta).map((i) => i.json);

// El Excel de muestra trae una fila repetida: se deduplica ANTES de contar y sumar.
const seen = new Set();
const out = all.filter((r) => {
  if (seen.has(r.row_key)) return false;
  seen.add(r.row_key);
  return true;
});

const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const cols = ['row_key','fecha','cliente','referencia','categoria','cantidad','valor','estado','source_type','source_file','email_message_id','email_received_at','quality_flag','quality_note'];
const values = out.map((r) => `(${cols.map((c) => q(r[c])).join(', ')})`).join(',\n');
const suma = out.reduce((s, r) => s + (Number.isFinite(Number(r.valor)) ? Number(r.valor) : 0), 0);
const fechas = out.map((r) => r.fecha).filter(Boolean).sort();
const desde = fechas[0] ?? null;
const hasta = fechas[fechas.length - 1] ?? null;

const sql = `-- Datos de prueba (generado por scripts/make_seed.js). Registros y archivo son idempotentes; el resumen inserta una fila nueva en cada ejecución.
insert into records (${cols.join(', ')}) values
${values}
on conflict (row_key) do nothing;

insert into processed_files (message_id, filename, source_type, sender, subject)
values ('<seed@demo>', 'sample_registros.xlsx', 'excel', 'remitente@ejemplo.com', 'Registros de octubre (demo)')
on conflict (message_id, filename) do nothing;

insert into ai_summaries (period_from, period_to, total_records, valor_total, summary, model, used_fallback)
values (${q(desde)}, ${q(hasta)}, ${out.length}, ${suma}, 'Resumen de ejemplo cargado desde seed.sql. Ejecuta el workflow 2 en n8n para generar el real.', 'plantilla', true);
`;
fs.writeFileSync(path.join(__dirname, '../sql/seed.sql'), sql);
console.log(`seed.sql: ${out.length} filas únicas (de ${all.length}), $${suma.toLocaleString('es-CO')} (${desde}..${hasta})`);
