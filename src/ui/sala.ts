/**
 * Sala online: várias pessoas, cada uma no seu celular (ou uma tela "tabuleiro" para a TV: ?tv=CODIGO).
 * O anfitrião (host) conduz as rodadas; todos escrevem só as próprias respostas.
 * Regras (src/motor/regras.ts): acertou +1, errou fica parado, desempate pela menor soma de tempos.
 */
import {
  aplicarResultado, classificar, eliminar2, embaralhar, posicaoRef, proximaPergunta, tempoGasto, vencedores,
} from '../motor/motor.ts';
import {
  CATEGORIAS, MAX_JOGADORES, NIVEL_NOME, PREP_MS, REVELA_MS, TAMANHOS, TAMANHO_PADRAO, TEMPO, type Nivel,
} from '../motor/regras.ts';
import { abrirSalas, local, type Db } from '../nuvem/salas-db.ts';
import { atualizar, ler } from './dados.ts';
import {
  LETRAS, PERGUNTAS, VELOCIDADE, atualizarCronometro, cronometroHTML, esc, fichaHTML, params, pistaHTML, tempoTexto, ui,
} from './comum.ts';
import { usuarioAtual } from '../nuvem/sincronia.ts';

const CORES = ['#ff6b81', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#a9b4c2'];
const SAIR_ICONE = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M14 8l4 4-4 4M18 12H9"/></svg>';

interface Jogador { name: string; j: number; color: string; pos: number; wins: number; h5: boolean; tt: number }
interface Entrada { n: number; choice?: number; t?: number; h5?: boolean }
interface Rodada { n: number; phase?: 'prep' | 'question' | 'reveal'; cat?: string; tier?: Nivel; qid?: number; order?: string; ends?: number; start?: number; ans?: number }
interface Resultado { ch: number; ok: boolean; d: number; ms: number }
interface Sala {
  host: string; status: 'lobby' | 'playing' | 'finished'; game: number; win?: number; created?: number;
  players?: Record<string, Jogador>; in?: Record<string, Entrada>; res?: Record<string, Resultado>;
  cur?: Rodada; used?: Record<string, boolean>; winners?: string; exhausted?: boolean;
}
type J = Jogador & { id: string };

export const isTV = params.has('tv');
let db: Db;
let S: Sala | null = null;
let code = (params.get('tv') || params.get('sala') || '').toUpperCase();
let unsub: (() => void) | null = null;
let confirmando = false;
let busy = false, handled = '', contadaKey = '';
const idStore = local ? sessionStorage : localStorage;
let pid = params.get('as') || idStore.getItem('qi.pid') || '';
if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); idStore.setItem('qi.pid', pid); }

export const codigoDaUrl = () => code;
export const emSala = () => !!code;
const players = (): J[] => Object.entries(S?.players || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.j - b.j);
const me = () => S?.players?.[pid];
const isHost = () => S?.host === pid;
const cur = () => S?.cur;
const casas = () => S?.win || TAMANHO_PADRAO;
const minhaEntrada = () => (S?.in?.[pid]?.n === cur()?.n ? S!.in![pid] : null);
const room = (p = '') => `rooms/${code}${p ? '/' + p : ''}`;
const nomeAtual = () => (document.getElementById('nome') as HTMLInputElement | null)?.value.trim() || ler().nome || usuarioAtual()?.email.split('@')[0].slice(0, 14) || '';

function novoCodigo() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
}

function observar() {
  history.replaceState(null, '', `?${isTV ? 'tv' : 'sala'}=${code}${params.get('as') ? '&as=' + params.get('as') : ''}${params.get('speed') ? '&speed=' + params.get('speed') : ''}${local ? '&local' : ''}`);
  unsub?.();
  unsub = db.on(room(), (v: Sala | null) => {
    S = v;
    if (!v) { ui.msg = 'Sala encerrada.'; sairLocal(); return; }
    ui.desenhar();
  });
}

function sairLocal() {
  unsub?.(); unsub = null; S = null; code = ''; confirmando = false; handled = '';
  history.replaceState(null, '', location.pathname);
  ui.ir('inicio');
}

