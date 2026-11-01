/**
 * Solo: sequência de perguntas, o primeiro erro (ou tempo esgotado) acaba.
 * Ajudas: Pular e Eliminar 2 (limitadas; ganha 1 sorteada a cada 10 acertos). Pausa livre: esconde a pergunta.
 */
import { ajudaGanha, eliminar2, embaralhar, perguntaSolo, type Pergunta } from '../motor/motor.ts';
import { NIVEL_NOME, CATEGORIAS, SOLO_AJUDAS_INICIAIS, TEMPO } from '../motor/regras.ts';
import { atualizar, dataBonita, hoje, ler } from './dados.ts';
import {
  ICONE_PAUSA, LETRAS, PERGUNTAS, VELOCIDADE, atualizarCronometro, cronometroHTML, esc, params, pistaHTML, tempoTexto, ui,
} from './comum.ts';

type Fase = 'pergunta' | 'resposta' | 'fim';
interface Corrida {
  seq: number; pular: number; elim: number; usadas: Set<number>;
  q: Pergunta; ordem: number[]; limite: number; fimEm: number; restante: number;
  fase: Fase; pausado: boolean; escolha: number | null; motivo: 'erro' | 'tempo' | 'desistiu' | null;
  fora: number[]; elimNestaPergunta: boolean; ultimaCat?: string; premio: string;
  ajudasUsadas: number; puladas: number; comeco: number; novoRecorde: boolean; semente: number; modal: boolean; recordeFeito: boolean;
}
let C: Corrida | null = null;
let timerProx: ReturnType<typeof setTimeout> | null = null;

const agora = () => performance.now();
const certaMostrada = (c: Corrida) => c.ordem.indexOf(c.q.correta);

export function iniciarSolo() {
  if (timerProx) clearTimeout(timerProx);
  C = {
    seq: 0, pular: SOLO_AJUDAS_INICIAIS.pular, elim: SOLO_AJUDAS_INICIAIS.eliminar, usadas: new Set(),
    q: null as unknown as Pergunta, ordem: [], limite: 0, fimEm: 0, restante: 0, fase: 'pergunta', pausado: false,
    escolha: null, motivo: null, fora: [], elimNestaPergunta: false, premio: '', ajudasUsadas: 0, puladas: 0,
    comeco: Date.now(), novoRecorde: false, semente: Math.floor(Math.random() * 1e9), modal: false, recordeFeito: false,
  };
  novaPergunta(Number(params.get('q')) || undefined); // ?q=ID: só para testes
}

function novaPergunta(forcada?: number) {
  const c = C!;
  const q = (forcada && PERGUNTAS.get(forcada)) || perguntaSolo([...PERGUNTAS.values()], c.seq, c.usadas, new Set(ler().vistas), c.ultimaCat);
  if (!q) return fim('desistiu'); // acabaram todas as perguntas: encerra com o que fez
  c.q = q; c.usadas.add(q.id); c.ultimaCat = q.cat;
  c.ordem = embaralhar(5); c.fora = []; c.elimNestaPergunta = false; c.escolha = null; c.fase = 'pergunta'; c.pausado = false;
  c.limite = (TEMPO[q.nivel] * 1000) / VELOCIDADE; c.restante = c.limite; c.fimEm = agora() + c.limite;
  atualizar((d) => { if (!d.vistas.includes(q.id)) d.vistas.push(q.id); });
  ui.desenhar();
}

function responder(i: number) { // i = posição mostrada; -1 = tempo esgotado
  const c = C!;
  if (c.fase !== 'pergunta' || c.pausado) return;
  c.escolha = i; c.fase = 'resposta';
  const acertou = i === certaMostrada(c);
  if (acertou) {
    c.seq++;
    const ganho = ajudaGanha(c.seq);
    c.premio = '';
    if (ganho === 'pular') { c.pular++; c.premio = '+1 Pular'; }
    if (ganho === 'eliminar') { c.elim++; c.premio = '+1 Eliminar 2'; }
    ui.desenhar();
    timerProx = setTimeout(() => novaPergunta(), 1300 / VELOCIDADE);
  } else {
    c.motivo = i < 0 ? 'tempo' : 'erro';
    registrarRecorde(c);
    ui.desenhar(); // mostra a certa por uns 3,5 s e então abre o quadro com Jogar de novo / Ver resposta / Sair
    timerProx = setTimeout(() => { c.modal = true; ui.desenhar(); }, 3500 / VELOCIDADE);
  }
}

