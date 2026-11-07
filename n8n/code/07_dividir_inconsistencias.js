// Nodo: "Un item por inconsistencia"
const j = $input.first().json;
return (j.flags ?? []).map((f) => ({ json: {
  row_key: String(f.row_key), motivo: String(f.motivo), severidad: f.severidad ?? null, model: j.model } }));
