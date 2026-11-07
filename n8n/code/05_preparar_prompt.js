// Nodo: "Preparar prompt" — calcula las métricas con CÓDIGO (no con IA) y arma el prompt.
const input = $input.all();
let rows = input.map((i) => i.json);
// El nodo HTTP puede devolver un array en un solo item o un item por fila: se soportan ambos.
if (rows.length === 1 && Array.isArray(rows[0])) rows = rows[0];
// Un HTTP vacío con alwaysOutputData llega como [{}]: no es un registro real.
rows = rows.filter((r) => r && typeof r === 'object' && Object.keys(r).length > 0);

const total = rows.length;
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const valorTotal = rows.reduce((s, r) => s + (num(r.valor) ?? 0), 0);
const incompletos = rows.filter((r) => r.quality_flag !== 'ok').length;
const countBy = (k) => rows.reduce((m, r) => { const x = r[k] ?? 'Sin dato'; m[x] = (m[x] || 0) + 1; return m; }, {});
const pct = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${v} (${Math.round(v * 100 / Math.max(total, 1))}%)`]));
const fechas = rows.map((r) => r.fecha).filter(Boolean).sort();
const fmt = (n) => '$' + Math.round(Number.isFinite(n) ? n : 0).toLocaleString('es-CO');
const metrics = {
  total, valorTotal, valorTotalFmt: fmt(valorTotal), incompletos,
  porCategoria: pct(countBy('categoria')), porEstado: pct(countBy('estado')),
  desde: fechas[0] ?? null, hasta: fechas[fechas.length - 1] ?? null,
};
// Lista completa de claves reales: sirve para descartar row_key inventados por el modelo.
const validKeys = rows.map((r) => r.row_key).filter(Boolean).map(String);
const filas = rows.slice(0, 150)
  .map((r) => [r.row_key, r.fecha, r.cliente, r.categoria, r.valor, r.estado].join(' ; ')).join('\n');

const prompt = `Eres un analista de datos. Recibes MÉTRICAS ya calculadas y una muestra de registros.
Tareas:
1) "resumen": 2-3 frases en español para un directivo. Usa SOLO las cifras de MÉTRICAS. No calcules ni inventes cifras.
2) "inconsistencias": máximo 10 registros sospechosos que las reglas simples NO detectan: nombres de cliente casi iguales (typos), categorías raras, valores muy atípicos respecto al resto del mismo cliente o categoría. Cita el row_key EXACTO de la muestra. Si no hay, devuelve [].
Responde SOLO un JSON: {"resumen": string, "inconsistencias": [{"row_key": string, "motivo": string, "severidad": "alta"|"media"|"baja"}]}

MÉTRICAS:
${JSON.stringify(metrics)}

MUESTRA (row_key ; fecha ; cliente ; categoria ; valor ; estado):
${filas}`;
return [{ json: { prompt, metrics, validKeys } }];
