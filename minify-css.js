const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, 'css');
const files = ['reset', 'variables', 'main'];

function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

for (const name of files) {
  const input = path.join(cssDir, `${name}.css`);
  const output = path.join(cssDir, `${name}.min.css`);
  const css = fs.readFileSync(input, 'utf8');
  const minified = minifyCss(css);

  fs.writeFileSync(output, `${minified}\n`, 'utf8');
  console.log(`${path.relative(__dirname, output)} ${minified.length} bytes`);
}
