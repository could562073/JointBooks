import { useState } from 'react';
import { DUR, EASE } from '../../lib/motion';
import type { KeypadKey } from './amountInput';
import styles from './Keypad.module.css';

/** §5：3×4（1-9、`.`、0、⌫）。順序就是版面順序，不另外維護座標表 */
const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

const LABEL: Record<KeypadKey, string> = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
  '.': '.', back: '⌫',
};

type Props = {
  onKey(key: KeypadKey): void;
  onSave(): void;
  canSave: boolean;
};

/**
 * §5 數字鍵盤。MOTION #3 的按壓回饋用 state 而不是 :active——
 * :active 在 iOS Safari 上會被捲動提早取消，手指還按著就先彈回來了。
 */
export function Keypad({ onKey, onSave, canSave }: Props) {
  const [down, setDown] = useState<string | null>(null);

  const pressProps = (id: string) => ({
    onPointerDown: () => setDown(id),
    onPointerUp: () => setDown(null),
    onPointerCancel: () => setDown(null),
    onPointerLeave: () => setDown(null),
    'data-pressed': down === id ? '' : undefined,
    style: { ['--press' as string]: `${DUR.keyPress}ms`, ['--ease' as string]: EASE.move },
  });

  return (
    <div className={styles.pad} data-testid="keypad">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          // §5：⌫ 用淡紫底 + 深紫圖示，不可用灰色
          className={`${styles.key} ${k === 'back' ? styles.back : ''}`}
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? '刪除' : LABEL[k]}
          data-testid={`key-${k}`}
          {...pressProps(k)}
        >
          {LABEL[k]}
        </button>
      ))}

      {/* §5：儲存鍵跨四列，只有一個白色大勾號，沒有文字 */}
      <button
        type="button"
        className={styles.save}
        onClick={onSave}
        disabled={!canSave}
        aria-label="儲存"
        data-testid="key-save"
        {...pressProps('save')}
      >
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <path
            d="M7 15.5 L12.5 21 L23 9"
            fill="none"
            stroke="#fff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
