/** Peças compartilhadas pelas telas: texto seguro, banco de perguntas, cronômetro, pista da corrida. */
import type { Pergunta } from '../motor/motor.ts';

export type Tela = 'inicio' | 'conta' | 'solo' | 'sala';

/** Ponte entre as telas (cada uma só conhece isto, não as outras). */
export const ui = {
  tela: 'inicio' as Tela,
  msg: '',
  desenhar: () => {},
  ir: (_t: Tela) => {},
};

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const $app = document.getElementById('app')!;
export const params = new URLSearchParams(location.search);
/** Só para testes: acelera os tempos (?speed=10). */
export const VELOCIDADE = Number(params.get('speed')) || 1;

export let PERGUNTAS = new Map<number, Pergunta>();
export async function carregarPerguntas() {
  if (PERGUNTAS.size) return;
  const r = await fetch(`${import.meta.env.BASE_URL}questions.json`);
  PERGUNTAS = new Map((await r.json() as Pergunta[]).map((q) => [q.id, q]));
}

export const LETRAS = 'ABCDE';
export const tempoTexto = (ms: number) => {
  const s = Math.round(ms / 1000), m = Math.floor(s / 60);
  return m ? `${m}min ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

/** Cronômetro em blocos (20). Atualizado por `atualizarCronometro` sem redesenhar a tela. */
export const cronometroHTML = () => `<div class="tm"><span class="tn" id="tn">–</span><div class="seg" id="seg">${'<b></b>'.repeat(20)}</div></div>`;
export function atualizarCronometro(restanteMs: number, totalMs: number) {
  const tn = document.getElementById('tn'), seg = document.getElementById('seg');
  if (!tn) return;
  const s = Math.ceil(restanteMs / 1000 * VELOCIDADE);
  tn.textContent = String(s);
  tn.classList.toggle('low', s <= 5 && totalMs > 5000);
  const ligados = Math.ceil((restanteMs / totalMs) * 20);
  seg?.querySelectorAll('b').forEach((b, i) => b.classList.toggle('on', i < ligados));
}

export const inicial = (nome: string) => esc((nome[0] || '?').toUpperCase());
export const fichaHTML = (cor: string, nome: string, cls = '') => `<i class="dot ${cls}" style="--c:${cor}">${inicial(nome)}</i>`;

export interface Pino { cor: string; nome: string; pos: number; eu?: boolean }
/**
 * Pista: faixas Médio / Difícil / QI e as fichas. Fichas na mesma casa abrem em leque (máx. 6 por linha).
 */
export function pistaHTML(casas: number, pinos: Pino[], rotulo = true) {
  const ROW = 24, PASSO = 20, POR_LINHA = 6;
  const grupos = new Map<number, Pino[]>();
  pinos.forEach((p) => { const k = Math.min(p.pos, casas); grupos.set(k, [...(grupos.get(k) ?? []), p]); });
  const linhas = Math.max(1, ...[...grupos.values()].map((g) => Math.ceil(g.length / POR_LINHA)));
  const fichas = [...grupos.entries()].flatMap(([pos, g]) => g.map((p, k) => {
    const lin = Math.floor(k / POR_LINHA), nLin = Math.min(POR_LINHA, g.length - lin * POR_LINHA), col = k % POR_LINHA;
    const desvio = pos === 0 ? col * PASSO : pos === casas ? -(nLin - 1 - col) * PASSO : (col - (nLin - 1) / 2) * PASSO;
    return `<i class="dot rd${p.eu ? ' eu' : ''}" style="--c:${p.cor};left:calc(${(pos / casas) * 100}% + ${desvio}px);bottom:${lin * ROW}px;z-index:${p.eu ? 99 : k}" title="${esc(p.nome)}">${inicial(p.nome)}</i>`;
  })).join('');
  const lider = Math.max(0, ...pinos.map((p) => p.pos));
  return `<div class="pista"><div class="lane" style="height:${linhas * ROW}px">${fichas}</div>
  <div class="rail"><div class="rz"><i class="z1"></i><i class="z2"></i><i class="z3"></i></div><i class="fill" style="width:${(lider / casas) * 100}%"></i><em class="fl"></em></div>
  ${rotulo ? '<div class="rl"><span>Médio</span><span>Difícil</span><span>QI</span></div>' : ''}</div>`;
}

export const ICONE_PAUSA = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/></svg>';
