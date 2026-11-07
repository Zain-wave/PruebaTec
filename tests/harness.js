// Ejecuta los scripts de los Code nodes de n8n fuera de n8n, simulando $input, $() y pairedItem.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'n8n', 'code');
const lib = fs.readFileSync(path.join(dir, 'lib.js'), 'utf8');

function load(script) {
  return `${lib}\n${fs.readFileSync(path.join(dir, script), 'utf8')}`;
}

function loadRaw(script) {
  return fs.readFileSync(path.join(dir, script), 'utf8');
}

function pairedIndex(it, fallback) {
  const pi = Array.isArray(it?.pairedItem) ? it.pairedItem[0] : it?.pairedItem;
  const idx = typeof pi === 'number' ? pi : pi?.item;
  return typeof idx === 'number' ? idx : fallback;
}

function makeContext(items, metaItems) {
  const $input = {
    all: () => items,
    first: () => items[0] ?? { json: {} },
    last: () => items[items.length - 1] ?? { json: {} },
  };
  // n8n: $('Nodo').itemMatching(i) usa el pairedItem del item i de la entrada actual.
  const $ = () => ({
    itemMatching: (i) => {
      const idx = pairedIndex(items[i], i);
      return metaItems[idx] ?? metaItems[i] ?? metaItems[0] ?? { json: {} };
    },
    all: () => metaItems,
    first: () => metaItems[0] ?? { json: {} },
    last: () => metaItems[metaItems.length - 1] ?? { json: {} },
  });
  return { $input, $ };
}

// items: lo que recibe el nodo; metaItems: salida del nodo "Filtrar remitente..." (para itemMatching)
function runNode(script, items, metaItems = []) {
  const { $input, $ } = makeContext(items, metaItems);
  return new Function('$input', '$', load(script))($input, $);
}

// Igual que runNode pero sin anteponer lib.js (para los Code nodes del workflow 2).
function runRaw(script, items, metaItems = []) {
  const { $input, $ } = makeContext(items, metaItems);
  return new Function('$input', '$', loadRaw(script))($input, $);
}

// expone las funciones de lib.js para probarlas una a una
function loadLib() {
  return new Function(`${lib}\n;return { parseNumber, parseDate, norm, canonEstado, validateRecord, rowKey, buildRecord, toDbRow, emailAddress, messageIdOf };`)();
}

module.exports = { runNode, runRaw, loadLib };
