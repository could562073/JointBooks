import { useEffect, useRef, type RefObject } from 'react';
import styles from './ScrollThumb.module.css';

/** 停止捲動後多久收起 */
export const THUMB_HIDE_MS = 700;
const MIN_SIZE = 28;
const INSET = 6;

/** 主要分頁底部被浮動分頁列蓋住的高度：捲動條不伸進去 */
export const TAB_BAR_INSET = 96;

export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number };

/**
 * 捲動指示條的長度與位置（相對於捲動區頂端，px）。內容沒有超出就是 null。
 * bottomInset：底部被浮動分頁列蓋住的高度，軌道不伸進去。
 */
export function thumbGeometry(
  m: ScrollMetrics,
  bottomInset = INSET
): { size: number; offset: number } | null {
  const range = m.scrollHeight - m.clientHeight;
  if (range <= 1) return null;
  const track = m.clientHeight - INSET - bottomInset;
  if (track <= MIN_SIZE) return null;
  const size = Math.max(MIN_SIZE, Math.round((track * m.clientHeight) / m.scrollHeight));
  const ratio = Math.min(1, Math.max(0, m.scrollTop / range));
  return { size, offset: INSET + Math.round((track - size) * ratio) };
}

type Props = {
  /** 要跟著的捲動區 */
  target: RefObject<HTMLElement | null>;
  bottomInset?: number;
};

/**
 * 只在捲動時出現的細捲動條（使用者要求；原型把原生捲動條整個藏起來）。
 *
 * 原生捲動條在桌機上一直顯示、還會吃掉內容寬度，所以藏掉原生的、另外畫一條浮在
 * 內容上的。位置直接改 DOM：每一格捲動都走 React 重繪的話，統計頁的圖表會跟著重算。
 *
 * 要放在捲動區的兄弟位置，兩者共用同一個定位祖先（外殼的 .page），才能用捲動區的
 * offsetTop 對齊。
 */
export function ScrollThumb({ target, bottomInset }: Props) {
  const thumb = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = target.current;
    const t = thumb.current;
    if (!el || !t) return;
    let frame = 0;
    let hide: ReturnType<typeof setTimeout> | undefined;

    const paint = () => {
      frame = 0;
      const g = thumbGeometry(el, bottomInset);
      if (!g) { t.removeAttribute('data-visible'); return; }
      t.style.height = `${g.size}px`;
      t.style.transform = `translate3d(0, ${el.offsetTop + g.offset}px, 0)`;
      t.setAttribute('data-visible', '');
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
      clearTimeout(hide);
      hide = setTimeout(() => t.removeAttribute('data-visible'), THUMB_HIDE_MS);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(hide);
    };
  }, [target, bottomInset]);

  return <span ref={thumb} className={styles.thumb} aria-hidden="true" data-testid="scroll-thumb" />;
}
