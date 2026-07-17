const fs = require('fs');

global.window = { location: { search: '' } };
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
  get(key) { return null; }
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
global.bootstrap = { Modal: class { constructor() {} show() {} hide() {} } };

const code = fs.readFileSync('app-data.js', 'utf8') + '\n' + fs.readFileSync('scripts-member.js', 'utf8');

try {
  eval(code);
  console.log("Scripts loaded successfully without throwing.");
  if (typeof render === 'function') render();
  console.log("render executed successfully without throwing.");
} catch (e) {
  console.error("Error caught:", e);
}
