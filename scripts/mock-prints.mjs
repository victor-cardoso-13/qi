// Tira prints de um mock HTML: node scripts/mock-prints.mjs mocks/arquivo.html prefixo
import { chromium } from 'playwright';
import { resolve } from 'node:path';
const [arq, pref = 'mock'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1160, height: 900 } });
await p.goto('file://' + resolve(arq));
await p.screenshot({ path: `prints/${pref}-pagina.png`, fullPage: true });
const ws = await p.$$('.wrap');
for (let i = 0; i < ws.length; i++) await ws[i].screenshot({ path: `prints/${pref}-${i + 1}.png` });
await b.close();