async function entrar(nome: string) {
  const ex = await db.get(room(`players/${pid}`));
  if (ex) { await db.update(room(`players/${pid}`), { name: nome }); return; }
  const ps = Object.values((await db.get(room('players'))) || {}) as Jogador[];
  const j = ps.reduce((m, p) => Math.max(m, p.j), -1) + 1;
  const emAndamento = (await db.get(room('status'))) === 'playing';
  const pos = emAndamento && ps.length ? Math.min(...ps.map((p) => p.pos)) : 0; // entrada tardia: começa na última posição
  await db.set(room(`players/${pid}`), { name: nome, j, color: CORES[j % CORES.length], pos, wins: 0, h5: false, tt: ps.length && emAndamento ? Math.max(...ps.map((p) => p.tt || 0)) : 0 });
}

export async function criarSala(nome: string) {
  db = await abrirSalas();
  let c: string;
  do { c = novoCodigo(); } while (await db.get(`rooms/${c}`));
  code = c;
  await db.set(room(), { host: pid, status: 'lobby', game: 1, win: TAMANHO_PADRAO, created: db.now() });
  await entrar(nome);
  observar(); ui.ir('sala');
}

export async function entrarNaSala(c: string, nome: string) {
  db = await abrirSalas();
  const r = (await db.get(`rooms/${c}`)) as Sala | null;
  if (!r) { ui.msg = 'Sala não encontrada.'; ui.desenhar(); return; }
  if (!r.players?.[pid] && Object.keys(r.players || {}).length >= MAX_JOGADORES) { ui.msg = `Sala cheia (máx. ${MAX_JOGADORES}).`; ui.desenhar(); return; }
  code = c;
  await entrar(nome);
  observar(); ui.ir('sala');
}

/** Abre a sala da URL (?sala= ou ?tv=). Devolve false se não existe. */
export async function abrirDaUrl(): Promise<boolean> {
  db = await abrirSalas();
  const r = await db.get(`rooms/${code}`);
  if (!r) { ui.msg = 'Sala não encontrada.'; code = ''; history.replaceState(null, '', location.pathname); return false; }
  observar();
  return true;
}

async function sairDaSala() {
  const resto = players().filter((p) => p.id !== pid);
  const eraHost = isHost();
  const c = code;
  sairLocal(); // sai da tela já; o resto é limpeza
  if (!resto.length) await db.remove(`rooms/${c}`);
  else {
    const upd: Record<string, unknown> = { [`players/${pid}`]: null, [`in/${pid}`]: null };
    if (eraHost) upd.host = resto[0].id;
    await db.update(`rooms/${c}`, upd);
  }
}

// ---------- anfitrião: ciclo da partida ----------
function comecarRodada() {
  const ps = players();
  const ref = posicaoRef(ps.map((p) => p.pos));
  const q = proximaPergunta([...PERGUNTAS.values()], S!.used || {}, ref, casas(), S!.cur?.cat);
  if (!q) { // acabaram as perguntas do banco: nunca repete, então encerra com quem está na frente
    const ordem = classificar(ps.map((p) => ({ ...p, tt: p.tt || 0 })));
    const topo = ordem.filter((p) => p.pos === ordem[0].pos && p.tt === ordem[0].tt);
    return db.update(room(), { status: 'finished', exhausted: true, winners: topo.map((p) => p.id).join(',') });
  }
  const n = (S!.cur?.n || 0) + 1;
  return db.update(room(), {
    status: 'playing',
    cur: { n, phase: 'prep', cat: q.cat, tier: q.nivel, qid: q.id, order: embaralhar(5).join(','), ends: db.now() + PREP_MS / VELOCIDADE },
    [`used/${q.id}`]: true,
  });
}

async function revelar() {
  const c = cur()!, q = PERGUNTAS.get(c.qid!)!, ordem = c.order!.split(',').map(Number);
  const certa = ordem.indexOf(q.correta);
  const limite = TEMPO[c.tier!] * 1000 / VELOCIDADE;
  const upd: Record<string, unknown> = { 'cur/phase': 'reveal', 'cur/ends': db.now() + REVELA_MS / VELOCIDADE, 'cur/ans': certa };
  for (const p of players()) {
    const e: Entrada | Record<string, never> = S!.in?.[p.id]?.n === c.n ? S!.in![p.id] : {};
    const escolha = (e as Entrada).choice;
    const ok = typeof escolha === 'number' && escolha === certa;
    const r = aplicarResultado(p.pos, ok, casas());
    const ms = tempoGasto(c.start!, (e as Entrada).t, limite);
    upd[`players/${p.id}/pos`] = r.pos;
    upd[`players/${p.id}/tt`] = (p.tt || 0) + Math.round(ms * VELOCIDADE);
    if ((e as Entrada).h5 && !p.h5) upd[`players/${p.id}/h5`] = true;
    upd[`res/${p.id}`] = { ch: typeof escolha === 'number' ? escolha : -1, ok, d: r.delta, ms: Math.round(ms * VELOCIDADE) };
  }
  await db.update(room(), upd);
}

