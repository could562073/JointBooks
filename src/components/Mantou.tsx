import styles from './Mantou.module.css';

export type MantouVariant = 'full' | 'tab' | 'empty';

const PALETTE = {
  full:  { body: '#B7A6E5', hi: '#CDC0F0', eye: '#3B3229', foot: '#9484CE' },
  tab:   { body: '#B7A6E5', hi: '#CDC0F0', eye: '#3B3229', foot: '#9484CE' },
  empty: { body: '#DEDCE6', hi: '#CDCBD6', eye: '#8D89A1', foot: '#CDCBD6' },
} as const;

// 寬 > 高：高度是寬度的 0.82
const ASPECT = 0.82;

type Props = {
  variant: MantouVariant;
  width: number;
  breathing?: boolean;
  className?: string;
  /** 轉發給根元素，供 e2e 定位 */
  'data-testid'?: string;
};

export function Mantou({
  variant, width, breathing = false, className, 'data-testid': testId,
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

        {variant !== 'tab' && (
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

        {variant === 'full' && (
          <>
            <span data-part="blush" className={styles.blush} style={{ left: '8%' }} />
            <span data-part="blush" className={styles.blush} style={{ right: '8%' }} />
          </>
        )}
      </span>

      {variant === 'full' && (
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
