// ============================================================================
// lib.js — helpers compartidos por los Code nodes de n8n.
// n8n no permite importar archivos locales, así que scripts/build_workflows.js
// concatena este archivo delante de cada script al generar los workflows.
// Aquí vive TODA la lógica determinística (parseo, normalización, validación):
// por eso la IA no se usa para esto (ver docs/DECISIONES.md).
// ============================================================================

// Catálogo de estados válidos (ajústalo cuando veas los datos reales)
const ESTADOS = ['Completado', 'Pendiente', 'Cancelado', 'En proceso', 'Rechazado'];

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

// minúsculas, sin tildes, sin signos: sirve para comparar encabezados y claves
function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

// Saca la dirección de un "From" de IMAP. Soporta:
//   "Nombre <mail@x.com>" | { text: "..." } | { value: [{ address: "..." }] } | ["..."]
function emailAddress(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return emailAddress(v[0]);
  if (typeof v === 'object') {
    if (Array.isArray(v.value) && v.value.length) {
      return emailAddress(v.value[0]?.address ?? v.value[0]?.text ?? v.value[0]);
    }
    return emailAddress(v.text ?? v.address ?? '');
  }
  const s = String(v);
  const angle = s.match(/<([^>\s]+@[^>\s]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  const plain = s.match(/[^\s<>,;"]+@[^\s<>,;"]+/);
  return plain ? plain[0].trim().toLowerCase() : '';
}

// Message-ID real del correo. En el trigger IMAP v2 "simple" viene en metadata['message-id'];
// si el servidor no lo trae, usa el UID de IMAP y, como último recurso, from|date|subject.
function messageIdOf(j) {
  const meta = j?.metadata ?? {};
  const metaKey = Object.keys(meta).find((k) => k.toLowerCase() === 'message-id');
  const id = (metaKey ? meta[metaKey] : null) ?? meta.messageId ?? j?.messageId ?? j?.message_id;
  if (id) return String(id).trim();
  const uid = j?.attributes?.uid;
  if (uid !== undefined && uid !== null) return `imap-uid:${uid}`;
  return `${emailAddress(j?.from ?? meta.from)}|${j?.date ?? meta.date ?? ''}|${j?.subject ?? meta.subject ?? ''}`;
}

// "$12.500.000" -> 12500000 | "1.500,50" -> 1500.5 | "1,500.50" -> 1500.5 | 1500 -> 1500
// Convención: "1.500" (punto + 3 dígitos) se lee como miles (estilo colombiano).
function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (/^-?\d+(?:\.\d+)?e[+-]?\d+$/i.test(String(v).trim())) {
    const exp = Number(String(v).trim());
    return Number.isFinite(exp) ? exp : null;
  }
  let s = String(v).trim().replace(/[^\d.,\-]/g, '');
  if (!s || s === '-') return null;
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // el último separador que aparece es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    const p = s.split(',');
    s = (p.length === 2 && p[1].length !== 3) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (hasDot) {
    const p = s.split('.');
    if (p.length > 2 || (p.length === 2 && p[1].length === 3)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function iso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// -> 'YYYY-MM-DD' o null. Acepta ISO, dd/mm/yyyy, "15 de octubre de 2026", serial de Excel y Date.
function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    return null;
  }
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) return iso(+m[3], +m[2], +m[1]); // dd/mm/yyyy
  if ((m = s.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})$/))) {
    const mes = MESES[norm(m[2])];
    return mes ? iso(+m[3], mes, +m[1]) : null;
  }
  return null;
}

// "completado " -> "Completado"; si no está en el catálogo se conserva tal cual (y se marca warning)
function canonEstado(v) {
  const s = clean(v);
  if (!s) return null;
  const hit = ESTADOS.find((e) => norm(e) === norm(s));
  return hit ?? s;
}

function toIsoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

// Convierte campos crudos (Excel o PDF) al esquema común. NO valida: eso lo hace validateRecord.
function buildRecord(f, meta, sourceType) {
  return {
    fecha: parseDate(f.fecha),
    cliente: clean(f.cliente),
    referencia: clean(f.referencia),
    categoria: clean(f.categoria),
    cantidad: parseNumber(f.cantidad),
    valor: parseNumber(f.valor),
    estado: canonEstado(f.estado),
    source_type: sourceType,
    source_file: meta.filename ?? null,
    email_message_id: meta.message_id ?? null,
    email_received_at: toIsoOrNull(meta.received_at),
    _raw: { fecha: f.fecha, cantidad: f.cantidad, valor: f.valor, estado: f.estado },
  };
}

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

// Reglas determinísticas. error = falta algo obligatorio o es inválido; warning = sospechoso.
function validateRecord(r) {
  const errors = [], warnings = [];
  if (!r.fecha) errors.push(isBlank(r._raw.fecha) ? 'Fecha vacía' : `Fecha inválida: "${r._raw.fecha}"`);
  if (!r.cliente) errors.push('Cliente vacío');
  if (!r.categoria) errors.push('Categoría vacía');
  if (r.valor === null) errors.push(isBlank(r._raw.valor) ? 'Valor vacío' : `Valor no numérico: "${r._raw.valor}"`);
  else if (r.valor < 0) errors.push('Valor negativo');
  if (!r.estado) errors.push('Estado vacío');
  else if (!ESTADOS.includes(r.estado)) warnings.push(`Estado fuera del catálogo: "${r.estado}"`);
  if (r.cantidad !== null && (r.cantidad <= 0 || !Number.isInteger(r.cantidad))) warnings.push(`Cantidad sospechosa: ${r.cantidad}`);
  if (r.cantidad === null && !isBlank(r._raw.cantidad)) warnings.push(`Cantidad no numérica: "${r._raw.cantidad}"`);
  if (r.fecha && new Date(r.fecha) > new Date(Date.now() + 86400000)) warnings.push('Fecha en el futuro');
  const flag = errors.length ? 'error' : warnings.length ? 'warning' : 'ok';
  return { flag, note: [...errors, ...warnings].join('; ') || null };
}

// Clave de deduplicación por CONTENIDO: mismo registro (mismos campos normalizados) => misma clave.
// Incluye `referencia` (solo PDF) y `cantidad` (solo Excel), que son específicos de cada origen:
// reenviar el mismo Excel o el mismo PDF no duplica, pero un registro idéntico que llegue a la vez
// en Excel y en PDF puede no colapsar (ver README > Limitaciones).
function rowKey(r) {
  return [r.fecha, r.cliente, r.referencia, r.categoria, r.cantidad, r.valor, r.estado]
    .map((x) => norm(x ?? '')).join('|');
}

// Fila lista para insertar en la tabla `records` de Supabase
function toDbRow(r) {
  const { flag, note } = validateRecord(r);
  const { _raw, _extract_error, ...rest } = r;
  // row_key/quality_* van al final para que un campo homónimo de entrada no los pise.
  return { ...rest, row_key: rowKey(r), quality_flag: flag, quality_note: note };
}
