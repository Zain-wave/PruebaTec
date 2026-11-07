// Nodo: "Normalizar PDF"  (modo: Run Once for All Items)
// Entrada: salida de "Extract from File" -> pdf (campo `text`). Salida: registros en esquema común.
// Soporta (A) bloques "Etiqueta: valor" (uno o varios registros) (B) filas de tabla separadas por tabs/2+ espacios y (C) filas con espacios simples.
// >>> AJUSTA este parser cuando veas el PDF real: es la única parte que depende de su diseño. <<<
const META_NODE = 'Filtrar remitente y expandir adjuntos';

const LABELS = {
  fecha: ['fecha'],
  cliente: ['cliente', 'nombre del cliente', 'razon social'],
  referencia: ['numero de referencia', 'numero referencia', 'n de referencia', 'no de referencia',
    'nro de referencia', 'referencia', 'ref'],
  categoria: ['categoria', 'tipo', 'servicio'],
  valor: ['valor', 'monto', 'total', 'valor total', 'importe'],
  estado: ['estado', 'status', 'situacion'],
};
function fieldOf(label) {
  const l = norm(label);
  return Object.keys(LABELS).find((f) => LABELS[f].includes(l)) ?? null;
}

function parsePdfText(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // (A) bloques "Etiqueta: valor"; una nueva "Fecha" abre un registro nuevo
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const label = line.slice(0, idx);
    const field = fieldOf(label);
    if (!field) continue;
    const value = line.slice(idx + 1).trim();
    // Un "Total:" de pie de página no debe pisar el valor del registro en curso.
    if (field === 'valor' && ['total', 'valor total'].includes(norm(label)) && cur?.valor !== undefined) continue;
    if (field === 'fecha' && cur && cur.fecha !== undefined) { blocks.push(cur); cur = null; }
    if (!cur) cur = {};
    cur[field] = value;
  }
  if (cur) blocks.push(cur);
  const good = blocks.filter((b) => Object.keys(b).length >= 3);
  if (good.length) return good;

  // (B) filas de tabla: Fecha | Cliente | Referencia | Categoría | Valor | Estado
  const rows = [];
  for (const line of lines) {
    const t = line.split(/\t|\s{2,}/).map((x) => x.trim()).filter(Boolean);
    if (t.length === 6 && parseDate(t[0])) {
      rows.push({ fecha: t[0], cliente: t[1], referencia: t[2], categoria: t[3], valor: t[4], estado: t[5] });
    }
  }
  if (rows.length) return rows;

  // (C) filas con espacios simples: "2026-10-15 Cliente A REF-0001 Servicio A $1.500.000 Completado"
  // Heurística: fecha al inicio, estado (del catálogo) al final, valor justo antes, y la referencia
  // (letras+dígitos o 3+ dígitos) separa cliente (antes) de categoría (después).
  for (const line of lines) {
    const t = line.split(/\s+/);
    if (t.length < 6 || !parseDate(t[0])) continue;
    const estado = ESTADOS.find((e) => norm(t.slice(-e.split(' ').length).join(' ')) === norm(e));
    if (!estado) continue;
    const end = t.length - estado.split(' ').length;
    const valor = t[end - 1];
    if (!/^[$\d.,\-]+$/.test(valor)) continue;
    const mid = t.slice(1, end - 1);
    const ri = mid.findIndex((x) => /^([A-Za-z]{1,6}[-_]?\d{2,}|\d{3,})$/.test(x));
    if (ri < 1 || ri === mid.length - 1) continue;
    rows.push({ fecha: t[0], cliente: mid.slice(0, ri).join(' '), referencia: mid[ri],
      categoria: mid.slice(ri + 1).join(' '), valor, estado });
  }
  return rows;
}

// Ver 02_normalizar_excel.js: itemMatching + fallback por pairedItem/índice.
function metaFor(it, i) {
  try {
    const m = $(META_NODE).itemMatching(i);
    if (m?.json?.filename) return m.json;
  } catch (e) { /* usa el fallback */ }
  const pi = Array.isArray(it?.pairedItem) ? it.pairedItem[0] : it?.pairedItem;
  const idx = typeof pi === 'number' ? pi : pi?.item;
  let all = [];
  try { all = $(META_NODE).all() ?? []; } catch (e) { all = []; }
  const fromMeta = (typeof idx === 'number' ? all[idx] : all[i])?.json;
  if (fromMeta?.filename) return fromMeta;
  // Extract from File (PDF) conserva el JSON de entrada por defecto (keepSource=json).
  return it?.json ?? {};
}

const out = [];
$input.all().forEach((it, i) => {
  const j = it.json ?? {};
  const meta = metaFor(it, i);

  // Extract from File con onError=continueRegularOutput devuelve { error: "..." }.
  if (j.error && Object.keys(j).length === 1) {
    const rec = buildRecord({}, meta, 'pdf');
    rec._extract_error = String(j.error);
    out.push({ json: rec });
    return;
  }

  const found = parsePdfText(j.text);
  if (!found.length) {
    // Documento ilegible: se guarda una fila marcada como error para que sea visible en el dashboard
    const rec = buildRecord({ fecha: null, cliente: null, categoria: null, valor: null, estado: null }, meta, 'pdf');
    out.push({ json: rec });
    return;
  }
  for (const f of found) out.push({ json: buildRecord(f, meta, 'pdf') });
});
return out;
