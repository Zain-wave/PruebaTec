// Nodo: "Filtrar remitente y expandir adjuntos"  (modo: Run Once for All Items)
// 1) Valida que el correo venga EXACTAMENTE del remitente autorizado
// 2) emite 1 item por adjunto .pdf/.xlsx
// OJO: n8n Cloud no tiene variables de entorno; cambia ALLOWED_SENDER aquí Y en el
// filtro FROM del trigger IMAP (Options -> Custom Email Rules).
const ALLOWED_SENDER = 'remitente@ejemplo.com'.trim().toLowerCase(); // <-- CAMBIAR por el remitente real
const ALLOWED_EXT = ['pdf', 'xlsx'];

// Si el adjunto no trae extensión, se deduce por MIME type.
const MIME_EXT = [
  ['pdf', /pdf/i],
  ['xlsx', /(spreadsheetml|ms-excel|excel)/i],
];

function extOf(bin, filename) {
  const dot = filename.lastIndexOf('.');
  const byName = dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
  if (ALLOWED_EXT.includes(byName)) return byName;
  if (byName) return ''; // extensión explícita no soportada (p. ej. .exe)
  const mime = String(bin?.mimeType ?? '');
  for (const [ext, re] of MIME_EXT) if (re.test(mime)) return ext;
  return '';
}

const out = [];
for (const item of $input.all()) {
  const j = item.json ?? {};

  // Comparación EXACTA de la dirección: "xremitente@ejemplo.com" o
  // "remitente@ejemplo.com.evil.com" NO pasan. n8n IMAP v2 entrega `from` como
  // string ("Nombre <mail@x.com>"), pero se soportan también objetos/arrays.
  const from = emailAddress(j.from ?? j.metadata?.from);
  if (from !== ALLOWED_SENDER.toLowerCase()) continue;

  const messageId = messageIdOf(j);
  const subject = j.subject ?? j.metadata?.subject ?? null;
  const receivedAt = j.date ?? j.metadata?.date ?? null;

  for (const [key, bin] of Object.entries(item.binary ?? {})) {
    const rawName = bin?.fileName || key;
    const filename = String(rawName).trim().split(/[\\/]/).pop() || key;
    const ext = extOf(bin, filename);
    if (!ext) continue; // ignora imágenes de firma, etc.
    out.push({
      json: {
        message_id: messageId,
        sender: from,
        subject,
        received_at: receivedAt,
        filename,
        ext,
        source_type: ext === 'pdf' ? 'pdf' : 'excel',
      },
      binary: { data: bin },
    });
  }
}
return out;
