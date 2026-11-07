const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runNode, loadLib } = require('./harness');
const L = loadLib();

const meta = [{ json: { message_id: '<abc@mail>', filename: 'x.xlsx', received_at: '2026-11-01T10:00:00Z' } }];

test('parseNumber: formatos colombianos, anglosajones y notación científica', () => {
  assert.strictEqual(L.parseNumber('$12.500.000'), 12500000);
  assert.strictEqual(L.parseNumber('1.500,50'), 1500.5);
  assert.strictEqual(L.parseNumber('1,500.50'), 1500.5);
  assert.strictEqual(L.parseNumber('1.500'), 1500);       // convención: miles
  assert.strictEqual(L.parseNumber('1500.5'), 1500.5);
  assert.strictEqual(L.parseNumber('1e3'), 1000);
  assert.strictEqual(L.parseNumber(1500), 1500);
  assert.strictEqual(L.parseNumber(''), null);
  assert.strictEqual(L.parseNumber('abc'), null);
});

test('parseDate: varios formatos', () => {
  assert.strictEqual(L.parseDate('2026-10-15'), '2026-10-15');
  assert.strictEqual(L.parseDate('2026-10-15T00:00:00.000Z'), '2026-10-15');
  assert.strictEqual(L.parseDate('15/10/2026'), '2026-10-15');
  assert.strictEqual(L.parseDate('15 de octubre de 2026'), '2026-10-15');
  assert.strictEqual(L.parseDate(46310), '2026-10-15');    // serial de Excel
  assert.strictEqual(L.parseDate('31/02/2026'), null);     // fecha imposible
  assert.strictEqual(L.parseDate('hola'), null);
});

test('estado se normaliza y se valida contra el catálogo', () => {
  assert.strictEqual(L.canonEstado(' completado '), 'Completado');
  const rec = L.buildRecord({ fecha: '2026-10-15', cliente: 'A', categoria: 'S', valor: 10, estado: 'Raro' }, {}, 'excel');
  assert.strictEqual(L.validateRecord(rec).flag, 'warning');
});

test('validación: valor vacío => error; registro completo => ok', () => {
  const bad = L.buildRecord({ fecha: '2026-10-15', cliente: 'A', categoria: 'S', valor: null, estado: 'Completado' }, {}, 'excel');
  assert.strictEqual(L.validateRecord(bad).flag, 'error');
  assert.match(L.validateRecord(bad).note, /Valor vacío/);
  const ok = L.buildRecord({ fecha: '2026-10-15', cliente: 'A', categoria: 'S', cantidad: 2, valor: 100, estado: 'Completado' }, {}, 'excel');
  assert.strictEqual(L.validateRecord(ok).flag, 'ok');
});

test('row_key: mismo contenido => misma clave (anti-duplicados), sin importar mayúsculas/espacios', () => {
  const a = L.buildRecord({ fecha: '2026-10-15', cliente: 'Cliente A', categoria: 'Servicio A', cantidad: 1, valor: 100, estado: 'Completado' }, {}, 'excel');
  const b = L.buildRecord({ fecha: '15/10/2026', cliente: ' cliente a ', categoria: 'servicio a', cantidad: 1, valor: '100', estado: 'completado' }, {}, 'excel');
  assert.strictEqual(L.rowKey(a), L.rowKey(b));
});

test('emailAddress: extrae la dirección de los formatos de IMAP', () => {
  assert.strictEqual(L.emailAddress('Reportes <Reportes@Ejemplo.com>'), 'reportes@ejemplo.com');
  assert.strictEqual(L.emailAddress({ text: 'A <a@x.com>' }), 'a@x.com');
  assert.strictEqual(L.emailAddress({ value: [{ address: 'b@y.com' }] }), 'b@y.com');
  assert.strictEqual(L.emailAddress(['c@z.com']), 'c@z.com');
  assert.strictEqual(L.emailAddress('sin correo'), '');
});

test('messageIdOf: usa metadata[message-id], luego UID, luego un fallback estable', () => {
  assert.strictEqual(L.messageIdOf({ metadata: { 'message-id': '<m1@mail>' } }), '<m1@mail>');
  assert.strictEqual(L.messageIdOf({ attributes: { uid: 42 } }), 'imap-uid:42');
  const f = L.messageIdOf({ from: 'A <a@x.com>', date: '2026-11-01', subject: 'Hola' });
  assert.strictEqual(f, 'a@x.com|2026-11-01|Hola');
});

test('Excel de muestra: 21 filas, 20 claves únicas (hay 1 duplicado), 1 error, >=1 warning', () => {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'excel_rows.json'), 'utf8'));
  const normalized = runNode('02_normalizar_excel.js', rows.map((json) => ({ json })), meta);
  assert.strictEqual(normalized.length, 21);
  const final = runNode('04_validar.js', normalized, meta).map((i) => i.json);
  assert.strictEqual(new Set(final.map((r) => r.row_key)).size, 20);
  assert.strictEqual(final.filter((r) => r.quality_flag === 'error').length, 1);
  assert.ok(final.filter((r) => r.quality_flag === 'warning').length >= 1);
  assert.ok(final.every((r) => r.source_type === 'excel' && r.email_message_id === '<abc@mail>'));
});

