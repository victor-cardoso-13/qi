/** Lógica pura do jogo (sem tela, sem rede). Testável sem navegador. */
import {
  NIVEIS, SOLO_FAIXAS, SOLO_GANHA_A_CADA, TAMANHO_PADRAO, type Nivel,
} from './regras.ts';

export interface Pergunta {
  id: number;
  cat: string;
  nivel: Nivel;
  pergunta: string;
  alternativas: string[];
  correta: number;
}
export type Sorteio = () => number;

export function mediana(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Posição de referência da rodada: mediana (resiste a quem disparou) puxada um pouco pelo líder. */
export function posicaoRef(posicoes: number[]): number {
  if (!posicoes.length) return 0;
  return 0.7 * mediana(posicoes) + 0.3 * Math.max(...posicoes);
}

const sig = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Chance de cada nível para a posição de referência. As fronteiras (6,5 e 13,5) valem para 20 casas;
 * numa partida de outro tamanho a posição é esticada para a escala de 20.
 */
export function chancesNivel(ref: number, casas = TAMANHO_PADRAO) {
  const r = (ref * 20) / casas;
  const pDif = sig((r - 6.5) / 1.2);
  const pQi = sig((r - 13.5) / 1.2);
  let medio = 1 - pDif, dificil = pDif - pQi, qi = pQi;
  if (r <= 3) { medio += qi; qi = 0; } // começo: nunca QI
  if (r >= 17) { qi += medio; medio = 0; } // reta final: nunca Médio
  return { medio, dificil, qi };
}

export function sortearNivel(ref: number, casas: number, rnd: Sorteio = Math.random): Nivel {
  const p = chancesNivel(ref, casas);
  const r = rnd();
  if (r < p.medio) return 'medio';
  if (r < p.medio + p.dificil) return 'dificil';
  return 'qi';
}

/** Acertou: +1 casa. Errou: fica onde está. Nunca passa da chegada. */
export function aplicarResultado(pos: number, acertou: boolean, casas: number) {
  const np = acertou ? Math.min(casas, pos + 1) : pos;
  return { pos: np, delta: np - pos };
}

export interface Corredor { id: string; pos: number; tt: number; j: number }

/** Ordem da corrida: mais casas primeiro; empate → MENOR soma de tempos de resposta; depois ordem de entrada. */
export function classificar<T extends Corredor>(jogadores: T[]): T[] {
  return [...jogadores].sort((a, b) => b.pos - a.pos || a.tt - b.tt || a.j - b.j);
}

/**
 * Vencedores: quem chegou ao fim. Se mais de um chegou na mesma rodada, ganha quem tem a MENOR soma de
 * tempos de resposta (só empata de verdade se os tempos forem idênticos).
 */
export function vencedores(jogadores: Corredor[], casas: number): string[] {
  const chegou = jogadores.filter((p) => p.pos >= casas);
  if (!chegou.length) return [];
  const melhor = Math.min(...chegou.map((p) => p.tt));
  return chegou.filter((p) => p.tt === melhor).map((p) => p.id);
}

/** Quanto tempo (ms) vale uma resposta: o que levou, no máximo o limite; sem resposta = o limite inteiro. */
export function tempoGasto(inicio: number, resposta: number | undefined, limiteMs: number): number {
  if (typeof resposta !== 'number') return limiteMs;
  return Math.min(limiteMs, Math.max(0, resposta - inicio));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** "Eliminar 2": devolve 2 posições (na ordem mostrada) de alternativas ERRADAS para esconder. */
export function eliminar2(semente: string, certaMostrada: number): number[] {
  const erradas = [0, 1, 2, 3, 4].filter((i) => i !== certaMostrada);
  let h = hash(semente);
  const fora: number[] = [];
  for (let k = 0; k < 2; k++) {
    fora.push(erradas.splice(h % erradas.length, 1)[0]);
    h = Math.floor(h / 7) + 13;
  }
  return fora;
}

export function embaralhar(n: number, rnd: Sorteio = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const porProximidade = (nivel: Nivel) => [...NIVEIS].sort(
  (a, b) => Math.abs(NIVEIS.indexOf(a) - NIVEIS.indexOf(nivel)) - Math.abs(NIVEIS.indexOf(b) - NIVEIS.indexOf(nivel)),
);

/** Escolhe a categoria evitando repetir a da pergunta anterior e devolve uma pergunta dela. */
function escolherDe(livres: Pergunta[], ultimaCat: string | undefined, rnd: Sorteio): Pergunta {
  const cats = [...new Set(livres.map((q) => q.cat))];
  const outras = cats.filter((c) => c !== ultimaCat);
  const pool = outras.length ? outras : cats;
  const cat = pool[Math.floor(rnd() * pool.length)];
  const f = livres.filter((q) => q.cat === cat);
  return f[Math.floor(rnd() * f.length)];
}

/**
 * Sala: sorteia a próxima pergunta SEM repetir nenhuma já usada (`usadas`: id → true).
 * Se o nível sorteado acabou, usa o mais próximo. Devolve null só quando o banco inteiro foi usado.
 */
export function proximaPergunta(
  banco: Pergunta[], usadas: Record<string, boolean>, ref: number, casas: number, ultimaCat?: string, rnd: Sorteio = Math.random,
): Pergunta | null {
  const nivel = sortearNivel(ref, casas, rnd);
  for (const n of porProximidade(nivel)) {
    const livres = banco.filter((q) => q.nivel === n && !usadas[q.id]);
    if (livres.length) return escolherDe(livres, ultimaCat, rnd);
  }
  return null;
}

/** ---------- Solo ---------- */
/** Nível da PRÓXIMA pergunta, pela sequência (acertos até agora). */
export function nivelSolo(sequencia: number): Nivel {
  return sequencia >= SOLO_FAIXAS.qi ? 'qi' : sequencia >= SOLO_FAIXAS.dificil ? 'dificil' : 'medio';
}

/**
 * Solo: pergunta do nível da sequência. Nunca repete uma desta partida (`destaPartida`);
 * prefere as que este jogador/aparelho ainda não viu (`vistas`), para o começo não ficar decorado.
 */
export function perguntaSolo(
  banco: Pergunta[], sequencia: number, destaPartida: Set<number>, vistas: Set<number>, ultimaCat?: string, rnd: Sorteio = Math.random,
): Pergunta | null {
  for (const n of porProximidade(nivelSolo(sequencia))) {
    const doNivel = banco.filter((q) => q.nivel === n && !destaPartida.has(q.id));
    const novas = doNivel.filter((q) => !vistas.has(q.id));
    const lista = novas.length ? novas : doNivel;
    if (lista.length) return escolherDe(lista, ultimaCat, rnd);
  }
  return null;
}

/** Ajuda ganha ao completar 10, 20, 30… acertos: sorteia Pular ou Eliminar 2. Fora disso, nada. */
export function ajudaGanha(sequencia: number, rnd: Sorteio = Math.random): 'pular' | 'eliminar' | null {
  if (sequencia <= 0 || sequencia % SOLO_GANHA_A_CADA !== 0) return null;
  return rnd() < 0.5 ? 'pular' : 'eliminar';
}
