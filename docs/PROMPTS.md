# Prompts e instrucciones relevantes

> Registro de los prompts reales usados y de los errores encontrados/corregidos durante la prueba.

## 1. Prompt de análisis inicial (auditoría del scaffold)
Se pidió revisar **todo** el contenido de la carpeta y entregar:
- hallazgos por severidad (P0–P3), con archivo/línea y evidencia;
- orden de corrección;
- verificación reproducible (tests, build, datos de muestra).

Resultado: auditoría de los 44 archivos, 10/10 tests iniciales, validación del Excel de muestra
(21 filas → 20 únicas, 1 error, 1 warning, $9.566.000) y detección de los problemas que se corrigieron después.

## 2. Prompt del resumen (Gemini)
Vive en `n8n/code/05_preparar_prompt.js` (se incrusta en el workflow al generar el JSON):

```text
Eres un analista de datos. Recibes MÉTRICAS ya calculadas y una muestra de registros.
Tareas:
1) "resumen": 2-3 frases en español para un directivo. Usa SOLO las cifras de MÉTRICAS. No calcules ni inventes cifras.
2) "inconsistencias": máximo 10 registros sospechosos que las reglas simples NO detectan: nombres de cliente
   casi iguales (typos), categorías raras, valores muy atípicos respecto al resto del mismo cliente o categoría.
   Cita el row_key EXACTO de la muestra. Si no hay, devuelve [].
Responde SOLO un JSON: {"resumen": string, "inconsistencias": [{"row_key": string, "motivo": string,
"severidad": "alta"|"media"|"baja"}]}

MÉTRICAS:
${JSON.stringify(metrics)}

MUESTRA (row_key ; fecha ; cliente ; categoria ; valor ; estado):
${filas}
```

Reglas clave:
- Las cifras las calcula el código; el modelo **solo redacta**.
- `responseMimeType: application/json` y `temperature: 0.2`.
- Si Gemini falla, se usa una plantilla y `used_fallback=true` (visible en el dashboard).
- Los `row_key` devueltos se validan contra los registros reales antes de insertar.

## 3. Errores encontrados y cómo se corrigieron
| Error | Cómo se detectó | Corrección |
|---|---|---|
| El filtro de remitente usaba `includes()`: `xremitente@ejemplo.com` pasaba | Test con lookalikes | `emailAddress()` + comparación exacta en `01_filtrar.js` |
| `message_id` se armaba con `subject / date` y no se llenaba desde IMAP | Lectura del código fuente de n8n IMAP v2 | Se lee `metadata['message-id']`; fallback a `attributes.uid` y, último, `from / date / subject` |
| Un Excel/PDF corrupto detenía el workflow y el correo ya estaba marcado como leído | Prueba con `Extract from File` + `onError` | `onError: continueRegularOutput`; el normalizador crea una fila `quality_flag='error'` con `row_key` estable |
| Las filas de Excel no traían el `message_id`/archivo | Revisión de `SpreadsheetFile` (no conserva el JSON de entrada) | `itemMatching(i)` + fallback por `pairedItem`/índice |
| Gemini podía inventar `row_key` | Prueba con un flag `inventado` | `validKeys` en `Preparar prompt` y filtro en `Parsear`; además FK en `ai_flags` |
| División por cero con 0 registros | Test de workflow 2 sin datos | `Math.max(total,1)` y respuesta "No hay registros..." |
| El dashboard mostraba datos viejos tras el seed | `fetch-cache` de Next | `cache: 'no-store'` en `src/lib/supabase.ts` |
| El seed contaba 21 filas y sumaba el duplicado | Comparación con `records` (20) | `make_seed.js` deduplica antes de contar/sumar; seed con 20 / $9.566.000 |
| El generador de workflows dependía de Python (no instalado en Windows) | `npm run build:workflows` fallaba | Generador en Node (`scripts/build_workflows.js`), wrapper `.py` opcional y `--check` |
| El límite del workflow 2 (500) no coincidía con el dashboard (5000) | Revisión cruzada | Ambos leen 5000 |
| Con 0 registros el workflow 2 no se ejecutaba (el HTTP devolvía 0 items) | Prueba de ejecución local en n8n 2.46.6 | `alwaysOutputData` en `Leer registros` y `05_preparar_prompt.js` descarta el item `{}` |
| `Validar`/`Guardar` se ejecutan una vez por rama (Excel y PDF), no fusionan | Ejecución local con dos adjuntos | Comportamiento normal de n8n; ambos inserts usan `row_key` UNIQUE y no duplican |
