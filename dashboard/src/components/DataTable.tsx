"use client";
import { useMemo, useState } from "react";
import type { DbRecord } from "@/lib/metrics";
import { fmtMoney } from "@/lib/metrics";

type Key = "fecha" | "cliente" | "categoria" | "valor" | "estado";
const COLS: { k: Key; l: string; r?: boolean }[] = [
  { k: "fecha", l: "Fecha" }, { k: "cliente", l: "Cliente" }, { k: "categoria", l: "Categoría" },
  { k: "valor", l: "Valor", r: true }, { k: "estado", l: "Estado" },
];
const PAGE = 10;

export function DataTable({ rows }: { rows: DbRecord[] }) {
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState<"all" | "alerts">("all");
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "fecha", dir: -1 });
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => (flag === "all" || r.quality_flag !== "ok") &&
        (!t || [r.cliente, r.categoria, r.referencia, r.estado, r.source_file].some((x) => x?.toLowerCase().includes(t))))
      .sort((a, b) => {
        const x = a[sort.k], y = b[sort.k];
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1; // vacíos siempre al final
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es");
        return c * sort.dir;
      });
  }, [rows, q, flag, sort]);

  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = view.slice(cur * PAGE, cur * PAGE + PAGE);

  const exportCsv = () => {
    const head = "fecha,cliente,categoria,referencia,valor,estado,calidad,origen";
    const body = view.map((r) => [r.fecha, r.cliente, r.categoria, r.referencia, r.valor, r.estado, r.quality_flag, r.source_file]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "registros.csv" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="tools">
        <input type="search" placeholder="Buscar cliente, categoría, referencia…" aria-label="Buscar registros" value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ minWidth: 260 }} />
        <div className="seg" role="group" aria-label="Filtrar por calidad">
          <button aria-pressed={flag === "all"} onClick={() => { setFlag("all"); setPage(0); }}>Todos</button>
          <button aria-pressed={flag === "alerts"} onClick={() => { setFlag("alerts"); setPage(0); }}>Con alertas</button>
        </div>
        <button onClick={exportCsv} style={{ marginLeft: "auto" }}>Descargar CSV</button>
      </div>
      <div className="tw">
        <table>
          <thead><tr>
            {COLS.map((c) => (
              <th key={c.k} className={c.r ? "r" : ""} aria-sort={sort.k === c.k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button onClick={() => setSort({ k: c.k, dir: sort.k === c.k ? (sort.dir === 1 ? -1 : 1) : 1 })}>
                  {c.l}{sort.k === c.k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </button>
              </th>
            ))}
            <th>Calidad</th><th>Origen</th>
          </tr></thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id}>
                <td>{r.fecha ?? "—"}</td><td>{r.cliente ?? "—"}</td><td>{r.categoria ?? "—"}</td>
                <td className="r">{r.valor !== null ? fmtMoney(r.valor) : "—"}</td>
                <td><span className={`chip ${r.estado === "Completado" ? "up" : "neutral"}`}>{r.estado ?? "—"}</span></td>
                <td title={r.quality_note ?? "Sin observaciones"}>
                  <span className={`chip ${r.quality_flag === "ok" ? "up" : r.quality_flag === "warning" ? "warn" : "down"}`}>
                    {r.quality_flag === "ok" ? "Correcto" : r.quality_flag === "warning" ? "Revisar" : "Error"}
                  </span>
                  {r.quality_note && <small style={{ color: "var(--mute)", marginLeft: 8 }}>{r.quality_note}</small>}
                </td>
                <td style={{ color: "var(--ink2)" }}>{r.source_type === "pdf" ? "PDF" : "Excel"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!slice.length && <div className="empty">Ningún registro coincide con la búsqueda.</div>}
      </div>
      <div className="pg">
        <span>{view.length} registros</span>
        <span>
          <button disabled={cur === 0} onClick={() => setPage(cur - 1)}>Anterior</button>{" "}
          Página {cur + 1} de {pages}{" "}
          <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Siguiente</button>
        </span>
      </div>
    </div>
  );
}
