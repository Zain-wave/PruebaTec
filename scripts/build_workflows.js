#!/usr/bin/env node
/**
 * Genera los workflows de n8n (JSON importable) a partir de n8n/code/*.js.
 *
 * Uso:
 *   node scripts/build_workflows.js          # escribe los JSON
 *   node scripts/build_workflows.js --check  # falla si los JSON no coinciden con el código
 *
 * Así el código de los Code nodes vive en archivos .js legibles y probados (tests/),
 * y el JSON del workflow se regenera sin editarlo a mano. Es la versión Node del
 * antiguo build_workflows.py (Python no está disponible en Windows por defecto).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CODE = path.join(ROOT, 'n8n', 'code');
const OUT = path.join(ROOT, 'n8n');
const LIB = read('lib.js');

const SUPABASE = 'https://ufrxxzrbakoaiqzzocds.supabase.co'; // URL pública del proyecto (no es secreto)
const GEMINI_MODEL = 'gemini-3.6-flash';
const PREFER = { Prefer: 'resolution=ignore-duplicates,return=minimal' };

function read(name) {
  return fs.readFileSync(path.join(CODE, name), 'utf8');
}

function code(name) {
  return read(name);
}

function codeNode(id, name, js, pos, withLib = true) {
  const src = withLib ? `${LIB}\n\n${js}` : js;
  return {
    id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos,
    parameters: { mode: 'runOnceForAllItems', jsCode: src },
  };
}

function httpNode(id, name, method, url, pos, opts = {}) {
  const {
    bodyExpr = null, headers = null, cred = 'supabase',
    retry = false, maxTries = 3, wait = 5000, onError = null,
  } = opts;
  // Supabase necesita DOS headers (apikey y Authorization: Bearer) para que
  // PostgREST use el rol service_role y omita RLS. Header Auth solo permite uno,
  // así que usamos Custom Auth. Gemini sí funciona con un solo header.
  const authType = cred === 'supabase' ? 'httpCustomAuth' : 'httpHeaderAuth';
  const params = {
    method, url, authentication: 'genericCredentialType',
    genericAuthType: authType, options: {},
  };
  if (headers) {
    params.sendHeaders = true;
    params.headerParameters = { parameters: Object.entries(headers).map(([k, v]) => ({ name: k, value: v })) };
  }
  if (bodyExpr) {
    params.sendBody = true;
    params.specifyBody = 'json';
    params.jsonBody = bodyExpr;
  }
  const node = {
    id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, parameters: params,
    credentials: {
      [authType]: {
        id: '', name: cred === 'supabase' ? 'Supabase service key' : 'Gemini API key',
      },
    },
  };
  if (retry) node.retryOnFail = true;
  if (retry) node.maxTries = maxTries;
  if (retry) node.waitBetweenTries = wait;
  if (onError) node.onError = onError;
  return node;
}

function extractNode(id, name, operation, pos) {
  return {
    id, name, type: 'n8n-nodes-base.extractFromFile', typeVersion: 1, position: pos,
    parameters: { operation, binaryPropertyName: 'data', options: {} },
    // Un PDF/Excel corrupto no debe tumbar el workflow ni perder el correo:
    // el normalizador lo convierte en una fila quality_flag='error'.
    onError: 'continueRegularOutput',
  };
}

function conn(...pairs) {
  const c = {};
  for (const p of pairs) {
    const src = p[0];
    const dst = p[1];
    const idx = p.length > 2 ? p[2] : 0;
    const outs = (c[src] = c[src] || { main: [] }).main;
    while (outs.length <= idx) outs.push([]);
    outs[idx].push({ node: dst, type: 'main', index: 0 });
  }
  return c;
}

function workflow(name, nodes, connections) {
  return { name, nodes, connections, active: false, settings: { executionOrder: 'v1' }, pinData: {} };
}

// =========================== Workflow 1: ingesta ===========================
const F = 'Filtrar remitente y expandir adjuntos';

function buildIngesta() {
  const nodes = [
    {
      id: 'n1', name: 'Email Trigger (IMAP)', type: 'n8n-nodes-base.emailReadImap', typeVersion: 2,
      position: [0, 300],
      parameters: {
        mailbox: 'INBOX',
        postProcessAction: 'read',
        format: 'simple',
        downloadAttachments: true,
        dataPropertyAttachmentsPrefixName: 'attachment_',
        options: {
          customEmailConfig: '["UNSEEN", ["FROM", "remitente@ejemplo.com"]]',
          forceReconnect: 60,
        },
      },
      credentials: { imap: { id: '', name: 'Gmail IMAP' } },
    },
    codeNode('n2', F, code('01_filtrar.js'), [260, 300]),
    httpNode('n3', 'Registrar archivo recibido', 'POST',
      `${SUPABASE}/rest/v1/processed_files?on_conflict=message_id,filename`, [520, 120], {
        bodyExpr: '={{ JSON.stringify({ message_id: $json.message_id, filename: $json.filename, source_type: $json.source_type, sender: $json.sender, subject: $json.subject }) }}',
        headers: PREFER,
        retry: true,
        onError: 'continueRegularOutput',
      }),
    {
      id: 'n4', name: '¿Es Excel?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [520, 300],
      parameters: {
        conditions: {
          options: { caseSensitive: false, leftValue: '', typeValidation: 'strict' },
          conditions: [{
            id: 'c1', leftValue: '={{ $json.ext }}', rightValue: 'xlsx',
            operator: { type: 'string', operation: 'equals' },
          }],
          combinator: 'and',
        },
      },
    },
    extractNode('n5', 'Leer Excel', 'xlsx', [780, 220]),
    extractNode('n6', 'Leer PDF', 'pdf', [780, 400]),
    codeNode('n7', 'Normalizar Excel', code('02_normalizar_excel.js'), [1040, 220]),
    codeNode('n8', 'Normalizar PDF', code('03_normalizar_pdf.js'), [1040, 400]),
    codeNode('n9', 'Validar y preparar fila', code('04_validar.js'), [1300, 300]),
    httpNode('n10', 'Guardar en Supabase', 'POST', `${SUPABASE}/rest/v1/records?on_conflict=row_key`, [1560, 300], {
      bodyExpr: '={{ JSON.stringify($json) }}',
      headers: PREFER,
      retry: true,
      maxTries: 5,
      wait: 10000,
    }),
  ];

  const connections = conn(
    ['Email Trigger (IMAP)', F], [F, 'Registrar archivo recibido'], [F, '¿Es Excel?'],
    ['¿Es Excel?', 'Leer Excel', 0], ['¿Es Excel?', 'Leer PDF', 1],
    ['Leer Excel', 'Normalizar Excel'], ['Leer PDF', 'Normalizar PDF'],
    ['Normalizar Excel', 'Validar y preparar fila'], ['Normalizar PDF', 'Validar y preparar fila'],
    ['Validar y preparar fila', 'Guardar en Supabase'],
  );

  return workflow('1 - Ingesta de correos (Excel y PDF)', nodes, connections);
}

// ======================= Workflow 2: resumen con IA ========================
function buildResumen() {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const nodes = [
    {
      id: 'r1', name: 'Programado (diario)', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
      position: [0, 200],
      parameters: { rule: { interval: [{ field: 'days', triggerAtHour: 8 }] } },
    },
    {
      id: 'r2', name: 'Ejecutar manualmente', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1,
      position: [0, 400], parameters: {},
    },
    httpNode('r3', 'Leer registros', 'GET',
      `${SUPABASE}/rest/v1/records?select=row_key,fecha,cliente,categoria,valor,estado,quality_flag&order=fecha.desc&limit=5000`,
      [260, 300], { retry: true }),
    codeNode('r4', 'Preparar prompt', code('05_preparar_prompt.js'), [520, 300], false),
    httpNode('r5', 'Gemini: resumen e inconsistencias', 'POST', geminiUrl, [780, 300], {
      bodyExpr: '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: \'application/json\' } }) }}',
      cred: 'gemini', retry: true, onError: 'continueRegularOutput',
    }),
    codeNode('r6', 'Parsear respuesta (con fallback)', code('06_parsear_respuesta.js'), [1040, 300], false),
    httpNode('r7', 'Guardar resumen', 'POST', `${SUPABASE}/rest/v1/ai_summaries`, [1300, 200], {
      bodyExpr: '={{ JSON.stringify({ period_from: $json.period_from, period_to: $json.period_to, total_records: $json.total_records, valor_total: $json.valor_total, summary: $json.summary, model: $json.model, used_fallback: $json.used_fallback }) }}',
      headers: { Prefer: 'return=minimal' }, retry: true,
    }),
    codeNode('r8', 'Un item por inconsistencia', code('07_dividir_inconsistencias.js'), [1300, 420], false),
    httpNode('r9', 'Guardar inconsistencias', 'POST', `${SUPABASE}/rest/v1/ai_flags?on_conflict=row_key,motivo`, [1560, 420], {
      bodyExpr: '={{ JSON.stringify($json) }}', headers: PREFER, retry: true,
    }),
  ];
  // Con 0 registros el nodo HTTP no emite items; alwaysOutputData lo convierte
  // en [{}] y el filtro de 05_preparar_prompt.js lo descarta. Así el workflow
  // genera igualmente un resumen ("No hay registros...") en vez de no ejecutarse.
  nodes.find((n) => n.name === 'Leer registros').alwaysOutputData = true;
  nodes.find((n) => n.name === 'Preparar prompt').alwaysOutputData = true;

  const connections = conn(
    ['Programado (diario)', 'Leer registros'], ['Ejecutar manualmente', 'Leer registros'],
    ['Leer registros', 'Preparar prompt'], ['Preparar prompt', 'Gemini: resumen e inconsistencias'],
    ['Gemini: resumen e inconsistencias', 'Parsear respuesta (con fallback)'],
    ['Parsear respuesta (con fallback)', 'Guardar resumen'],
    ['Parsear respuesta (con fallback)', 'Un item por inconsistencia'],
    ['Un item por inconsistencia', 'Guardar inconsistencias'],
  );

  return workflow('2 - Resumen e inconsistencias con IA', nodes, connections);
}

function build() {
  return {
    ingesta: JSON.stringify(buildIngesta(), null, 2),
    resumen: JSON.stringify(buildResumen(), null, 2),
  };
}

function main() {
  const check = process.argv.includes('--check');
  const built = build();
  const files = {
    ingesta: path.join(OUT, 'workflow_1_ingesta.json'),
    resumen: path.join(OUT, 'workflow_2_resumen_ia.json'),
  };
  let changes = 0;
  for (const key of Object.keys(files)) {
    const current = fs.existsSync(files[key]) ? fs.readFileSync(files[key], 'utf8') : '';
    const same = current === built[key];
    if (!same) changes += 1;
    if (check) {
      console.log(`${same ? 'OK   ' : 'DRIFT'} ${path.relative(ROOT, files[key])}`);
    } else {
      fs.writeFileSync(files[key], built[key], 'utf8');
      console.log(`${same ? 'sin cambios' : 'escrito'} ${path.relative(ROOT, files[key])}`);
    }
  }
  if (check && changes) {
    console.error(`\n${changes} workflow(s) desactualizado(s). Ejecuta: node scripts/build_workflows.js`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { build, buildIngesta, buildResumen, LIB, SUPABASE, GEMINI_MODEL };
