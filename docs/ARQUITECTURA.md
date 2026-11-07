# Arquitectura

```mermaid
flowchart LR
  A[Correo Gmail] -->|IMAP, no leídos| B[n8n: Email Trigger]
  B --> C{Remitente autorizado?}
  C -->|no| X[Se ignora]
  C -->|sí| D[Expandir adjuntos .pdf / .xlsx]
  D --> H[(processed_files)]
  D --> E{Tipo}
  E -->|xlsx| F[Extract from File + Normalizar Excel]
  E -->|pdf| G[Extract from File + Normalizar PDF]
  F --> V[Validar con reglas + row_key]
  G --> V
  V -->|ON CONFLICT DO NOTHING| R[(records)]
  R --> W2[Workflow 2: métricas con código]
  W2 --> AI[Gemini: resumen + inconsistencias]
  AI -->|falla| T[Plantilla de respaldo]
  AI --> S[(ai_summaries / ai_flags)]
  T --> S
  R --> DASH[Dashboard Next.js en Vercel]
  S --> DASH
  H --> DASH
```

## Versión ASCII

```
Email ─▶ IMAP ─▶ n8n Workflow 1 ─┬─ Excel parser ─┐
                                 └─ PDF parser ───┴─▶ Validación ─▶ Supabase ─▶ Dashboard
                                                                       ▲
                          n8n Workflow 2 ─▶ Gemini (resumen/inconsistencias) ┘
```

## Modelo de datos
- `records`: esquema común. `row_key` UNIQUE (dedupe por contenido), `quality_flag` (ok/warning/error), `source_type`.
- `processed_files`: historial; `UNIQUE (message_id, filename)`. El `message_id` sale del header del correo (fallback al UID).
- `ai_summaries`: resumen + modelo + si fue plantilla.
- `ai_flags`: inconsistencias por `row_key`; `UNIQUE (row_key, motivo)` y FK a `records(row_key)` (la IA no puede inventar claves).
- Un Excel/PDF corrupto no detiene el workflow: genera una fila `quality_flag='error'` visible en el dashboard.
- n8n ejecuta `Validar`/`Guardar` **una vez por rama** (Excel y PDF), no las fusiona; no se añade `Merge` para no bloquear correos con un solo tipo de adjunto. `row_key` UNIQUE evita duplicados entre ramas.

## Generación de los workflows
`n8n/code/*.js` es la fuente de verdad. `npm run build:workflows` genera los dos JSON y
`npm run check:workflows` verifica que estén sincronizados (sin editar el JSON a mano).

## Seguridad
- RLS activo en todas las tablas; el dashboard usa la clave `anon` (solo lectura) y solo desde el servidor.
- La `service_role` vive solo en las credenciales de n8n. Ningún secreto en el repo.
