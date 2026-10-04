import type { Battle } from './types';
/** Fully serializable Mulberry32; AI and renderer never consume this stream. */
export function d6(s: Battle): number {
  if (s.forcedDice.length) return Math.min(6, Math.max(1, s.forcedDice.shift()!));
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return 1 + Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * 6);
}
export function roll(s: Battle): [number,number] { return [d6(s),d6(s)]; }
export const succeeds = (sum: number, modifier: number, tn = 7) => sum !== 2 && (sum === 12 || sum + modifier >= tn);
export function probability(modifier: number, tn = 7): number {
  let hits = 0; for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) if(succeeds(a+b,modifier,tn)) hits++;
  return hits / 36;
}
export function criticalProbability(modifier: number, precision: boolean): number {
  let n=0; for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) if(a+b >= (precision?11:12) && succeeds(a+b,modifier)) n++;
  return n/36;
}
