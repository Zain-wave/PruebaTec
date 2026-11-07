import { getSupabase } from "@/lib/supabase";
import { demoData } from "@/lib/demo";
import { applyFilters, computeMetrics, fmtMoney, fmtPct, type DbRecord, type Filters } from "@/lib/metrics";
import { Donut, TrendChart } from "@/components/Charts";
import { BarList } from "@/components/BarList";
import { DataTable } from "@/components/DataTable";

export const dynamic = "force-dynamic"; // datos siempre frescos desde Supabase

const when = (d: string) => new Date(d).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

// Tipos mínimos de las filas que vienen de Supabase (se evita `any` en los .map del JSX).
type AiFlag = { id: number; motivo: string; severidad: string | null; row_key: string };
type ProcessedFile = {
  id: number;
  filename: string;
  source_type: string | null;
  subject: string | null;
  processed_at: string;
};


// Variación de los últimos 7 días con datos frente a los 7 anteriores
function weekDelta(serie: { valor: number }[]) {
  if (serie.length < 8) return null;
  const sum = (a: { valor: number }[]) => a.reduce((s, x) => s + x.valor, 0);
  const cur = sum(serie.slice(-7)), prev = sum(serie.slice(-14, -7));
  return prev ? ((cur - prev) / prev) * 100 : null;
}

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  // Sin variables de Supabase => modo demostración con datos de ejemplo
  const demo = !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;
  const d = demo ? demoData() : null;
  const [rec, sum, flags, files] = (demo
    ? [{ data: d!.records, error: null }, { data: [d!.summary] }, { data: d!.flags }, { data: d!.files }]
    : await (async () => {
        const sb = getSupabase();
        return Promise.all([
          sb.from("records").select("*").order("fecha", { ascending: false }).limit(5000),
          sb.from("ai_summaries").select("*").order("generated_at", { ascending: false }).limit(1),
          sb.from("ai_flags").select("*").order("generated_at", { ascending: false }).limit(200),
          sb.from("processed_files").select("*").order("processed_at", { ascending: false }).limit(8),
        ]);
      })()) as any[];
  const all = (rec.data ?? []) as DbRecord[];
  const f: Filters = { desde: searchParams.desde || undefined, hasta: searchParams.hasta || undefined,
    categoria: searchParams.categoria || undefined, estado: searchParams.estado || undefined };
  const rows = applyFilters(all, f);
  const m = computeMetrics(rows);
  const delta = weekDelta(m.serie);
  const n = (fl: string) => rows.filter((r) => r.quality_flag === fl).length;
  const pct = (x: number) => (rows.length ? (x / rows.length) * 100 : 0);
  const uniq = (k: "categoria" | "estado") => [...new Set(all.map((r) => r[k]).filter(Boolean))] as string[];
  const resumen = sum.data?.[0];
  const lastFile = files.data?.[0];
  // Una fila puede tener varias redacciones del mismo hallazgo entre ejecuciones.
  // Mostramos solo la más reciente por row_key para no llenar el panel de duplicados.
  const seenFlagKeys = new Set<string>();
  const flagRows = ((flags.data ?? []) as AiFlag[]).filter((fl) => {
    if (seenFlagKeys.has(fl.row_key)) return false;
    seenFlagKeys.add(fl.row_key);
    return true;
  }).slice(0, 8);
  const fileRows = (files.data ?? []) as ProcessedFile[];

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="mark"><i /></span>Bandeja</div>
        <nav className="nav" aria-label="Secciones">
          <a href="#resumen">Resumen</a><a href="#desglose">Desglose</a><a href="#calidad">Calidad e IA</a>
          <a href="#registros">Registros</a><a href="#archivos">Archivos</a>
        </nav>
        <div className="pipe">
          <b><span className="dot" />Ingesta activa</b>
          {lastFile ? `Último archivo: ${when(lastFile.processed_at)}` : "Esperando el primer correo"}
        </div>
      </aside>

      <main>
        <header className="top">
          <div>
            <h1>Operaciones</h1>
            <p className="sub">Reportes recibidos por correo, consolidados y verificados.</p>
          </div>
          <form className="f" method="get" aria-label="Filtros">
            <input type="date" name="desde" defaultValue={f.desde} aria-label="Desde" />
            <input type="date" name="hasta" defaultValue={f.hasta} aria-label="Hasta" />
            <select name="categoria" defaultValue={f.categoria ?? ""} aria-label="Categoría">
              <option value="">Todas las categorías</option>{uniq("categoria").map((c) => <option key={c}>{c}</option>)}
            </select>
            <select name="estado" defaultValue={f.estado ?? ""} aria-label="Estado">
              <option value="">Todos los estados</option>{uniq("estado").map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="pri" type="submit">Aplicar</button>
            <a className="clear" href="/">Limpiar</a>
          </form>
        </header>

        {demo && <div className="panel" style={{ marginBottom: 16 }}><span className="chip warn">Modo demostración</span> Estos son datos de ejemplo. Define SUPABASE_URL y SUPABASE_ANON_KEY para ver los datos reales.</div>}
        {rec.error && <div className="panel" style={{ marginBottom: 16 }}>No se pudieron leer los datos: {rec.error.message}. Revisa SUPABASE_URL y SUPABASE_ANON_KEY.</div>}

        <section id="resumen" className="g hero">
          <div className="panel">
            <h2>Valor procesado</h2>
            <p className="hint">Evolución diaria del valor consolidado</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span className="big">{fmtMoney(m.valorTotal)}</span>
              {delta !== null && <span className={`chip ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs. 7 días previos</span>}
            </div>
            <TrendChart data={m.serie} />
          </div>
          <div className="panel">
            <div className="stat"><div className="l">Registros procesados</div><div className="n">{m.total}</div></div>
            <div className="stat">
              <div className="l">Tasa de completado</div><div className="n">{fmtPct(m.tasaCompletado)}</div>
              <div className="bar"><span style={{ width: `${m.tasaCompletado}%`, background: "var(--teal)" }} /></div>
            </div>
            <div className="stat">
              <div className="l">Confiabilidad del dato</div><div className="n">{fmtPct(100 - m.pctCalidad)}</div>
              <div className="bar" aria-label="Correctos, por revisar y con error">
                <span style={{ width: `${pct(n("ok"))}%`, background: "var(--teal)" }} />
                <span style={{ width: `${pct(n("warning"))}%`, background: "var(--amber)" }} />
                <span style={{ width: `${pct(n("error"))}%`, background: "var(--rose)" }} />
              </div>
              <div className="hint" style={{ margin: "6px 0 0" }}>{n("warning")} por revisar · {n("error")} con error</div>
            </div>
          </div>
        </section>

        <section id="desglose" className="g three">
          <div className="panel"><h2>Por categoría</h2><p className="hint">Registros y valor</p><BarList data={m.porCategoria} by="registros" /></div>
          <div className="panel"><h2>Por estado</h2><p className="hint">Distribución de registros</p><Donut data={m.porEstado} /></div>
          <div className="panel"><h2>Clientes con mayor valor</h2><p className="hint">Concentración del negocio</p><BarList data={m.topClientes} by="valor" /></div>
        </section>

        <section id="calidad" className="g two">
          <div className="panel ai">
            <h2>Lectura del periodo</h2>
            {resumen ? (<>
              <p>{resumen.summary}</p>
              <span className={`chip ${resumen.used_fallback ? "warn" : "neutral"}`}>
                {resumen.used_fallback ? "Resumen por plantilla: la IA no respondió" : `Redactado con ${resumen.model}`} · {when(resumen.generated_at)}
              </span>
            </>) : <div className="empty">Aún no hay resumen. Ejecuta el workflow 2 en n8n para generarlo.</div>}
          </div>
          <div className="panel">
            <h2>Inconsistencias que la IA sugiere revisar</h2><p className="hint">Lo que las reglas fijas no detectan</p>
            {flagRows.length === 0 ? <div className="empty">Nada sospechoso por ahora.</div> :
              flagRows.map((x) => (
                <div className="flag" key={x.id}><span className={`sev ${x.severidad ?? ""}`} /><div><b>{x.motivo}</b><div className="hint" style={{ margin: 0 }}>{x.row_key}</div></div></div>
              ))}
          </div>
        </section>

        <section id="registros" className="panel" style={{ marginBottom: 16 }}>
          <h2>Registros</h2><p className="hint">Busca, ordena y descarga lo que ves</p>
          <DataTable rows={rows.slice(0, 1000)} />
        </section>

        <section id="archivos" className="panel">
          <h2>Archivos recibidos</h2><p className="hint">Historial de adjuntos procesados</p>
          {(fileRows.length === 0) ? <div className="empty">Aún no llegan archivos desde el remitente autorizado.</div> : (
            <div className="tw"><table>
              <thead><tr><th>Archivo</th><th>Tipo</th><th>Asunto</th><th>Recibido</th></tr></thead>
              <tbody>{fileRows.map((x) => (
                <tr key={x.id}><td>{x.filename}</td><td>{x.source_type === "pdf" ? "PDF" : "Excel"}</td><td style={{ color: "var(--ink2)" }}>{x.subject ?? "—"}</td><td>{when(x.processed_at)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      </main>
    </div>
  );
}