function fim(motivo: Corrida['motivo']) {
  const c = C!;
  if (timerProx) clearTimeout(timerProx);
  c.motivo = c.motivo ?? motivo; c.fase = 'fim'; c.pausado = false; c.modal = false;
  registrarRecorde(c);
  ui.desenhar();
}

/** Guarda o recorde (número + data) uma vez só por partida. */
function registrarRecorde(c: Corrida) {
  if (c.recordeFeito) return;
  c.recordeFeito = true;
  const d = ler();
  if (c.seq > 0 && (!d.recorde || c.seq > d.recorde.n)) { c.novoRecorde = true; atualizar((x) => { x.recorde = { n: c.seq, data: hoje() }; }); }
}

function pausar(on: boolean) {
  const c = C;
  if (!c || c.fase !== 'pergunta' || c.pausado === on) return;
  if (on) c.restante = Math.max(0, c.fimEm - agora()); else c.fimEm = agora() + c.restante;
  c.pausado = on; ui.desenhar();
}

export function sairDoSolo() { if (timerProx) clearTimeout(timerProx); C = null; }
export const soloAtivo = () => !!C;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pausar(true); }); // aba escondida = pausa

setInterval(() => {
  const c = C;
  if (!c || ui.tela !== 'solo' || c.fase !== 'pergunta' || c.pausado) return;
  const resta = c.fimEm - agora();
  if (resta <= 0) { atualizarCronometro(0, c.limite); responder(-1); } else atualizarCronometro(resta, c.limite);
}, 200);

export async function acaoSolo(act: string, el: HTMLElement): Promise<boolean> {
  const c = C;
  if (!c) return false;
  if (act === 'ans') responder(Number(el.dataset.i));
  else if (act === 'pausar') pausar(true);
  else if (act === 'continuar') pausar(false);
  else if (act === 'desistir') fim('desistiu');
  else if (act === 'pular' && c.fase === 'pergunta' && !c.pausado && c.pular > 0) { c.pular--; c.puladas++; c.ajudasUsadas++; novaPergunta(); }
  else if (act === 'eliminar' && c.fase === 'pergunta' && !c.pausado && c.elim > 0 && !c.elimNestaPergunta) {
    c.elim--; c.ajudasUsadas++; c.elimNestaPergunta = true; c.fora = eliminar2(`${c.q.id}:${c.semente}`, certaMostrada(c)); ui.desenhar();
  }
  else if (act === 'resultado') fim(c.motivo);
  else if (act === 'ver-resposta') { c.modal = false; ui.desenhar(); }
  else if (act === 'de-novo') iniciarSolo();
  else if (act === 'ir-inicio') { sairDoSolo(); ui.ir('inicio'); }
  else return false;
  return true;
}

export function soloHTML() {
  const c = C!;
  return c.fase === 'fim' ? fimHTML(c) : perguntaHTML(c);
}