async function depoisDaRevelacao() {
  const ids = vencedores(players().map((p) => ({ ...p, tt: p.tt || 0 })), casas());
  if (!ids.length) return comecarRodada();
  const upd: Record<string, unknown> = { status: 'finished', winners: ids.join(',') };
  ids.forEach((id) => { upd[`players/${id}/wins`] = (S!.players![id].wins || 0) + 1; });
  await db.update(room(), upd);
}

async function novaPartida() {
  const upd: Record<string, unknown> = { status: 'playing', game: (S!.game || 1) + 1, winners: null, in: null, res: null, exhausted: null, cur: { n: S!.cur?.n || 0, cat: S!.cur?.cat || '' } };
  players().forEach((p) => { upd[`players/${p.id}/pos`] = 0; upd[`players/${p.id}/h5`] = false; upd[`players/${p.id}/tt`] = 0; });
  await db.update(room(), upd);
  await new Promise((r) => setTimeout(r, 50));
  await comecarRodada();
}

async function passoDoAnfitriao() {
  if (busy || !S || !isHost() || S.status !== 'playing' || !cur()?.phase) return;
  const c = cur()!, agora = db.now();
  const chave = `${S.game}:${c.n}:${c.phase}`;
  busy = true;
  try {
    if (c.phase === 'prep' && agora >= c.ends! && chave !== handled) {
      handled = chave;
      await db.update(room('cur'), { phase: 'question', ends: agora + TEMPO[c.tier!] * 1000 / VELOCIDADE, start: agora });
    } else if (c.phase === 'question') {
      const todos = players().every((p) => typeof S!.in?.[p.id]?.choice === 'number' && S!.in![p.id].n === c.n);
      if ((todos || agora >= c.ends!) && chave !== handled) { handled = chave; await revelar(); }
    } else if (c.phase === 'reveal' && agora >= c.ends! && chave !== handled) {
      handled = chave;
      await depoisDaRevelacao();
    }
  } finally { busy = false; }
}
setInterval(() => { if (code && db) void passoDoAnfitriao(); }, 300);

// ---------- ações da pessoa ----------
const gravarEntrada = (patch: Partial<Entrada>) => db.set(room(`in/${pid}`), { ...(minhaEntrada() || {}), ...patch, n: cur()!.n });

export async function acaoSala(act: string, el: HTMLElement): Promise<boolean> {
  if (act === 'copiar') { const i = document.querySelector<HTMLInputElement>('.linkrow input')!; i.select(); navigator.clipboard?.writeText(i.value).catch(() => {}); el.textContent = 'Copiado!'; }
  else if (act === 'entrar-aqui') { const n = nomeAtual(); if (!n) { ui.msg = 'Digite seu nome.'; ui.desenhar(); } else { atualizar((d) => { d.nome = n; }); ui.msg = ''; await entrar(n); } }
  else if (act === 'tamanho') await db.update(room(), { win: Number(el.dataset.v) });
  else if (act === 'iniciar') await comecarRodada();
  else if (act === 'ans') { if (minhaEntrada()?.choice === undefined) await gravarEntrada({ choice: Number(el.dataset.i), t: db.now() }); }
  else if (act === 'eliminar') await gravarEntrada({ h5: true });
  else if (act === 'nova') await novaPartida();
  else if (act === 'sair') { confirmando = true; ui.desenhar(); }
  else if (act === 'ficar') { confirmando = false; ui.desenhar(); }
  else if (act === 'sair-sim') await sairDaSala();
  else return false;
  return true;
}

// ---------- telas ----------
const pinos = () => players().map((p) => ({ cor: p.color, nome: p.name, pos: p.pos, eu: p.id === pid }));
const respondidos = () => players().filter((p) => S!.in?.[p.id]?.n === cur()!.n && typeof S!.in![p.id].choice === 'number').length;
const seg = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';

