# Decisiones técnicas

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| IMAP + contraseña de aplicación | Gmail API (OAuth) | Menos pasos; evita el vencimiento a 7 días del token OAuth en modo testing |
| n8n Cloud | n8n self-hosted | Sin infraestructura que mantener en 2 días; contra: la prueba gratuita es temporal |
| Parseo con Code nodes | LLM para extraer campos | Los documentos son estructurados: código es exacto, barato y testeable. El enunciado penaliza usar LLM para esto |
| IA para resumen e inconsistencias | IA para todo | Son tareas de lenguaje/criterio que reglas fijas no cubren bien |
| Métricas calculadas por código | Que el LLM calcule | Un LLM puede errar la aritmética; aquí solo redacta con cifras dadas |
| Supabase | SQLite / Google Sheets | SQLite no persiste entre ejecuciones en la nube; Supabase da constraints y RLS gratis |
| `row_key` por contenido | Hash del archivo | Detecta duplicados cuando el mismo dato llega en otro correo o en otro archivo **del mismo formato**. Limitación: Excel y PDF tienen campos específicos (`cantidad`/`referencia`), así que un mismo registro entre formatos puede no colapsar |
| Guardar filas con error (marcadas) | Descartarlas | Descartar en silencio oculta problemas; marcarlas permite alertar |
| Resumen aun con 0 registros | No ejecutar el workflow 2 si no hay filas | `alwaysOutputData` en el HTTP y filtro de `{}` en `05`; el dashboard muestra "No hay registros" en vez de quedarse sin resumen |
| Sin nodo Merge entre Excel y PDF | Fusionar ambas ramas antes de validar | n8n ejecuta el nodo una vez por conexión; sin Merge, un correo con un solo tipo de adjunto no se bloquea. `row_key` UNIQUE evita duplicados entre ramas |
| Next.js Server Components | API Route + fetch en cliente | Menos piezas; la clave no viaja al navegador |
| Workflows generados por script (Node) | Editar el JSON a mano | El código vive en `.js` legibles y con tests; el JSON se regenera con `npm run build:workflows` |

## Métricas adicionales del dashboard
1. **Tasa de completado**: mide la salud operativa (qué parte del trabajo termina bien).
2. **% de registros con alertas**: mide la confiabilidad del dato; sube si cambian los formatos de origen.
3. **Top 5 clientes por valor**: muestra la concentración del negocio en pocos clientes.
