import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './motion';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mql = matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return prefersReducedMotion();
}

/**
 * §10 通則的反應式版本。
 * motion.ts 的 prefersReducedMotion() 每次呼叫都重查，但沒有人訂閱變更——
 * 在 render 期間算時長的元件不會在使用者中途改設定時重新 render。這層補上訂閱。
 * 伺服器端沒有 matchMedia，getServerSnapshot 一律回 false。
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
