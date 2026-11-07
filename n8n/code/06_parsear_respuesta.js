// Nodo: "Parsear respuesta (con fallback)" — valida el JSON de Gemini; si falla, usa una plantilla.
const MODEL = 'gemini-3.6-flash';
const prep = $('Preparar prompt').first().json;
const m = prep.metrics;
const validKeys = new Set((prep.validKeys ?? []).map(String));
const topEntry = (o) => Object.entries(o ?? {}).sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0] ?? ['-', '0 (0%)'];
let summary = null, flags = [], usedFallback = false, model = MODEL;
try {
  if (!m || m.total === 0) throw new Error('sin registros');
  const resp = $input.first()?.json ?? {};
  model = resp.modelVersion || MODEL;
  const parts = resp.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p?.text ?? '').join('').trim();
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  if (typeof parsed.resumen !== 'string' || !parsed.resumen.trim()) throw new Error('sin resumen');
  summary = parsed.resumen.trim();
  const sev = new Set(['alta', 'media', 'baja']);
  flags = (Array.isArray(parsed.inconsistencias) ? parsed.inconsistencias : [])
    // Solo se aceptan row_key que existen de verdad: el modelo no puede inventarlos.
    .filter((f) => f && validKeys.has(String(f.row_key)) && typeof f.motivo === 'string' && f.motivo.trim())
    .map((f) => ({
      row_key: String(f.row_key),
      motivo: f.motivo.trim(),
      severidad: sev.has(String(f.severidad ?? '').toLowerCase()) ? String(f.severidad).toLowerCase() : null,
    }))
    .slice(0, 10);
} catch (e) {
  usedFallback = true;
  if (!m || m.total === 0) {
    summary = 'No hay registros en el periodo para resumir.';
  } else {
    const [cat, catN] = topEntry(m.porCategoria);
    summary = `Se procesaron ${m.total} registros por un valor total de ${m.valorTotalFmt}. ` +
      `La categoría más frecuente es ${cat} (${catN}) y hay ${m.incompletos} registros con alertas de calidad.`;
  }
}
return [{ json: {
  period_from: m?.desde ?? null, period_to: m?.hasta ?? null,
  total_records: m?.total ?? 0, valor_total: m?.valorTotal ?? 0,
  summary, model: usedFallback ? 'plantilla' : model, used_fallback: usedFallback, flags,
} }];
