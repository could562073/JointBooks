import type { AskChoice, AskPlan } from '../sync/account';
import dialog from './ConfirmDialog.module.css';
import styles from './AccountSwitchDialog.module.css';

type Props = {
  plan: AskPlan;
  busy?: boolean;
  error?: string | null;
  onChoose(choice: AskChoice): void;
};

/**
 * 換帳號登入、或手機上有帳又要加入邀請時：問手機上的帳要合併、改用雲端還是取消
 * （使用者要求：可能蓋掉現有帳戶的資料，要再確認一次）。
 * 點遮罩不關：三個選擇都有後果，要使用者明確選一個。
 */
export function AccountSwitchDialog({ plan, busy = false, error = null, onChoose }: Props) {
  const joining = plan.self === '妻';
  const where = joining ? '對方的帳本' : plan.target ? '這個帳號的帳本' : '這個帳號的新帳本';
  const cloudLabel = plan.target === null
    ? '開一本新的空帳本'
    : joining ? '改用對方帳本裡的帳' : '改用這個帳號雲端上的帳';
  const intro = plan.from && plan.from !== plan.to
    ? `上次登入的是 ${plan.from}，這次是 ${plan.to}。`
    : joining ? '你要加入對方的帳本。'
    : plan.target ? `${plan.to} 已經有一本帳。` : `${plan.to} 還沒有帳本。`;

  return (
    <div className={dialog.scrim} data-testid="account-switch-scrim">
      <div
        className={dialog.box}
        role="alertdialog" aria-modal="true" aria-label="手機上的帳要怎麼處理"
        data-testid="account-switch"
      >
        <h2 className={dialog.title}>這台手機上有 {plan.count} 筆帳</h2>
        <p className={dialog.desc}>{intro}手機上的帳要怎麼處理？</p>

        <div className={styles.choices}>
          {plan.canMerge && (
            <button
              type="button" className={styles.merge} disabled={busy}
              onClick={() => onChoose('merge')} data-testid="account-switch-merge"
            >合併進{where}</button>
          )}
          <button
            type="button" className={`${dialog.confirm} ${styles.choice}`} disabled={busy}
            onClick={() => onChoose('cloud')} data-testid="account-switch-cloud"
          >{cloudLabel}</button>
          <button
            type="button" className={`${dialog.cancel} ${styles.choice}`} disabled={busy}
            onClick={() => onChoose('cancel')} data-testid="account-switch-cancel"
          >{joining ? '取消' : '取消，先不登入'}</button>
        </div>

        <p className={styles.note}>
          {plan.canMerge
            ? `合併不會刪掉雲端原本的帳；選「${cloudLabel}」會清掉這台手機上的帳。`
            : `手機上的帳有兩個人記的，合併過去會算錯人，所以只能選「${cloudLabel}」或取消。`}
        </p>
        {error && <p className={styles.error} role="alert" data-testid="account-switch-error">{error}</p>}
      </div>
    </div>
  );
}
