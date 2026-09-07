import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const theme = JSON.parse(
  readFileSync(resolve(root, '../app/src/theme.json'), 'utf8'),
);

if (typeof theme.bg !== 'string') {
  throw new Error('app/src/theme.json is missing bg');
}

const tokens = Object.entries(theme)
  .map(([name, value]) => `  --color-theme-${name}: ${value};`)
  .join('\n');

writeFileSync(
  resolve(root, 'src/theme.css'),
  `/* Generated from app/src/theme.json by npm run generate. Do not edit by hand. */\n@theme {\n${tokens}\n}\n`,
);

const htmlPath = resolve(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const themeColor = /(<meta\s+name="theme-color"\s+content=")[^"]+(")/;

if (!themeColor.test(html)) {
  throw new Error('index.html is missing a theme-color meta tag');
}

const nextHtml = html.replace(themeColor, `$1${theme.bg}$2`);
if (nextHtml !== html) {
  writeFileSync(htmlPath, nextHtml);
}

const manifestPath = resolve(root, 'public/manifest.webmanifest');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (
  manifest.theme_color !== theme.bg ||
  manifest.background_color !== theme.bg
) {
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {...manifest, background_color: theme.bg, theme_color: theme.bg},
      null,
      2,
    )}\n`,
  );
}

console.log(
  `theme.css: ${Object.keys(theme).length} colours from app/src/theme.json`,
);
