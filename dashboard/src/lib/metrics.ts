// Toda la lógica de métricas vive aquí (función pura, fácil de probar y de explicar).

export type DbRecord = {
  id: number;
  fecha: string | null;
  cliente: string | null;
  referencia: string | null;
  categoria: string | null;
  cantidad: number | null;
  valor: number | null;
  estado: string | null;
  source_type: "excel" | "pdf";
  source_file: string | null;
  quality_flag: "ok" | "warning" | "error";
  quality_note: string | null;
  row_key: string;
};

export type Filters = { desde?: string; hasta?: string; categoria?: string; estado?: string };

export type Slice = { name: string; registros: number; valor: number };

export type Metrics = {
  total: number;
  valorTotal: number;
  porCategoria: Slice[];
  porEstado: Slice[];
  serie: { fecha: string; registros: number; valor: number }[];
  // métricas adicionales (justificación en docs/DECISIONES.md)
  tasaCompletado: number; // % de registros en estado "Completado"
  pctCalidad: number; // % de registros con warning o error
  topClientes: Slice[]; // top 5 por valor
};

export function applyFilters(rows: DbRecord[], f: Filters): DbRecord[] {
  return rows.filter(
    (r) =>
      (!f.desde || (r.fecha !== null && r.fecha >= f.desde)) &&
      (!f.hasta || (r.fecha !== null && r.fecha <= f.hasta)) &&
      (!f.categoria || r.categoria === f.categoria) &&
      (!f.estado || r.estado === f.estado)
  );
}

function groupBy(rows: DbRecord[], key: (r: DbRecord) => string): Slice[] {
  const m = new Map<string, Slice>();
  for (const r of rows) {
    const name = key(r);
    const s = m.get(name) ?? { name, registros: 0, valor: 0 };
    s.registros += 1;
    s.valor += r.valor ?? 0;
    m.set(name, s);
  }
  return [...m.values()].sort((a, b) => b.registros - a.registros);
}

export function computeMetrics(rows: DbRecord[]): Metrics {
  const total = rows.length;
  const valorTotal = rows.reduce((s, r) => s + (r.valor ?? 0), 0);

  const porDia = new Map<string, { registros: number; valor: number }>();
  for (const r of rows) {
    if (!r.fecha) continue;
    const d = porDia.get(r.fecha) ?? { registros: 0, valor: 0 };
    d.registros += 1;
    d.valor += r.valor ?? 0;
    porDia.set(r.fecha, d);
  }

  return {
    total,
    valorTotal,
    porCategoria: groupBy(rows, (r) => r.categoria ?? "Sin categoría"),
    porEstado: groupBy(rows, (r) => r.estado ?? "Sin estado"),
    serie: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, v]) => ({ fecha, ...v })),
    tasaCompletado: total ? (rows.filter((r) => r.estado === "Completado").length / total) * 100 : 0,
    pctCalidad: total ? (rows.filter((r) => r.quality_flag !== "ok").length / total) * 100 : 0,
    topClientes: groupBy(rows, (r) => r.cliente ?? "Sin cliente")
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5),
  };
}

export const fmtMoney = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
export const fmtPct = (n: number) => n.toFixed(1) + "%";
