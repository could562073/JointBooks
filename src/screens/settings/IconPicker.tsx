import { Icon, ICON_KEYS, type IconKey } from '../../components/Icon';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import styles from './IconPicker.module.css';

type Props = {
  value: IconKey;
  onPick(icon: IconKey): void;
  tint: string;
};

/**
 * §7.2 分類卡的圖示選擇器（MOTION #18）：15 顆、每顆 44×44、選中有外框。
 * 換完即時同步——因為明細、預算條、記帳選單都以分類 id 解析圖示，
 * 只要 store 的分類更新，三處自然跟著換，這裡不必額外通知任何人。
 */
export function IconPicker({ value, onPick, tint }: Props) {
  const reduced = useReducedMotion();

  return (
    <div
      className={reduced ? styles.panel : `${styles.panel} ${styles.panelIn}`}
      style={{ ['--pop' as string]: `${DUR.popIn}ms` }}
      data-testid="icon-picker"
    >
      {ICON_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={styles.cell}
          style={{
            transition: reduced ? 'none' : `box-shadow ${DUR.outlineFade}ms ${EASE.exit}`,
          }}
          data-selected={k === value ? '' : undefined}
          aria-pressed={k === value}
          aria-label={k}
          onClick={() => onPick(k)}
          data-testid={`icon-${k}`}
        >
          <Icon name={k} size={18} box={30} boxRadius={10} tint={tint} />
        </button>
      ))}
    </div>
  );
}
