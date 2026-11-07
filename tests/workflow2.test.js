const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runNode, runRaw } = require('./harness');

const rows = [
  { row_key: 'k1', fecha: '2026-10-01', cliente: 'A', categoria: 'S1', valor: 100, estado: 'Completado', quality_flag: 'ok' },
  { row_key: 'k2', fecha: '2026-10-02', cliente: 'B', categoria: 'S1', valor: 200, estado: 'Pendiente', quality_flag: 'warning' },
];

const prepOf = (data) => runRaw('05_preparar_prompt.js', data)[0].json;

test('Preparar prompt: métricas calculadas por código y row_keys reales', () => {
  const p = prepOf(rows.map((json) => ({ json })));
  assert.strictEqual(p.metrics.total, 2);
  assert.strictEqual(p.metrics.valorTotal, 300);
  assert.strictEqual(p.metrics.incompletos, 1);
  assert.strictEqual(p.metrics.desde, '2026-10-01');
  assert.strictEqual(p.metrics.hasta, '2026-10-02');
  assert.deepStrictEqual(p.validKeys, ['k1', 'k2']);
  assert.match(p.prompt, /k1 ; 2026-10-01 ; A ; S1 ; 100 ; Completado/);
  assert.match(p.prompt, /No calcules ni inventes cifras/);
});

test('Preparar prompt: soporta que el HTTP devuelva el array dentro de un solo item', () => {
  const p = prepOf([{ json: rows }]);
  assert.strictEqual(p.metrics.total, 2);
  assert.strictEqual(p.metrics.valorTotal, 300);
});

test('Preparar prompt: sin registros no divide por cero ni produce NaN', () => {
  const p = prepOf([]);
  assert.strictEqual(p.metrics.total, 0);
  assert.strictEqual(p.metrics.valorTotal, 0);
  assert.deepStrictEqual(p.validKeys, []);
  assert.doesNotMatch(p.prompt, /NaN/);
});

test('Preparar prompt: descarta el item vacío que emite alwaysOutputData', () => {
  const p = prepOf([{ json: {} }]);
  assert.strictEqual(p.metrics.total, 0);
  assert.strictEqual(p.metrics.valorTotal, 0);
  assert.deepStrictEqual(p.validKeys, []);
});

test('Parsear respuesta: acepta JSON válido y descarta row_key inventados', () => {
  const prep = prepOf(rows.map((json) => ({ json })));
  const gemini = {
    candidates: [{
      content: {
        parts: [{
          text: '```json\n' + JSON.stringify({
            resumen: 'Resumen ok',
            inconsistencias: [
              { row_key: 'k2', motivo: 'Valor atípico', severidad: 'ALTA' },
              { row_key: 'inventado', motivo: 'No existe', severidad: 'alta' },
            ],
          }) + '\n```',
        }],
      },
    }],
  };
  const out = runRaw('06_parsear_respuesta.js', [{ json: gemini }], [{ json: prep }])[0].json;
  assert.strictEqual(out.summary, 'Resumen ok');
  assert.strictEqual(out.model, 'gemini-3.6-flash');
  assert.strictEqual(out.used_fallback, false);
  assert.strictEqual(out.flags.length, 1);
  assert.deepStrictEqual(out.flags[0], { row_key: 'k2', motivo: 'Valor atípico', severidad: 'alta' });
});

test('Parsear respuesta: si Gemini devuelve basura usa la plantilla', () => {
  const prep = prepOf(rows.map((json) => ({ json })));
  const gemini = { candidates: [{ content: { parts: [{ text: 'no soy json' }] } }] };
  const out = runRaw('06_parsear_respuesta.js', [{ json: gemini }], [{ json: prep }])[0].json;
  assert.strictEqual(out.used_fallback, true);
  assert.strictEqual(out.model, 'plantilla');
  assert.match(out.summary, /Se procesaron 2 registros/);
  assert.strictEqual(out.total_records, 2);
  assert.strictEqual(out.valor_total, 300);
});

test('Parsear respuesta: sin registros responde un resumen claro, sin llamar a la IA', () => {
  const prep = prepOf([]);
  const out = runRaw('06_parsear_respuesta.js', [{ json: {} }], [{ json: prep }])[0].json;
  assert.strictEqual(out.used_fallback, true);
  assert.strictEqual(out.total_records, 0);
  assert.strictEqual(out.summary, 'No hay registros en el periodo para resumir.');
  assert.strictEqual(out.period_from, null);
});

test('Parsear respuesta: concatena varias partes de Gemini', () => {
  const prep = prepOf(rows.map((json) => ({ json })));
  const a = '{"resumen":"Parte A",';
  const b = '"inconsistencias":[]}';
  const gemini = { candidates: [{ content: { parts: [{ text: a }, { text: b }] } }] };
  const out = runRaw('06_parsear_respuesta.js', [{ json: gemini }], [{ json: prep }])[0].json;
  assert.strictEqual(out.summary, 'Parte A');
  assert.strictEqual(out.used_fallback, false);
});

test('Dividir inconsistencias: un item por flag con el modelo', () => {
  const out = runRaw('07_dividir_inconsistencias.js', [{
    json: { flags: [{ row_key: 'k2', motivo: 'x', severidad: 'alta' }], model: 'gemini-3.6-flash' },
  }]).map((i) => i.json);
  assert.deepStrictEqual(out, [{ row_key: 'k2', motivo: 'x', severidad: 'alta', model: 'gemini-3.6-flash' }]);
});

test('Workflow 2 sobre el Excel de muestra: 20 únicas y $9.566.000 (igual que el seed/dashboard)', () => {
  const meta = [{ json: { message_id: '<seed@demo>', filename: 'sample_registros.xlsx', received_at: '2026-11-01T10:00:00Z' } }];
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'excel_rows.json'), 'utf8'));
  const all = runNode('04_validar.js', runNode('02_normalizar_excel.js', raw.map((json) => ({ json })), meta), meta)
    .map((i) => i.json);
  const unique = [...new Map(all.map((r) => [r.row_key, r])).values()];
  const p = prepOf(unique.map((json) => ({ json })));
  assert.strictEqual(p.metrics.total, 20);
  assert.strictEqual(p.metrics.valorTotal, 9566000);
  assert.strictEqual(p.metrics.valorTotalFmt, '$9.566.000');
  assert.strictEqual(p.metrics.incompletos, 2); // 1 error + 1 warning
});