function barra(centro: string) {
  return `<div class="bar"><button class="ib" data-act="sair" aria-label="Sair da sala">${SAIR_ICONE}</button><div class="streak"><small>Sala ${code}</small><b>${centro}</b></div></div>`;
}

function confirmarSair() {
  return confirmando ? `<div class="ov"><div class="ovc"><h3>Sair da sala?</h3><p>${isHost() && players().length > 1 ? 'Outra pessoa vira o anfitrião.' : 'Você pode voltar com o código da sala.'}</p><button class="cta big" data-act="ficar"><span>Ficar na sala</span></button><button class="cta" data-act="sair-sim"><span>Sair da sala</span></button></div></div>` : '';
}

function opcoes() {
  const c = cur()!, q = PERGUNTAS.get(c.qid!);
  if (!q) return null;
  const ordem = c.order!.split(',').map(Number), mine = minhaEntrada();
  const fora = mine?.h5 && !isTV ? eliminar2(`${q.id}:${pid}`, ordem.indexOf(q.correta)) : [];
  const opts = ordem.map((oi, i) => {
    let cls = 'opt';
    if (fora.includes(i)) cls += ' gone';
    if (mine?.choice === i) cls += ' chosen';
    const dis = isTV || mine?.choice !== undefined || fora.includes(i);
    return `<button class="${cls}" data-act="ans" data-i="${i}" ${dis ? 'disabled' : ''}><span class="lt">${LETRAS[i]}</span><span class="ot">${esc(q.alternativas[oi])}</span></button>`;
  }).join('');
  return { q, opts };
}

function perguntaHTML() {
  const c = cur()!, p = me(), mine = minhaEntrada();
  const b = opcoes();
  if (!b) return '<main class="inicio"><p class="dica">Carregando pergunta…</p></main>';
  const pode = p && !p.h5 && !mine?.h5 && mine?.choice === undefined;
  const usado = p && (p.h5 || mine?.h5);
  const ajuda = isTV ? '' : `<div class="ajudas"><button data-act="eliminar" ${pode ? '' : 'disabled'}><b>${usado ? 0 : 1}</b><span>Eliminar 2<small>tira 2 erradas (1 por partida)</small></span></button></div>`;
  return `<main class="qscr"><div class="qleft">${barra(`${respondidos()}/${players().length}`)}
  ${pistaHTML(casas(), pinos())}
  <div class="meta">${cronometroHTML()}<div class="mi"><span class="tier t-${c.tier}">● ${NIVEL_NOME[c.tier!]}</span><span class="cat">${esc(CATEGORIAS[c.cat!])}</span></div></div>
  <h2 class="q">${esc(b.q.pergunta)}</h2></div><div class="opts">${isTV ? '' : b.opts}</div>${ajuda}${confirmarSair()}</main>`;
}

function revelaHTML() {
  const c = cur()!, q = PERGUNTAS.get(c.qid!), r = S!.res?.[pid];
  if (!q) return '';
  const ordem = c.order!.split(',').map(Number);
  const cartao = (i: number, cls: string) => `<div class="opt ${cls}"><span class="lt">${LETRAS[i]}</span><span class="ot">${esc(q.alternativas[ordem[i]])}</span></div>`;
  const veredito = !r ? '' : r.ok
    ? `<div class="verdict ok"><div><b>Resposta certa</b><span>Você avançou 1 casa · ${seg(r.ms)}</span></div></div>`
    : `<div class="verdict bad"><div><b>${r.ch < 0 ? 'Tempo esgotado' : 'Resposta errada'}</b><span>Você não avançou.</span></div></div>`;
  const linhas = players().map((p) => ({ p, x: S!.res?.[p.id] })).filter((l) => l.x).sort((a, b) => b.x!.d - a.x!.d || a.x!.ms - b.x!.ms);
  const lista = `<ul class="moves">${linhas.map(({ p, x }) => `<li>${fichaHTML(p.color, p.name)}<span>${esc(p.name)}${p.id === pid ? ' <em>você</em>' : ''}</span><small>${x!.ch < 0 ? '—' : seg(x!.ms)}</small><b class="${x!.d > 0 ? 'up' : 'flat'}">${x!.d > 0 ? '+' + x!.d : x!.ch < 0 ? 'sem resposta' : 'errou'}</b></li>`).join('')}</ul>`;
  const errada = r && !r.ok && r.ch >= 0 ? `<div class="ans"><small>Você marcou</small>${cartao(r.ch, 'wrong')}</div>` : '';
  return `<main class="revela">${barra(`${respondidos()}/${players().length}`)}${pistaHTML(casas(), pinos())}${isTV ? '' : veredito}
  <div class="ans"><small>Resposta certa</small>${cartao(c.ans!, 'right')}</div>${isTV ? '' : errada}${lista}
  <div class="next"><small>Próxima pergunta já já</small><i id="nx"></i></div>${confirmarSair()}</main>`;
}

