const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { build, LIB } = require('../scripts/build_workflows');

const root = path.join(__dirname, '..');
const file1 = path.join(root, 'n8n', 'workflow_1_ingesta.json');
const file2 = path.join(root, 'n8n', 'workflow_2_resumen_ia.json');
const code = (name) => fs.readFileSync(path.join(root, 'n8n', 'code', name), 'utf8');
const w1 = JSON.parse(fs.readFileSync(file1, 'utf8'));
const w2 = JSON.parse(fs.readFileSync(file2, 'utf8'));

function assertConnections(wf) {
  const names = new Set(wf.nodes.map((n) => n.name));
  for (const [src, outs] of Object.entries(wf.connections)) {
    assert.ok(names.has(src), `conexión desde nodo inexistente: ${src}`);
    for (const branch of outs.main) {
      for (const c of branch) assert.ok(names.has(c.node), `conexión hacia nodo inexistente: ${c.node}`);
    }
  }
}

test('los JSON son válidos, no tienen nombres/ids duplicados y sus conexiones existen', () => {
  for (const wf of [w1, w2]) {
    const names = wf.nodes.map((n) => n.name);
    const ids = wf.nodes.map((n) => n.id);
    assert.strictEqual(new Set(names).size, names.length, 'nombres duplicados');
    assert.strictEqual(new Set(ids).size, ids.length, 'ids duplicados');
    assert.ok(wf.nodes.every((n) => Array.isArray(n.position) && n.position.length === 2));
    assertConnections(wf);
  }
});

test('los JSON están sincronizados con n8n/code (sin editar a mano)', () => {
  const built = build();
  assert.strictEqual(fs.readFileSync(file1, 'utf8'), built.ingesta);
  assert.strictEqual(fs.readFileSync(file2, 'utf8'), built.resumen);
  // El modo --check es el que se usará en CI.
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build_workflows.js'), '--check'], { stdio: 'pipe' });
});

test('workflow 1: trigger IMAP v2 con adjuntos y extractores tolerantes a errores', () => {
  const trigger = w1.nodes.find((n) => n.type === 'n8n-nodes-base.emailReadImap');
  assert.ok(trigger);
  assert.strictEqual(trigger.parameters.format, 'simple');
  assert.strictEqual(trigger.parameters.downloadAttachments, true);
  assert.strictEqual(trigger.parameters.postProcessAction, 'read');
  assert.ok(trigger.parameters.options.customEmailConfig.includes('FROM'));

  for (const name of ['Leer Excel', 'Leer PDF']) {
    const node = w1.nodes.find((n) => n.name === name);
    assert.strictEqual(node.parameters.operation, name === 'Leer Excel' ? 'xlsx' : 'pdf');
    assert.strictEqual(node.parameters.binaryPropertyName, 'data');
    assert.strictEqual(node.onError, 'continueRegularOutput');
  }

  const save = w1.nodes.find((n) => n.name === 'Guardar en Supabase');
  assert.strictEqual(save.retryOnFail, true);
  assert.strictEqual(save.maxTries, 5);
  assert.match(save.parameters.url, /\/rest\/v1\/records\?on_conflict=row_key$/);
});

test('workflow 1: cada Code node coincide con su archivo fuente (con lib.js delante)', () => {
  for (const [name, file] of [
    ['Filtrar remitente y expandir adjuntos', '01_filtrar.js'],
    ['Normalizar Excel', '02_normalizar_excel.js'],
    ['Normalizar PDF', '03_normalizar_pdf.js'],
    ['Validar y preparar fila', '04_validar.js'],
  ]) {
    const node = w1.nodes.find((n) => n.name === name);
    assert.strictEqual(node.parameters.jsCode, `${LIB}\n\n${code(file)}`, name);
  }
});

test('workflow 2: lee 5000 registros y los Code nodes coinciden con sus fuentes', () => {
  const read = w2.nodes.find((n) => n.name === 'Leer registros');
  assert.match(read.parameters.url, /limit=5000/);
  assert.strictEqual(read.alwaysOutputData, true);
  const prep = w2.nodes.find((n) => n.name === 'Preparar prompt');
  assert.strictEqual(prep.alwaysOutputData, true);

  for (const [name, file] of [
    ['Preparar prompt', '05_preparar_prompt.js'],
    ['Parsear respuesta (con fallback)', '06_parsear_respuesta.js'],
    ['Un item por inconsistencia', '07_dividir_inconsistencias.js'],
  ]) {
    const node = w2.nodes.find((n) => n.name === name);
    assert.strictEqual(node.parameters.jsCode, code(file), name);
  }

  const saveFlags = w2.nodes.find((n) => n.name === 'Guardar inconsistencias');
  assert.match(saveFlags.parameters.url, /ai_flags\?on_conflict=row_key,motivo/);
  assert.strictEqual(saveFlags.retryOnFail, true);
});

// Evalúa una expresión de n8n (={{ ... }}) con un JSON de muestra, como haría el nodo.
function evalExpr(expr, json) {
  const js = expr.replace(/^=\{\{/, '').replace(/\}\}$/, '');
  return new Function('$json', `return (${js});`)(json);
}

test('las expresiones de los nodos HTTP generan JSON válido', () => {
  const reg = w1.nodes.find((n) => n.name === 'Registrar archivo recibido');
  const file = { message_id: '<m@mail>', filename: 'a.xlsx', source_type: 'excel', sender: 'a@b.com', subject: 'Hola' };
  assert.deepStrictEqual(JSON.parse(evalExpr(reg.parameters.jsonBody, file)), file);

  const save = w1.nodes.find((n) => n.name === 'Guardar en Supabase');
  const row = { row_key: 'k', fecha: '2026-10-01', cliente: 'A', valor: 10 };
  assert.deepStrictEqual(JSON.parse(evalExpr(save.parameters.jsonBody, row)), row);

  const gemini = w2.nodes.find((n) => n.name === 'Gemini: resumen e inconsistencias');
  const body = JSON.parse(evalExpr(gemini.parameters.jsonBody, { prompt: 'hola' }));
  assert.strictEqual(body.contents[0].parts[0].text, 'hola');
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');

  const summary = w2.nodes.find((n) => n.name === 'Guardar resumen');
  const summaryJson = {
    period_from: null, period_to: null, total_records: 0, valor_total: 0,
    summary: 'x', model: 'plantilla', used_fallback: true,
  };
  assert.deepStrictEqual(JSON.parse(evalExpr(summary.parameters.jsonBody, summaryJson)), summaryJson);
});
