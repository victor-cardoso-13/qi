// Imprime o banco em formato compacto para revisão: id|nível|pergunta => CERTA  ‖ erradas
import fs from 'node:fs';
const q = JSON.parse(fs.readFileSync(new URL('../questions.json', import.meta.url)));
const [a, b] = [Number(process.argv[2]), Number(process.argv[3])];
for (const x of q.filter((x) => x.id >= a && x.id <= b))
  console.log(`${x.id}|${x.nivel[0]}|${x.pergunta} => ${x.alternativas[x.correta]} ‖ ${x.alternativas.filter((_, i) => i !== x.correta).join(' ; ')}`);
