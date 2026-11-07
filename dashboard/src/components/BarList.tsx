import type { Slice } from "@/lib/metrics";
import { fmtMoney } from "@/lib/metrics";

// Barras en HTML/CSS puro: nítidas, accesibles y sin JS en el cliente.
export function BarList({ data, by }: { data: Slice[]; by: "registros" | "valor" }) {
  const max = Math.max(1, ...data.map((d) => d[by]));
  if (!data.length) return <div className="empty">Sin datos.</div>;
  return (
    <div className="bl">
      {data.map((d) => (
        <div className="r" key={d.name}>
          <span>{d.name}</span>
          <small>{by === "valor" ? fmtMoney(d.valor) : `${d.registros} registros · ${fmtMoney(d.valor)}`}</small>
          <div className="track" role="img" aria-label={`${d.name}: ${d[by]}`}><span style={{ width: `${(d[by] / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
