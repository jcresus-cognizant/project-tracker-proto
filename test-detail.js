const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('detail.html', 'utf8');
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable"
});

dom.window.onerror = function(msg, source, lineno, colno, error) {
  console.error('Browser Error:', msg, 'at', source, lineno);
  console.error(error);
};

dom.window.document.addEventListener('DOMContentLoaded', () => {
  console.log("DOMContentLoaded fired!");
});
