# Cómo validar lo generado con ayuda de IA

## Ya verificado en el scaffold
- `npm test`: **31 pruebas** sobre:
  - parseo de números (incluida notación científica) y fechas (`dd/mm/yyyy`, `27 de octubre de 2026`, serial de Excel);
  - normalización Excel/PDF, validación, `row_key` y deduplicación;
  - filtro de remitente **exacto** (lookalikes como `xremitente@...` y `...@ejemplo.com.evil.com`);
  - `message_id` desde `metadata['message-id']`, con fallback al UID de IMAP;
  - errores de extracción de Excel/PDF (se convierten en filas `quality_flag='error'` estables);
  - emparejamiento `pairedItem` con dos adjuntos distintos;
  - workflow 2 (métricas, JSON válido, rechazo de `row_key` inventados, fallback, cero registros);
  - sincronía entre `n8n/code/*.js` y los JSON de los workflows.
- `npm run check:workflows`: valida los dos JSON sin tener n8n instalado (conexiones, parámetros críticos,
  límite de 5000, extractores con `onError`, URLs de Supabase/Gemini).
- Los workflows se **generan** desde el código con `npm run build:workflows`; no se editan a mano.
- Muestra Excel: 21 filas → 20 `row_key` únicas, 1 error y 1 warning, **$9.566.000** tras deduplicar.
- Muestra PDF: 5 registros, incluidas fechas en texto (`27 de octubre de 2026`) y valores colombianos.
- `sql/seed.sql` se regenera deduplicado: 20 registros y resumen con 20 / **$9.566.000**.
- `dashboard/src/lib/metrics.ts` compila en modo estricto y el dashboard se verificó en modo real contra
  Supabase (20 registros, $9.566.000, 30.0% completado, 90.0% confiabilidad).
- **n8n local 2.46.6**: los dos workflows reales se importaron sin errores. Con variantes de prueba (sin
  credenciales, mismos Code nodes) se ejecutó:
  - workflow 1 con el Excel **y** el PDF de muestra: 21 filas Excel + 5 PDF, `source_file`/`message_id`
    emparejados correctamente, 1 error y 1 warning;
  - workflow 2 con 2 registros: total 4500, resumen de Gemini (mock) y 1 inconsistencia validada;
  - workflow 2 con 0 registros: `alwaysOutputData` del HTTP + filtro de `[{}]` → resumen
    "No hay registros en el periodo para resumir." y 0 flags.
  - POST HTTP con expresión `jsonBody` y header `Prefer` contra un servidor local: el cuerpo llega como
    JSON válido (sin doble codificación) y el header se conserva.
  - Nota de n8n: `Validar`/`Guardar` se ejecutan **una vez por rama** (Excel y PDF), no fusionan; por eso
    `Guardar en Supabase` hace dos inserts (21 y 5) y el `row_key` UNIQUE evita duplicados.
- **n8n Cloud + Supabase real + Gemini 3.6 Flash**: workflow 2 ejecutado contra la base real; 20 registros,
  $9.566.000, resumen de Gemini (`used_fallback=false`) y 2 inconsistencias validadas. El modelo 2.5 ya no
  está disponible para keys nuevas; se usa `gemini-3.6-flash` con `maxOutputTokens: 4096` porque el modelo
  consume tokens en "thinking" y truncaba el JSON.
- **Credencial de Supabase**: PostgREST necesita `apikey` **y** `Authorization: Bearer <service_role>`.
  Con solo `apikey` la escritura se ejecuta como `anon` y falla por RLS; por eso los nodos usan *Custom Auth*.

## Por hacer durante tu prueba (marca cada uno cuando lo hagas)
- [x] Ejecutar en n8n Cloud con un correo real (verificado el 2026-11-07: 1 Excel, 21 filas, 20 registros únicos).
- [x] Enviar los mismos adjuntos dos veces y comprobar que `records` no crece (el reenvío quedó deduplicado por `row_key`).
- [ ] Revisar el PDF real y ajustar `03_normalizar_pdf.js` (y correr `npm test` + `npm run build:workflows`).
- [ ] Comparar a mano 3-5 registros del dashboard contra el archivo original.
- [ ] Forzar un fallo de Gemini (key inválida) y confirmar que aparece el resumen por plantilla.
- [ ] Probar un Excel/PDF corrupto y confirmar que aparece una fila `error` (no se pierde el correo).
- [ ] Anotar en `docs/PROMPTS.md` los errores reales que encontraste y cómo los corregiste.

## Salida de la IA
El JSON de Gemini se parsea con try/catch y se filtra:
- máximo 10 inconsistencias;
- `row_key` debe existir en los registros leídos (si el modelo lo inventa, se descarta);
- `motivo` obligatorio y `severidad` normalizada a `alta|media|baja` (o `null`);
- si la API falla, se usa una plantilla y `used_fallback=true`.

Los números del resumen vienen del código, no del modelo.

## Comandos útiles
```bash
npm test
npm run check:workflows
npm run build:workflows
npm run seed
```
