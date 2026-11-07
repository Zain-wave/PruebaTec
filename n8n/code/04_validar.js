// Nodo: "Validar y preparar fila"  (modo: Run Once for All Items)
// Aplica reglas de calidad, calcula row_key (anti-duplicados) y deja la fila lista para la BD.
// Un registro con errores NO se descarta: se guarda con quality_flag = 'error' para que sea visible.
const out = [];
for (const it of $input.all()) {
  const src = it.json ?? {};
  const row = toDbRow(src);

  // Fila totalmente vacía = archivo ilegible (PDF sin texto o Excel que Extract from File
  // no pudo abrir). Se usa una clave estable por mensaje+archivo para que reprocesar no
  // cree una fila nueva y para que cada archivo tenga su propia fila de error.
  const vacia = !row.fecha && !row.cliente && !row.referencia && !row.categoria
    && row.cantidad === null && row.valor === null && !row.estado;
  if (vacia) {
    row.row_key = `${row.source_type}-ilegible|${row.email_message_id}|${row.source_file}`;
    row.quality_note = src._extract_error
      ? `No se pudo leer el archivo: ${src._extract_error}`
      : (row.source_type === 'pdf' ? 'PDF sin campos reconocibles' : 'Archivo sin campos reconocibles');
  } else if (src._extract_error) {
    row.quality_note = [row.quality_note, `Error de extracción: ${src._extract_error}`]
      .filter(Boolean).join('; ');
  }

  out.push({ json: row });
}
return out;
