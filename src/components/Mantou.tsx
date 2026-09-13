import type { CSSProperties } from 'react';
import type { MantouColor } from '../domain/mantouColors';
import styles from './Mantou.module.css';

export type MantouVariant = 'full' | 'tab' | 'partner' | 'muted' | 'empty';

// 只能用 tokens.css 的變數，不可用色碼字面量（Plan 01 Task 2）。
const PALETTE = {
  full:  { body: 'var(--c-primary)', hi: 'var(--c-hi)', eye: 'var(--c-face)', foot: 'var(--c-shade)' },
  tab:   { body: 'var(--c-primary)', hi: 'var(--c-hi)', eye: 'var(--c-face)', foot: 'var(--c-shade)' },
  // 老婆那顆：原型外殼左上的頭像對是紫＋粉各一顆
  partner: { body: 'var(--c-partner)', hi: 'var(--c-partner-hi)', eye: 'var(--c-face)', foot: 'var(--c-partner-shade)' },
  // 分頁列未選中的那兩顆：原型是疊在分頁列底色上的半透明暖灰，不是空狀態的冷灰
  muted: { body: 'var(--c-tab-idle-body)', hi: 'var(--c-tab-idle-hi)', eye: 'var(--c-tab-idle-eye)', foot: 'var(--c-tab-idle-body)' },
  // 空狀態（原型「這天還沒有紀錄」）
  empty: { body: 'var(--c-muted-body)', hi: 'var(--c-muted-gloss)', eye: 'var(--c-muted-eye)', foot: 'var(--c-muted-hi)' },
} as const;

/** 高度÷寬度。完整饅頭：原型 104×84、78×62、38×30、58×46；頭像與頁籤：30×25、36×30、44×37、22×18 */
const ASPECT = 0.8;
const ASPECT_SIMPLE = 0.835;

/** 這個寬度以上才畫腮紅與底部內陰影：原型 78、104 的有，38、58 的沒有 */
const BIG = 60;

const BODY_RADIUS = '50% 50% 34% 34% / 64% 64% 36% 36%';
/** 頁籤饅頭的下緣圓角小一點（原型 32%） */
const ICON_RADIUS = '50% 50% 32% 32% / 64% 64% 36% 36%';

/*
 * 五官位置照原型量出來的比例：top／height 是本體高度的百分比，left／width 是本體寬度的
 * 百分比，眼睛寬度是本體寬度的倍數。原型每個尺寸是各自手調的像素，這裡取中間值，
 * 換算回原型那幾個尺寸誤差都在 1px 內。
 */
const FACES = {
  /** 頁籤 22×18 */
  icon:   { hi: [14, 18, 36, 17],     hiOpacity: 1,   eyeTop: 42,   eyeSide: 20.5, eyeW: 0.136 },
  /** 頭像 30×25、36×30、44×37 */
  avatar: { hi: [12, 21, 45, 19.5],   hiOpacity: .85, eyeTop: 46,   eyeSide: 24,   eyeW: 0.12 },
  /** 空狀態 58×46 */
  empty:  { hi: [11, 20.7, 43, 19.6], hiOpacity: 1,   eyeTop: 45.7, eyeSide: 25.9, eyeW: 0.087 },
  /** 小顆完整饅頭 38×30（統計頁總覽） */
  small:  { hi: [13, 21, 42, 20],     hiOpacity: .8,  eyeTop: 46.7, eyeSide: 26.3, eyeW: 0.105 },
  /** 大顆完整饅頭 78×62、104×84（登入頁） */
  big:    { hi: [11, 21, 44, 20.5],   hiOpacity: .8,  eyeTop: 46.5, eyeSide: 26,   eyeW: 0.087 },
} as const;

const pct = (n: number) => `${n}%`;

type Props = {
  variant: MantouVariant;
  width: number;
  breathing?: boolean;
  /**
   * 沿著饅頭輪廓描一圈底色，用在頭像疊在一起的時候把兩顆分開。
   * 一定要掛在本體（有 blob 圓角）而不是外框——外框是矩形，box-shadow 會
   * 在饅頭身上切出一條直線。
   */
  ring?: boolean | string;
  /** 描邊寬度（px）。原型外殼頭像是 2.5，接受邀請頁卡片上的大頭像是 3 */
  ringWidth?: number;
  /**
   * 只畫本體、高光與兩隻眼睛——原型外殼左上的頭像對就是這個簡化版，
   * 沒有嘴、腮紅與腳。30px 大小下那三樣只會糊成雜點。
   */
  minimal?: boolean;
  className?: string;
  /** 使用者在配置頁幫這個人選的顏色；給了就蓋過 variant 的紫／粉（灰階的 muted、empty 不受影響） */
  color?: MantouColor;
  /** 轉發給根元素，供 e2e 定位 */
  'data-testid'?: string;
};