test('Excel: usa pairedItem para no cruzar metadatos entre dos adjuntos', () => {
  const metas = [
    { json: { message_id: '<m0@mail>', filename: 'primero.xlsx' } },
    { json: { message_id: '<m1@mail>', filename: 'segundo.xlsx' } },
  ];
  const rows = [
    { json: { Fecha: '2026-10-01', Cliente: 'A', Categoría: 'S', Valor: 10, Estado: 'Completado' }, pairedItem: { item: 0 } },
    { json: { Fecha: '2026-10-02', Cliente: 'B', Categoría: 'S', Valor: 20, Estado: 'Completado' }, pairedItem: { item: 1 } },
  ];
  const out = runNode('02_normalizar_excel.js', rows, metas).map((i) => i.json);
  assert.deepStrictEqual(out.map((r) => r.email_message_id), ['<m0@mail>', '<m1@mail>']);
  assert.deepStrictEqual(out.map((r) => r.source_file), ['primero.xlsx', 'segundo.xlsx']);
});

test('Excel: un error de Extract from File produce una fila de error visible y estable', () => {
  const run = () => {
    const row = runNode('02_normalizar_excel.js', [{ json: { error: 'File is corrupted' }, pairedItem: { item: 0 } }], meta);
    return runNode('04_validar.js', row, meta)[0].json;
  };
  const a = run(), b = run();
  assert.strictEqual(a.quality_flag, 'error');
  assert.match(a.quality_note, /No se pudo leer el archivo/);
  assert.strictEqual(a.row_key, b.row_key);
  assert.match(a.row_key, /^excel-ilegible\|/);
});

test('PDF de muestra: extrae 5 registros con fechas y valores normalizados', () => {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'pdf_text.txt'), 'utf8');
  const normalized = runNode('03_normalizar_pdf.js', [{ json: { text } }], meta);
  const final = runNode('04_validar.js', normalized, meta).map((i) => i.json);
  assert.strictEqual(final.length, 5);
  assert.strictEqual(final[0].valor, 1500000);
  assert.strictEqual(final[0].referencia, 'REF-0001');
  assert.strictEqual(final[2].fecha, '2026-10-27');        // "27 de octubre de 2026"
  assert.ok(final.every((r) => r.quality_flag === 'ok'));
});

test('PDF ilegible: genera una fila de error visible y estable (no se duplica al reprocesar)', () => {
  const run = () => runNode('04_validar.js', runNode('03_normalizar_pdf.js', [{ json: { text: 'basura' } }], meta), meta)[0].json;
  const a = run(), b = run();
  assert.strictEqual(a.quality_flag, 'error');
  assert.strictEqual(a.row_key, b.row_key);
});

test('PDF: un error de Extract from File produce una fila de error visible y estable', () => {
  const run = () => {
    const row = runNode('03_normalizar_pdf.js', [{ json: { error: 'Invalid PDF' }, pairedItem: { item: 0 } }], meta);
    return runNode('04_validar.js', row, meta)[0].json;
  };
  const a = run(), b = run();
  assert.strictEqual(a.quality_flag, 'error');
  assert.match(a.quality_note, /No se pudo leer el archivo/);
  assert.strictEqual(a.row_key, b.row_key);
  assert.match(a.row_key, /^pdf-ilegible\|/);
});

test('Filtro de remitente: exacto, ignora lookalikes y adjuntos que no sean pdf/xlsx', () => {
  const att = (fileName, mimeType) => ({ fileName, mimeType });
  const items = [
    { json: { from: 'Alguien <otro@x.com>' }, binary: { attachment_0: att('a.xlsx') } },
    { json: { from: 'Evil <xremitente@ejemplo.com>' }, binary: { attachment_0: att('b.xlsx') } },
    { json: { from: 'Evil <remitente@ejemplo.com.evil.com>' }, binary: { attachment_0: att('c.xlsx') } },
    { json: { from: 'Reportes <REMITENTE@EJEMPLO.COM>', metadata: { 'message-id': '<ok@mail>' } },
      binary: { attachment_0: att('ok.xlsx'), attachment_1: att('firma.png'), attachment_2: att('r.PDF') } },
    { json: { from: 'Reportes <remitente@ejemplo.com>' }, binary: { attachment_0: att('sin-extension', 'application/pdf') } },
    { json: { from: 'Reportes <remitente@ejemplo.com>' }, binary: { attachment_0: att('malicioso.exe', 'application/pdf') } },
  ];
  const out = runNode('01_filtrar.js', items);
  assert.deepStrictEqual(out.map((o) => o.json.filename), ['ok.xlsx', 'r.PDF', 'sin-extension']);
  assert.deepStrictEqual(out.map((o) => o.json.source_type), ['excel', 'pdf', 'pdf']);
  assert.deepStrictEqual(out.map((o) => o.json.message_id), ['<ok@mail>', '<ok@mail>', 'remitente@ejemplo.com||']);
  assert.ok(out.every((o) => o.json.sender === 'remitente@ejemplo.com'));
});

test('PDF en formato tabla (espacios simples): cliente, referencia, categoría y estado de 2 palabras', () => {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'pdf_text_table.txt'), 'utf8');
  const final = runNode('04_validar.js', runNode('03_normalizar_pdf.js', [{ json: { text } }], meta), meta).map((i) => i.json);
  assert.strictEqual(final.length, 2);
  assert.strictEqual(final[1].cliente, 'Logística Norte');
  assert.strictEqual(final[1].referencia, 'REF-0002');
  assert.strictEqual(final[1].categoria, 'Servicio B');
  assert.strictEqual(final[1].estado, 'En proceso');
  assert.strictEqual(final[1].valor, 2750000);
});
