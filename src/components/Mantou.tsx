import styles from './Mantou.module.css';

export type MantouVariant = 'full' | 'tab' | 'partner' | 'muted' | 'empty';

// 只能用 tokens.css 的變數，不可用色碼字面量（Plan 01 Task 2）。
const PALETTE = {
  full:  { body: 'var(--c-primary)', hi: 'var(--c-hi)', eye: 'var(--c-face)', foot: 'var(--c-shade)' },
  tab:   { body: 'var(--c-primary)', hi: 'var(--c-hi)', eye: 'var(--c-face)', foot: 'var(--c-shade)' },
  // 老婆那顆：原型外殼左上的頭像對是紫＋粉各一顆
  partner: { body: 'var(--c-partner)', hi: 'var(--c-partner-hi)', eye: 'var(--c-face)', foot: 'var(--c-partner-shade)' },
  // 分頁列未選中的那兩顆：原型是灰的，選中才轉紫
  muted: { body: 'var(--c-muted-body)', hi: 'var(--c-muted-hi)', eye: 'var(--c-muted-eye)', foot: 'var(--c-muted-hi)' },
  empty: { body: 'var(--c-muted-body)', hi: 'var(--c-muted-hi)', eye: 'var(--c-muted-eye)', foot: 'var(--c-muted-hi)' },
} as const;

// 寬 > 高：高度是寬度的 0.82
const ASPECT = 0.82;

type Props = {
  variant: MantouVariant;
  width: number;
  breathing?: boolean;
  /**
   * 沿著饅頭輪廓描一圈底色，用在頭像疊在一起的時候把兩顆分開。
   * 一定要掛在本體（有 blob 圓角）而不是外框——外框是矩形，box-shadow 會
   * 在饅頭身上切出一條直線。
   */
  ring?: boolean;
  /**
   * 只畫本體、高光與兩隻眼睛——原型外殼左上的頭像對就是這個簡化版，
   * 沒有嘴、腮紅與腳。30px 大小下那三樣只會糊成雜點。
   */
  minimal?: boolean;
  className?: string;
  /** 轉發給根元素，供 e2e 定位 */
  'data-testid'?: string;
};

export function Mantou({
  variant, width, breathing = false, ring = false, minimal = false,
  className, 'data-testid': testId,
}: Props) {
  const c = PALETTE[variant];
  const h = Math.round(width * ASPECT);
  const eye = Math.max(2, Math.round(width * 0.1));

  return (
    <span
      data-testid={testId}
      className={[styles.root, breathing ? styles.breathing : '', className]
        .filter(Boolean).join(' ')}
      style={{ width: `${width}px`, height: `${h}px` }}
      aria-hidden="true"
    >
      <span
        data-part="body"
        className={styles.body}
        style={{
          width: `${width}px`,
          height: `${h}px`,
          background: c.body,
          borderRadius: '50% 50% 34% 34% / 64% 64% 36% 36%',
          ...(ring ? { boxShadow: '0 0 0 2.5px var(--c-bg)' } : {}),
        }}
      >
        <span
          data-part="hi"
          className={styles.hi}
          style={{ width: '46%', background: c.hi }}
        />
        <span data-part="eye" className={styles.eye}
              style={{ width: eye, height: eye * 1.25, background: c.eye, left: '32%' }} />
        <span data-part="eye" className={styles.eye}
              style={{ width: eye, height: eye * 1.25, background: c.eye, right: '32%' }} />

        {variant !== 'tab' && !minimal && (
          <span
            data-part="mouth"
            data-dir={variant === 'empty' ? 'up' : 'down'}
            className={styles.mouth}
            style={{
              width: `${width * 0.16}px`,
              height: `${width * 0.09}px`,
              borderColor: c.eye,
              // 空狀態的嘴是向上弧線
              borderRadius: variant === 'empty'
                ? '100% 100% 0 0 / 100% 100% 0 0'
                : '0 0 100% 100% / 0 0 100% 100%',
              borderWidth: variant === 'empty' ? '1.5px 1.5px 0 1.5px' : '0 1.5px 1.5px 1.5px',
            }}
          />
        )}

        {variant === 'full' && !minimal && (
          <>
            <span data-part="blush" className={styles.blush} style={{ left: '8%' }} />
            <span data-part="blush" className={styles.blush} style={{ right: '8%' }} />
          </>
        )}
      </span>

      {variant === 'full' && !minimal && (
        <>
          <span data-part="foot" className={styles.foot}
                style={{ background: c.foot, left: '20%' }} />
          <span data-part="foot" className={styles.foot}
                style={{ background: c.foot, right: '20%' }} />
        </>
      )}
    </span>
  );
}
