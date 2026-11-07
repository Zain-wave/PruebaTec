"use client";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Slice } from "@/lib/metrics";

export const PALETTE = ["#0f766e", "#3b4cca", "#b45309", "#be123c", "#7b8794"];
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const short = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${n}`);

export function TrendChart({ data }: { data: { fecha: string; valor: number; registros: number }[] }) {
  if (!data.length) return <div className="empty">Sin datos en el periodo.</div>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e2e7ec" vertical={false} />
        <XAxis dataKey="fecha" tickFormatter={(d: string) => d.slice(5)} tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickFormatter={(v) => short(Number(v))} tickLine={false} axisLine={false} width={56} fontSize={12} />
        <Tooltip formatter={(v, n) => [n === "valor" ? money(Number(v)) : String(v), n === "valor" ? "Valor" : "Registros"]} labelStyle={{ fontWeight: 700 }} />
        <Area type="monotone" dataKey="valor" stroke="#0f766e" strokeWidth={2.5} fill="url(#g)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + d.registros, 0);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, alignItems: "center" }}>
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={data} dataKey="registros" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="bl" style={{ gap: 8 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 600 }}>
            <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: PALETTE[i % PALETTE.length], marginRight: 8 }} />{d.name}</span>
            <small style={{ color: "var(--mute)" }}>{d.registros} · {total ? Math.round((d.registros / total) * 100) : 0}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}
