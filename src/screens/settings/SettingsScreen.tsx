import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { SyncStatus } from '../../components/SyncStatus';
import { Toggle } from '../../components/Toggle';
import { DUR } from '../../lib/motion';
import { CategoriesPage } from './CategoriesPage';
import { colorSetOf } from '../../domain/palette';
import { formatCadWhole } from '../../domain/money';
import type { SyncState } from '../../sync/state';
import { useLedger } from '../../store/useLedger';
import { categorySummary, stackedIcons } from './settingsSummary';
import styles from './SettingsScreen.module.css';

type Props = {
  /** 邀請成員 → 邀請面板（§8.2，Plan 09） */
  onInvite(): void;
  syncState: SyncState;
  lastSyncAt: number | null;
  onRetrySync(): void;
};

/**
 * §7 配置頁。
 *
 * 增補檔 A 已移除「月結日」與「週起始」兩列（固定 1 號／週一，常數在
 * domain/constants），所以「其他」區只剩兩個開關。
 */
export function SettingsScreen({ onInvite, syncState, lastSyncAt, onRetrySync }: Props) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categories = useLedger((s) => s.categories);
  const txns = useLedger((s) => s.txns);
  const saveCategory = useLedger((s) => s.saveCategory);
  const deleteCategory = useLedger((s) => s.deleteCategory);
  const showWhoTags = useLedger((s) => s.showWhoTags);
  const notifyOnPartnerEntry = useLedger((s) => s.notifyOnPartnerEntry);
  const toggleWhoTags = useLedger((s) => s.toggleWhoTags);
  const toggleNotify = useLedger((s) => s.toggleNotify);

  const summary = categorySummary(categories);
  const icons = stackedIcons(categories);

  if (categoriesOpen) {
    return (
      // MOTION #14：子頁自右側 38px 滑入 + opacity，420ms
      <div
        className={styles.subpage}
        style={{ ['--slide' as string]: `${DUR.slide}ms` }}
      >
        <CategoriesPage
          categories={categories}
          txns={txns}
          onSave={(c) => void saveCategory(c)}
          onDelete={(id) => void deleteCategory(id)}
          onBack={() => setCategoriesOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className={styles.screen} data-testid="settings-screen">
      <div className={styles.scroll} data-testid="settings-scroll">
        <div className={styles.pageTitle}>
          <h1 className={styles.pageTitleMain}>配置</h1>
          <p className={styles.pageTitleSub}>budgets &amp; categories</p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.titleFirst}>帳本成員</h2>

          <div className={styles.card}>
            <div className={styles.member} data-testid="member-me">
              <span className={styles.avatar} style={{ background: 'var(--c-primary)' }} aria-hidden="true">
                <span className={styles.avatarHi} style={{ background: 'var(--c-hi)' }} />
                <span className={styles.avatarEyeL} />
                <span className={styles.avatarEyeR} />
                <span className={styles.avatarMouth} />
              </span>
              <div className={styles.memberText}>
                <span className={styles.memberName}>我</span>
                <span className={styles.memberSub}>擁有者</span>
              </div>
              <span className={styles.freshness}>線上</span>
            </div>

            <div className={styles.member} data-testid="member-partner">
              <span className={styles.avatar} style={{ background: 'var(--c-partner)' }} aria-hidden="true">
                <span className={styles.avatarHi} style={{ background: 'var(--c-partner-hi)' }} />
                <span className={styles.avatarEyeL} />
                <span className={styles.avatarEyeR} />
                <span className={styles.avatarMouth} />
              </span>
              <div className={styles.memberText}>
                <span className={styles.memberName}>老婆</span>
                <span className={styles.memberSub}>可編輯</span>
              </div>
              <span className={styles.freshness}>
                <SyncStatus state={syncState} lastSyncAt={lastSyncAt} onRetry={onRetrySync} />
              </span>
            </div>

            <button
              type="button" className={styles.inviteRow} onClick={onInvite}
              data-testid="invite-member"
            >
              <span className={styles.inviteLabel}>邀請成員</span>
              <span className={styles.inviteHint}>分享連結 ›</span>
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.title}>分類與預算</h2>

          <button
            type="button" className={styles.card} onClick={() => setCategoriesOpen(true)}
            data-testid="open-categories"
          >
            <div className={styles.summaryRow}>
              <span className={styles.stack} aria-hidden="true">
                {icons.map((c, i) => (
                  <span key={c.id} className={styles.stackItem} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <Icon name={c.icon} size={17} box={26} boxRadius={9} tint={colorSetOf(c.colorSet).tint} />
                  </span>
                ))}
              </span>

              <div className={styles.summaryText}>
                <span className={styles.summaryLabel}>編輯分類與月預算</span>
                <span className={styles.rowSub} data-testid="category-summary">
                  {summary.count} 個分類 · 月額度 {formatCadWhole(summary.budgetCents, 'none')}
                </span>
              </div>

              <span className={styles.chevron} aria-hidden="true">›</span>
            </div>
          </button>
        </section>

        <section className={styles.section}>
          <h2 className={styles.title}>其他</h2>

          <div className={styles.card}>
            <div className={styles.otherRow}>
              <span className={styles.rowLabel}>對方記帳時通知我</span>
              <Toggle
                checked={notifyOnPartnerEntry}
                onChange={() => void toggleNotify()}
                label="對方記帳時通知我"
                testId="toggle-notify"
              />
            </div>

            <div className={styles.otherRowLast}>
              <span className={styles.rowLabel}>每筆顯示記帳人</span>
              <Toggle
                checked={showWhoTags}
                onChange={() => void toggleWhoTags()}
                label="每筆顯示記帳人"
                testId="toggle-who"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
