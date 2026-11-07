import { fmtMoney, type DbRecord } from "./metrics";

// Datos de ejemplo deterministas: permiten ver y presentar el dashboard sin Supabase ni n8n.
const CLIENTES = ["Andina Textiles", "Grupo Cumbre", "Logística Norte", "Café del Valle", "Metalmecánica Sur"];
const CATS = ["Servicio A", "Servicio B", "Servicio C"];

export function demoData() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const records: DbRecord[] = Array.from({ length: 64 }, (_, i) => {
    const r = rnd();
    const flag = i % 13 === 0 ? "error" : i % 7 === 0 ? "warning" : "ok";
    return {
      id: i + 1,
      fecha: new Date(Date.UTC(2026, 9, 1 + Math.floor(i / 2.2))).toISOString().slice(0, 10),
      cliente: CLIENTES[i % 5],
      referencia: i % 3 ? `REF-${1000 + i}` : null,
      categoria: CATS[Math.floor(rnd() * 3)],
      cantidad: i % 3 ? null : 1 + Math.floor(rnd() * 9),
      valor: flag === "error" ? null : Math.round((300 + rnd() * 2200)) * 1000,
      estado: r < 0.62 ? "Completado" : r < 0.85 ? "Pendiente" : "Cancelado",
      source_type: i % 3 ? "pdf" : "excel",
      source_file: i % 3 ? "reporte_semanal.pdf" : "registros.xlsx",
      quality_flag: flag,
      quality_note: flag === "error" ? "Valor vacío" : flag === "warning" ? "Cantidad sospechosa: 0" : null,
      row_key: `demo-${i}`,
    } as DbRecord;
  });

  const total = records.reduce((s, r) => s + (r.valor ?? 0), 0);
  const alertas = records.filter((r) => r.quality_flag !== "ok").length;
  const now = Date.now();
  return {
    records,
    summary: {
      summary: `Se procesaron ${records.length} registros por un valor total de ${fmtMoney(total)}. La mayoría están completados y ${alertas} tienen alertas de calidad que conviene revisar antes de cerrar el periodo.`,
      model: "gemini-2.5-flash", used_fallback: false, generated_at: new Date(now).toISOString(),
    },
    flags: [
      { id: 1, severidad: "alta", motivo: "Valor 4 veces mayor al promedio del mismo cliente", row_key: "demo-12" },
      { id: 2, severidad: "media", motivo: "'Logistica Norte' y 'Logística Norte' parecen el mismo cliente", row_key: "demo-27" },
    ],
    files: [
      { id: 1, filename: "reporte_semanal.pdf", source_type: "pdf", subject: "Reporte semanal", processed_at: new Date(now - 36e5).toISOString() },
      { id: 2, filename: "registros.xlsx", source_type: "excel", subject: "Registros de octubre", processed_at: new Date(now - 864e5).toISOString() },
    ],
  };
}