function prepHTML() {
  const c = cur()!;
  return `<main class="prep">${barra(`${c.n}`)}${pistaHTML(casas(), pinos())}
  <div class="rev"><div class="lbl c">Rodada ${c.n}</div><div class="catgr">${esc(CATEGORIAS[c.cat!])}</div><span class="tier t-${c.tier}">● ${NIVEL_NOME[c.tier!]}</span></div>
  ${cronometroHTML()}${confirmarSair()}</main>`;
}

function lobbyHTML() {
  const ps = players(), link = `${location.origin}${location.pathname}?sala=${code}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&color=e8ecf1&bgcolor=0a0c10&data=${encodeURIComponent(link)}`;
  const dentro = !!me();
  const tam = isHost() ? `<div class="tamanho"><small>Tamanho da partida</small><div>${Object.entries(TAMANHOS).map(([nome, n]) => `<button class="${casas() === n ? 'on' : ''}" data-act="tamanho" data-v="${n}"><b>${n}</b>${nome}</button>`).join('')}</div></div>` : `<p class="dica">Partida de <b>${casas()}</b> casas</p>`;
  return `<main class="lobby"><div class="bar"><button class="ib" data-act="sair" aria-label="Sair da sala">${SAIR_ICONE}</button><div class="streak"><small>Código da sala</small><b class="cod">${code}</b></div></div>
  ${ui.msg ? `<p class="err">${esc(ui.msg)}</p>` : ''}
  ${isTV ? `<img class="qr" src="${qr}" alt="QR code da sala">` : ''}
  <div class="linkrow"><input readonly value="${esc(link)}"><button class="cta sm" data-act="copiar">Copiar link</button></div>
  <h3 class="sec">Jogadores <span>${ps.length}/${MAX_JOGADORES}</span></h3>
  <ul class="moves">${ps.map((p) => `<li>${fichaHTML(p.color, p.name)}<span>${esc(p.name)}${p.id === S!.host ? ' <em>anfitrião</em>' : ''}${p.id === pid ? ' <em>você</em>' : ''}</span>${p.wins ? `<b>${p.wins} vitória${p.wins > 1 ? 's' : ''}</b>` : ''}</li>`).join('')}</ul>
  ${!isTV && dentro ? tam : ''}
  ${!isTV && dentro && isHost() ? '<button class="cta big" data-act="iniciar"><span>Iniciar jogo</span></button>' : ''}
  ${!isTV && dentro && !isHost() ? '<p class="dica">Aguardando o anfitrião iniciar…</p>' : ''}
  ${!isTV && !dentro ? `<label class="lbl" for="nome">Seu nome</label><input id="nome" maxlength="14" placeholder="Como quer ser chamado?" value="${esc(nomeAtual())}"><button class="cta big" data-act="entrar-aqui"><span>Entrar na sala</span></button>` : ''}
  ${!isTV && dentro && isHost() ? `<a class="cta" href="?tv=${code}" target="_blank"><span>Abrir tabuleiro em outra tela</span></a>` : ''}${confirmarSair()}</main>`;
}

