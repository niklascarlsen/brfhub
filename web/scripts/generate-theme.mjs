import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {radius, theme} from '../../app/src/theme.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (typeof theme.bg !== 'string') {
  throw new Error('app/src/theme.ts is missing bg');
}

const tokens = [
  ...Object.entries(theme).map(
    ([name, value]) => `  --color-theme-${name}: ${value};`,
  ),
  ...Object.entries(radius).map(([name, px]) => `  --radius-${name}: ${px}px;`),
].join('\n');

writeFileSync(
  resolve(root, 'src/theme.css'),
  `/* Generated from app/src/theme.ts by npm run generate. Do not edit by hand. */\n@theme {\n${tokens}\n}\n`,
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
  `theme.css: ${Object.keys(theme).length} colours and the radii from app/src/theme.ts`,
);
