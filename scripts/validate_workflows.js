#!/usr/bin/env node
/**
 * Valida los workflows de n8n sin necesidad de tener n8n instalado:
 * JSON válido, conexiones coherentes, Code nodes sincronizados con n8n/code,
 * parámetros críticos del trigger/extractores y límites del workflow 2.
 *
 * Uso: node scripts/validate_workflows.js
 */
const fs = require('fs');
const path = require('path');
const { build, LIB } = require('./build_workflows');

const ROOT = path.resolve(__dirname, '..');
const FILES = {
  w1: path.join(ROOT, 'n8n', 'workflow_1_ingesta.json'),
  w2: path.join(ROOT, 'n8n', 'workflow_2_resumen_ia.json'),
};
const CODE = (name) => fs.readFileSync(path.join(ROOT, 'n8n', 'code', name), 'utf8');

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };

function load(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return { raw, json: JSON.parse(raw) };
  } catch (e) {
    errors.push(`${path.relative(ROOT, file)}: JSON inválido (${e.message})`);
    return { raw, json: null };
  }
}

const a = load(FILES.w1);
const b = load(FILES.w2);
const built = build();
check(a.raw === built.ingesta, 'workflow_1_ingesta.json está desincronizado (ejecuta node scripts/build_workflows.js)');
check(b.raw === built.resumen, 'workflow_2_resumen_ia.json está desincronizado (ejecuta node scripts/build_workflows.js)');

function validate(wf, label) {
  if (!wf) return;
  check(typeof wf.name === 'string' && wf.name.length > 0, `${label}: falta name`);
  check(Array.isArray(wf.nodes) && wf.nodes.length > 0, `${label}: falta nodes`);
  check(wf.connections && typeof wf.connections === 'object', `${label}: falta connections`);

  const names = wf.nodes.map((n) => n.name);
  const ids = wf.nodes.map((n) => n.id);
  check(new Set(names).size === names.length, `${label}: nombres de nodo duplicados`);
  check(new Set(ids).size === ids.length, `${label}: ids de nodo duplicados`);

  for (const n of wf.nodes) {
    check(Array.isArray(n.position) && n.position.length === 2, `${label}: posición inválida en "${n.name}"`);
    check(typeof n.type === 'string' && n.type.startsWith('n8n-nodes-base.'), `${label}: tipo inválido en "${n.name}"`);
    for (const [cred, c] of Object.entries(n.credentials ?? {})) {
      check(c && typeof c.name === 'string' && c.name.length > 0, `${label}: credencial ${cred} sin nombre en "${n.name}"`);
    }
  }

  const known = new Set(names);
  for (const [src, outs] of Object.entries(wf.connections ?? {})) {
    check(known.has(src), `${label}: conexión desde nodo inexistente "${src}"`);
    for (const branch of outs.main ?? []) {
      for (const c of branch) check(known.has(c.node), `${label}: conexión hacia nodo inexistente "${c.node}"`);
    }
  }
}

validate(a.json, 'workflow 1');
validate(b.json, 'workflow 2');

if (a.json) {
  const trigger = a.json.nodes.find((n) => n.type === 'n8n-nodes-base.emailReadImap');
  check(!!trigger, 'workflow 1: falta el trigger IMAP');
  if (trigger) {
    check(trigger.parameters.format === 'simple', 'workflow 1: el trigger debe usar format=simple');
    check(trigger.parameters.downloadAttachments === true, 'workflow 1: downloadAttachments debe ser true');
    check(trigger.parameters.postProcessAction === 'read', 'workflow 1: postProcessAction debe ser read');
    check(String(trigger.parameters.options?.customEmailConfig ?? '').includes('FROM'), 'workflow 1: falta el filtro FROM');
  }

  for (const name of ['Leer Excel', 'Leer PDF']) {
    const n = a.json.nodes.find((x) => x.name === name);
    check(!!n, `workflow 1: falta "${name}"`);
    if (n) {
      check(n.onError === 'continueRegularOutput', `workflow 1: "${name}" debe tener onError=continueRegularOutput`);
      check(n.parameters.binaryPropertyName === 'data', `workflow 1: "${name}" debe leer el binario "data"`);
    }
  }

  const save = a.json.nodes.find((n) => n.name === 'Guardar en Supabase');
  check(!!save && save.retryOnFail === true, 'workflow 1: "Guardar en Supabase" debe tener reintentos');
  check(!!save && /records\?on_conflict=row_key$/.test(save.parameters.url), 'workflow 1: URL de records/on_conflict incorrecta');

  for (const [name, file] of [
    ['Filtrar remitente y expandir adjuntos', '01_filtrar.js'],
    ['Normalizar Excel', '02_normalizar_excel.js'],
    ['Normalizar PDF', '03_normalizar_pdf.js'],
    ['Validar y preparar fila', '04_validar.js'],
  ]) {
    const n = a.json.nodes.find((x) => x.name === name);
    check(!!n && n.parameters.jsCode === `${LIB}\n\n${CODE(file)}`, `workflow 1: "${name}" no coincide con ${file}`);
  }
}

if (b.json) {
  const read = b.json.nodes.find((n) => n.name === 'Leer registros');
  check(!!read && /[?&]limit=5000(&|$)/.test(read.parameters.url), 'workflow 2: "Leer registros" debe leer 5000 filas');

  for (const [name, file] of [
    ['Preparar prompt', '05_preparar_prompt.js'],
    ['Parsear respuesta (con fallback)', '06_parsear_respuesta.js'],
    ['Un item por inconsistencia', '07_dividir_inconsistencias.js'],
  ]) {
    const n = b.json.nodes.find((x) => x.name === name);
    check(!!n && n.parameters.jsCode === CODE(file), `workflow 2: "${name}" no coincide con ${file}`);
  }

  const parse = b.json.nodes.find((n) => n.name === 'Parsear respuesta (con fallback)');
  check(!!parse && parse.parameters.jsCode.includes('validKeys'), 'workflow 2: falta validar los row_key de la IA');

  const flags = b.json.nodes.find((n) => n.name === 'Guardar inconsistencias');
  check(!!flags && /ai_flags\?on_conflict=row_key,motivo/.test(flags.parameters.url), 'workflow 2: URL de ai_flags/on_conflict incorrecta');
}

if (errors.length) {
  console.error('✗ Workflows inválidos:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('✓ Workflows válidos y sincronizados con n8n/code');
