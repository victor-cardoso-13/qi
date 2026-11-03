/**
 * Tabuleiros da TV (só desenho; o estado vem da sala). Três estilos, escolhidos no Cockpit do anfitrião:
 *  - escada (padrão): degraus cada vez mais altos, fichas em pé no piso, troféu no topo.
 *  - pista: uma raia por jogador, a ficha corre até a linha quadriculada.
 *  - torre: um andar por casa, do térreo ao troféu.
 */
import { esc, fichaHTML } from './comum.ts';

export type Estilo = 'escada' | 'pista' | 'torre';
export const ESTILOS: { id: Estilo; nome: string; dica: string }[] = [
  { id: 'escada', nome: 'Escada', dica: 'degraus' },
  { id: 'pista', nome: 'Pista', dica: 'raias' },
  { id: 'torre', nome: 'Torre', dica: 'andares' },
];
export const estiloValido = (e: unknown): Estilo => (ESTILOS.some((x) => x.id === e) ? (e as Estilo) : 'escada');
/** Escada e pista usam a tela toda em largura (pergunta embaixo); a torre fica à esquerda com a pergunta ao lado. */
export const estiloLargo = (e: Estilo) => e !== 'torre';

export interface Peao { id: string; name: string; color: string; pos: number; j: number }

type Zona = 'zm' | 'zd' | 'zq';
const zona = (i: number, total: number): Zona => (i === 0 ? 'zm' : i / total <= 0.325 ? 'zm' : i / total <= 0.675 ? 'zd' : 'zq');
const faixa = (z: Zona, total: number) => {
  const xs = Array.from({ length: total }, (_, k) => k + 1).filter((i) => zona(i, total) === z);
  return xs.length ? `${xs[0]}–${xs[xs.length - 1]}` : '';
};
const legenda = (total: number) =>
  `<div class="tleg"><span class="zm">Médio <b>${faixa('zm', total)}</b></span><span class="zd">Difícil <b>${faixa('zd', total)}</b></span><span class="zq">QI <b>${faixa('zq', total)}</b></span></div>`;
const fichas = (ps: Peao[]) => ps.map((p) => fichaHTML(p.color, p.name)).join('');

function escada(ps: Peao[], total: number, lider: number) {
  const n = total + 1;
  const degraus = Array.from({ length: n }, (_, i) => {
    const aqui = ps.filter((p) => Math.min(p.pos, total) === i);
    const h = 14 + (i / total) * 74; // % da altura do tabuleiro
    const rot = i === 0 ? 'Início' : i === total ? '' : String(i);
    const cls = `deg ${zona(i, total)}${i <= lider ? ' sub' : ''}${i === lider && i > 0 ? ' lid' : ''}${i === 0 ? ' ini' : ''}`;
    return `<div class="${cls}" style="height:${h.toFixed(1)}%"><span class="rt">${rot}</span>${i === total ? '<span class="tro">🏆</span>' : ''}<div class="fs">${fichas(aqui)}</div></div>`;
  }).join('');
  return `<section class="tab esc" style="--n:${n}">${legenda(total)}<div class="degraus">${degraus}</div></section>`;
}

function pista(ps: Peao[], total: number, lider: number) {
  const n = total + 1;
  const celulas = Array.from({ length: n }, (_, i) => `<i class="${zona(i, total)}"></i>`).join('');
  const regua = `<div class="regua">${Array.from({ length: n }, (_, i) => `<i class="${zona(i, total)}">${i === 0 ? '' : i}</i>`).join('')}</div>`;
  const raias = ps.map((p) => {
    const pos = Math.min(p.pos, total), pc = ((pos + 0.5) / n) * 100;
    return `<div class="raia${pos === lider && pos > 0 ? ' lid' : ''}"><div class="rot">${fichaHTML(p.color, p.name)}<span>${esc(p.name)}</span></div>
    <div class="trilha">${celulas}<span class="rastro" style="width:${pc}%;--cor:${esc(p.color)}"></span><i class="dot ficha" style="--c:${esc(p.color)};left:${pc}%">${esc((p.name[0] || '?').toUpperCase())}</i></div><div class="chg">🏁</div></div>`;
  }).join('');
  return `<section class="tab pis" style="--n:${n};--r:${Math.max(ps.length, 1)}">${legenda(total)}${regua}<div class="raias">${raias}</div></section>`;
}

function torre(ps: Peao[], total: number, lider: number) {
  const andares = Array.from({ length: total + 1 }, (_, i) => {
    const aqui = ps.filter((p) => Math.min(p.pos, total) === i);
    const marca = i === 1 ? 'Médio' : i === Math.floor(total * 0.325) + 1 ? 'Difícil' : i === Math.floor(total * 0.675) + 1 ? 'QI' : '';
    const rot = i === 0 ? 'Térreo' : i === total ? '🏆 Chegada' : String(i);
    const cls = `andar ${zona(i, total)}${i <= lider ? ' sub' : ''}${i === lider && i > 0 ? ' lid' : ''}${i === total ? ' topo' : ''}`;
    return `<div class="${cls}"><span class="n">${rot}</span>${marca ? `<em>${marca}</em>` : ''}<div class="fs">${fichas(aqui)}</div></div>`;
  }).join('');
  return `<section class="tab tor">${legenda(total)}<div class="andares">${andares}</div></section>`;
}

export function tabuleiroHTML(estilo: Estilo, ps: Peao[], total: number): string {
  const lider = Math.max(0, ...ps.map((p) => Math.min(p.pos, total)));
  return estilo === 'pista' ? pista(ps, total, lider) : estilo === 'torre' ? torre(ps, total, lider) : escada(ps, total, lider);
}
