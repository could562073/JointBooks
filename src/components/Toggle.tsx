import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import styles from './Toggle.module.css';

type Props = {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  testId: string;
};

/**
 * §7.3 的開關（MOTION #21）：knob 位移 220ms，軌道底色同時轉色。
 *
 * 用 role="switch" 的 button 而不是 checkbox：外觀完全自訂，原生 checkbox
 * 的可近性優勢在這裡拿不到，反而要花力氣把它藏起來。
 */
export function Toggle({ checked, onChange, label, testId }: Props) {
  const reduced = useReducedMotion();
  const move = reduced ? 'none' : `${DUR.toggleKnob}ms ${EASE.enter}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.track}
      style={{
        transition: reduced ? 'none' : `background ${DUR.toggleKnob}ms ${EASE.enter}`,
      }}
      data-checked={checked ? '' : undefined}
      onClick={() => onChange(!checked)}
      data-testid={testId}
    >
      <span
        className={styles.knob}
        style={{ left: checked ? '22px' : '3px', transition: move === 'none' ? 'none' : `left ${move}` }}
        aria-hidden="true"
        data-testid={`${testId}-knob`}
      />
    </button>
  );
}