/** 可選顏色對應的 token：身體、高光、腳；眼睛一律深咖啡 */
export function mantouPalette(color: MantouColor) {
  return {
    body: `var(--c-mantou-${color})`,
    hi: `var(--c-mantou-${color}-hi)`,
    eye: 'var(--c-face)',
    foot: `var(--c-mantou-${color}-shade)`,
  };
}

export function Mantou({
  variant, width, breathing = false, ring = false, ringWidth = 2.5, minimal = false,
  color, className, 'data-testid': testId,
}: Props) {
  const c = color && variant !== 'muted' && variant !== 'empty' ? mantouPalette(color) : PALETTE[variant];
  // 頁籤饅頭一律是簡化版（原型 22×18 只有高光與眼睛）
  const icon = variant === 'tab' || variant === 'muted';
  const simple = minimal || icon;
  const empty = variant === 'empty';
  const big = !simple && !empty && width >= BIG;
  const f = FACES[icon ? 'icon' : simple ? 'avatar' : empty ? 'empty' : big ? 'big' : 'small'];
  const h = Math.round(width * (simple ? ASPECT_SIMPLE : ASPECT));

  const eyeW = Math.max(3, Math.round(width * f.eyeW));
  const eye: CSSProperties = {
    top: pct(f.eyeTop),
    width: eyeW,
    height: simple ? eyeW + 1 : Math.round(eyeW * 1.2),
    background: c.eye,
  };

  // 完整饅頭的嘴是實心的下半圓（笑）；空狀態是一條平線
  let mouth: CSSProperties | null = null;
  if (!simple && empty) {
    mouth = {
      top: '65.2%', width: Math.round(width * 0.172), height: Math.max(2, Math.round(width / 29)),
      borderRadius: 2, background: c.eye,
    };
  } else if (!simple) {
    const w = Math.round(width * (big ? 0.115 : 0.16));
    mouth = {
      top: big ? '61%' : '66.5%', width: w, height: Math.max(2, Math.round(w / 2)),
      borderRadius: `0 0 ${w}px ${w}px`, background: c.eye,
    };
  }

  const footW = Math.round(width * 0.21);
  const footR = Math.round(footW * 0.55);
  const foot: CSSProperties = {
    width: footW, height: Math.round(h * 0.17), borderRadius: `0 0 ${footR}px ${footR}px`, background: c.foot,
  };
  const footSide = empty ? '12%' : '11.8%';

  const shadows = [
    big ? `inset 0 -${Math.round(width * 0.087)}px 0 var(--c-mantou-shade)` : '',
    // true＝描頁面底色；給色碼字串時描那個色（例如疊在白卡上要描白）
    ring ? `0 0 0 ${ringWidth}px ${ring === true ? 'var(--c-bg)' : ring}` : '',
  ].filter(Boolean);

  return (
    <span
      data-testid={testId}
      className={[styles.root, breathing ? styles.breathing : '', className]
        .filter(Boolean).join(' ')}
      style={{ width: `${width}px`, height: `${h}px` }}
      aria-hidden="true"
    >
      {/* 腳先畫、本體蓋在上面：只從本體底部的圓角露出一點（原型） */}
      {!simple && (
        <>
          <span data-part="foot" className={styles.foot} style={{ ...foot, left: footSide }} />
          <span data-part="foot" className={styles.foot} style={{ ...foot, right: footSide }} />
        </>
      )}

      <span
        data-part="body"
        className={styles.body}
        style={{
          width: `${width}px`,
          height: `${h}px`,
          background: c.body,
          borderRadius: icon ? ICON_RADIUS : BODY_RADIUS,
          ...(shadows.length > 0 ? { boxShadow: shadows.join(', ') } : {}),
        }}
      >
        <span
          data-part="hi"
          className={styles.hi}
          style={{
            top: pct(f.hi[0]), left: pct(f.hi[1]), width: pct(f.hi[2]), height: pct(f.hi[3]),
            background: c.hi, opacity: f.hiOpacity,
          }}
        />
        <span data-part="eye" className={styles.eye} style={{ ...eye, left: pct(f.eyeSide) }} />
        <span data-part="eye" className={styles.eye} style={{ ...eye, right: pct(f.eyeSide) }} />

        {big && (
          <>
            <span data-part="blush" className={styles.blush} style={{ left: '14.3%' }} />
            <span data-part="blush" className={styles.blush} style={{ right: '14.3%' }} />
          </>
        )}

        {mouth && (
          <span
            data-part="mouth"
            data-shape={empty ? 'flat' : 'smile'}
            className={styles.mouth}
            style={mouth}
          />
        )}
      </span>
    </span>
  );
}