function fimHTML() {
  const ids = (S!.winners || '').split(',').filter(Boolean), ps = players();
  const venc = ids.map((id) => S!.players![id]).filter(Boolean);
  const ordem = classificar(ps.map((p) => ({ ...p, tt: p.tt || 0 })));
  const desempate = !S!.exhausted && ordem.filter((p) => p.pos >= casas()).length > 1 && ids.length === 1 ? '<p class="dica">Chegaram juntos: venceu quem somou menos tempo de resposta.</p>' : '';
  return `<main class="fimsala"><div class="lbl c">${venc.length > 1 ? 'Empate' : 'Vencedor'}</div><h2 class="winner">${venc.map((x) => esc(x.name)).join(' e ')}</h2>
  ${S!.exhausted ? '<p class="dica">As perguntas desta sala acabaram. Para jogar mais, crie uma sala nova.</p>' : ''}${desempate}
  ${pistaHTML(casas(), pinos(), false)}
  <ul class="moves rank">${ordem.map((p, i) => `<li><b class="pl">${i + 1}º</b>${fichaHTML(p.color, p.name)}<span>${esc(p.name)}${p.id === pid ? ' <em>você</em>' : ''}</span><small>${tempoTexto(p.tt)}</small><b>${p.pos}/${casas()}</b></li>`).join('')}</ul>
  <p class="dica peq">A coluna do meio é a soma dos tempos de resposta (desempate).</p>
  ${!isTV && isHost() && !S!.exhausted ? '<button class="cta big" data-act="nova"><span>Nova partida</span></button>' : (!isTV ? '<p class="dica">Aguardando o anfitrião iniciar outra partida…</p>' : '')}
  ${!isTV ? '<button class="cta" data-act="sair"><span>Sair da sala</span></button>' : ''}${confirmarSair()}</main>`;
}

function tabuleiroHTML() {
  const ps = players(), n = casas() + 1, ordem: number[] = [];
  const linhas = Math.ceil(n / 7);
  for (let r = 0; r < linhas; r++) { const row = [0, 1, 2, 3, 4, 5, 6].map((k) => r * 7 + k).filter((i) => i < n); if (r % 2) row.reverse(); ordem.push(...row); }
  const zona = (i: number) => (i / casas() <= 0.325 ? 'z1' : i / casas() <= 0.675 ? 'z2' : 'z3');
  return `<div class="board" style="--cols:7">${ordem.map((i) => `<div class="bcell ${zona(i)}"><span class="cn">${i === 0 ? 'início' : i === casas() ? 'chegada' : i}</span><div class="tokens">${ps.filter((p) => Math.min(p.pos, casas()) === i).map((p) => fichaHTML(p.color, p.name, 'big')).join('')}</div></div>`).join('')}</div>`;
}

function tvHTML() {
  const c = cur();
  let lado = '';
  if (S!.status === 'finished') lado = fimHTML();
  else if (c?.phase === 'prep') lado = prepHTML();
  else if (c?.phase === 'question') lado = perguntaHTML();
  else if (c?.phase === 'reveal') lado = revelaHTML();
  return `<div class="tv"><div class="tvhead">Sala <b>${code}</b><span class="sep">·</span>Partida ${S!.game || 1}</div>${tabuleiroHTML()}<div class="tvside">${lado}</div></div>`;
}

export function salaHTML(): string {
  if (!S) return '<main class="inicio"><p class="dica">Entrando na sala…</p></main>';
  contarVitoria();
  if (S.status === 'playing' && !cur()?.phase) return '<main class="inicio"><p class="dica">Preparando a próxima rodada…</p></main>';
  if (isTV && S.status !== 'lobby') return tvHTML();
  if (S.status === 'lobby') return lobbyHTML();
  if (S.status === 'finished') return fimHTML();
  if (!me() && !isTV) return lobbyHTML();
  return { prep: prepHTML, question: perguntaHTML, reveal: revelaHTML }[cur()!.phase!]();
}

/** Minha vitória entra uma vez só no recorde da conta (por sala e partida). */
function contarVitoria() {
  if (isTV || S?.status !== 'finished') return;
  const chave = `${code}:${S.game}`;
  if (contadaKey === chave) return;
  contadaKey = chave;
  if ((S.winners || '').split(',').includes(pid)) atualizar((d) => { d.vitorias++; });
}

function tique() {
  const c = cur();
  if (!c || !S || ui.tela !== 'sala') return;
  const total = (c.phase === 'prep' ? PREP_MS : c.phase === 'question' ? TEMPO[c.tier!] * 1000 : REVELA_MS) / VELOCIDADE;
  const resta = Math.max(0, (c.ends || 0) - db.now());
  atualizarCronometro(resta, total);
  const nx = document.getElementById('nx');
  if (nx) nx.style.width = `${(100 * resta) / total}%`;
}
setInterval(() => { if (code && db) tique(); }, 200);
