// Nodo: "Normalizar Excel"  (modo: Run Once for All Items)
// Entrada: una fila por item (salida de "Extract from File" -> xlsx). Salida: registros en esquema común.
const META_NODE = 'Filtrar remitente y expandir adjuntos';

const ALIASES = {
  fecha: ['fecha', 'fecha operacion', 'fecha de operacion', 'fecha de la operacion',
    'fecha registro', 'fecha de registro'],
  cliente: ['cliente', 'nombre cliente', 'nombre del cliente', 'razon social'],
  referencia: ['referencia', 'numero de referencia', 'numero referencia', 'nro de referencia',
    'nro referencia', 'no de referencia', 'no referencia', 'n de referencia', 'ref'],
  categoria: ['categoria', 'tipo', 'servicio'],
  cantidad: ['cantidad', 'cant', 'unidades'],
  valor: ['valor', 'monto', 'total', 'valor total', 'importe'],
  estado: ['estado', 'status', 'situacion'],
};

// busca la columna por nombre tolerante (mayúsculas, tildes, espacios)
function pick(row, field) {
  for (const k of Object.keys(row)) if (ALIASES[field].includes(norm(k))) return row[k];
  return null;
}

// El meta (message_id, filename...) vive en el nodo "Filtrar...". Extract from File
// propaga `pairedItem`, así que itemMatching(i) lo resuelve. Se deja un fallback por
// si una versión de n8n no propaga el pairedItem.
function metaFor(it, i) {
  try {
    const m = $(META_NODE).itemMatching(i);
    if (m?.json?.filename) return m.json;
  } catch (e) { /* usa el fallback */ }
  const pi = Array.isArray(it?.pairedItem) ? it.pairedItem[0] : it?.pairedItem;
  const idx = typeof pi === 'number' ? pi : pi?.item;
  let all = [];
  try { all = $(META_NODE).all() ?? []; } catch (e) { all = []; }
  return (typeof idx === 'number' ? all[idx] : all[i])?.json ?? {};
}

const out = [];
$input.all().forEach((it, i) => {
  const j = it.json ?? {};
  const meta = metaFor(it, i);

  // Extract from File con onError=continueRegularOutput devuelve { error: "..." }.
  // Si no se controla, la fila desaparece en silencio: se convierte en un error visible.
  if (j.error && Object.keys(j).length === 1) {
    const rec = buildRecord({}, meta, 'excel');
    rec._extract_error = String(j.error);
    out.push({ json: rec });
    return;
  }

  const f = {};
  for (const field of Object.keys(ALIASES)) f[field] = pick(j, field);
  const vacia = ['fecha', 'cliente', 'referencia', 'categoria', 'cantidad', 'valor', 'estado']
    .every((k) => isBlank(f[k]));
  if (vacia) return; // fila totalmente vacía del Excel
  out.push({ json: buildRecord(f, meta, 'excel') });
});
return out;
