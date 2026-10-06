/**
 * Ajusta o index.html gerado pelo `expo export` para a versao web:
 * idioma, cor do tema e os dados para "Adicionar a tela inicial" no celular.
 * Os arquivos referenciados ficam em `public/` e sao copiados pelo Expo.
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const tags = [
  '<link rel="manifest" href="/manifest.json" />',
  '<meta name="theme-color" content="#1F6B3A" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="AgroVax" />',
  '<meta name="description" content="AgroVax: gestão sanitária de bovinos e equinos." />',
];

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${tags.join('')}</head>`);
}
html = html.replace(/<html lang="[^"]*"/, '<html lang="pt-BR"');
fs.writeFileSync(file, html);
console.log('index.html ajustado para a versao web instalavel.');