function perguntaHTML(c: Corrida) {
  const nome = ler().nome || 'Você';
  const q = c.q, cm = certaMostrada(c), resp = c.fase === 'resposta', oculta = c.pausado;
  const opts = c.ordem.map((oi, i) => {
    if (oculta) return '<div class="opt oculta"><span class="lt">·</span><span class="ot">&nbsp;</span></div>';
    let cls = 'opt';
    if (c.fora.includes(i) && !resp) cls += ' gone';
    if (resp) cls += i === cm ? ' right' : i === c.escolha ? ' wrong' : ' dim';
    const dis = resp || c.fora.includes(i);
    return `<button class="${cls}" data-act="ans" data-i="${i}" ${dis ? 'disabled' : ''}><span class="lt">${LETRAS[i]}</span><span class="ot">${esc(q.alternativas[oi])}</span></button>`;
  }).join('');
  const acertou = resp && c.escolha === cm;
  const faixa = resp
    ? `<div class="verdict ${acertou ? 'ok' : 'bad'}"><div><b>${acertou ? 'Certo!' : c.motivo === 'tempo' ? 'Tempo esgotado' : 'Errou'}</b><span>${acertou ? (c.premio ? `Sequência ${c.seq} · ganhou ${c.premio}` : `Sequência ${c.seq}`) : 'A resposta certa está marcada abaixo.'}</span></div>${acertou ? '' : '<button class="cta sm go" data-act="resultado">Ver resultado</button>'}</div>`
    : `<div class="meta">${cronometroHTML()}<div class="mi"><span class="tier t-${q.nivel}">${oculta ? '· · ·' : '● ' + NIVEL_NOME[q.nivel]}</span><span class="cat">${oculta ? '· · ·' : esc(CATEGORIAS[q.cat])}</span></div></div>`;
  const podeEl = !resp && !oculta && c.elim > 0 && !c.elimNestaPergunta, podePu = !resp && !oculta && c.pular > 0;
  return `<main class="qscr ${oculta ? 'pausada' : ''}"><div class="qleft">
    <div class="bar"><button class="ib" data-act="pausar" aria-label="Pausar" ${resp ? 'disabled' : ''}>${ICONE_PAUSA}</button>
    <div class="streak"><small>Sequência</small><b>${c.seq}</b></div>
    </div>
    ${pistaHTML(20, [{ cor: 'var(--a1)', nome, pos: c.seq, eu: true }])}${faixa}
    <h2 class="q">${oculta ? '<span class="barra"></span><span class="barra"></span><span class="barra c"></span>' : esc(q.pergunta)}</h2></div>
    <div class="opts">${opts}</div>
    ${oculta ? '' : `<div class="ajudas"><button data-act="pular" ${podePu ? '' : 'disabled'}><b>${c.pular}</b><span>Pular<small>troca a pergunta</small></span></button><button data-act="eliminar" ${podeEl ? '' : 'disabled'}><b>${c.elim}</b><span>Eliminar 2<small>tira 2 erradas</small></span></button></div>`}
    ${c.modal ? modalHTML(c) : ''}
    ${oculta ? `<div class="ov"><div class="ovc"><div class="pic">${ICONE_PAUSA}</div><h3>Pausado</h3><p>O tempo parou e a pergunta fica escondida.</p><button class="cta big" data-act="continuar"><span>Continuar</span></button><button class="cta" data-act="desistir"><span>Desistir e ver o resultado</span></button></div></div>` : ''}</main>`;
}

function modalHTML(c: Corrida) {
  const d = ler();
  const rec = c.novoRecorde ? '<span class="newrec">Novo recorde!</span>' : d.recorde ? `<span class="data">Recorde: ${d.recorde.n} · ${dataBonita(d.recorde.data)}</span>` : '';
  return `<div class="ov"><div class="ovc"><div class="lbl c">${c.motivo === 'tempo' ? 'Tempo esgotado' : 'Fim da sequência'}</div>
    <div class="big14 mini"><b>${c.seq}</b><span>${c.seq === 1 ? 'acerto seguido' : 'acertos seguidos'}</span></div>${rec}
    <button class="cta big" data-act="de-novo"><span>Jogar de novo</span></button>
    <button class="cta" data-act="ver-resposta"><span>Ver a resposta</span></button>
    <button class="cta" data-act="ir-inicio"><span>Sair</span></button></div></div>`;
}

function fimHTML(c: Corrida) {
  const d = ler(), q = c.q, cm = certaMostrada(c);
  const rec = d.recorde ? `<div class="rec"><div><small>Recorde</small><b>${d.recorde.n}</b><span class="data">${dataBonita(d.recorde.data)}</span></div>${c.novoRecorde ? '<span class="newrec">Novo recorde!</span>' : ''}</div>` : '';
  const titulo = c.motivo === 'tempo' ? 'Tempo esgotado' : c.motivo === 'desistiu' ? 'Você parou aqui' : 'Fim da sequência';
  const resposta = c.motivo === 'desistiu' || !q ? '' : `<div class="lost"><small>${c.motivo === 'tempo' ? 'Você não respondeu. A resposta era' : 'A resposta era'}</small><div class="opt right"><span class="lt">${LETRAS[cm]}</span><span class="ot">${esc(q.alternativas[q.correta])}</span></div></div>`;
  return `<main class="fimsolo"><div class="col-a"><div class="lbl c">${titulo}</div>
    <div class="big14"><b>${c.seq}</b><span>${c.seq === 1 ? 'acerto seguido' : 'acertos seguidos'}</span></div>${rec}</div>
    <div class="col-b">${resposta}
    <div class="stats"><div><b>${c.ajudasUsadas}</b><small>ajudas usadas</small></div><div><b>${c.puladas}</b><small>puladas</small></div><div><b>${tempoTexto(Date.now() - c.comeco)}</b><small>tempo</small></div></div>
    <button class="cta big" data-act="de-novo"><span>Jogar de novo</span></button><button class="cta" data-act="ir-inicio"><span>Voltar ao início</span></button></div></main>`;
}
