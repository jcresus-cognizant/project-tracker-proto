const fs = require('fs');

global.window = { location: { search: '?type=project&id=1' } };
global.document = {
  addEventListener: () => {},
  getElementById: (id) => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    innerHTML: '',
    textContent: '',
    onclick: null
  }),
  querySelectorAll: () => [],
  createElement: () => ({ style: {} }),
};
global.URLSearchParams = class {
  constructor(str) {}
  get(key) { return key === 'type' ? 'project' : '1'; }
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
global.bootstrap = { Modal: class { constructor() {} show() {} hide() {} } };

let scriptsDetail = fs.readFileSync('scripts-detail.js', 'utf8');
scriptsDetail = scriptsDetail.replace('const STALE_DAYS = 14;', '');

const code = fs.readFileSync('app-data.js', 'utf8') + '\n' + scriptsDetail;

try {
  eval(code);
  console.log("Scripts loaded successfully without throwing.");
  renderDetail();
  console.log("renderDetail executed successfully without throwing.");
} catch (e) {
  console.error("Error caught:", e);
}
