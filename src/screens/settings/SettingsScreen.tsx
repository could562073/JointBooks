import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Toggle } from '../../components/Toggle';
import { DUR } from '../../lib/motion';
import { CategoriesPage } from './CategoriesPage';
import { colorSetOf } from '../../domain/palette';
import { formatCad } from '../../domain/money';
import { useLedger } from '../../store/useLedger';
import { categorySummary, stackedIcons } from './settingsSummary';
import styles from './SettingsScreen.module.css';

type Props = {
  /** 邀請成員 → 邀請面板（§8.2，Plan 09） */
  onInvite(): void;
};

/**
 * §7 配置頁。
 *
 * 增補檔 A 已移除「月結日」與「週起始」兩列（固定 1 號／週一，常數在
 * domain/constants），所以「其他」區只剩兩個開關。
 */
export function SettingsScreen({ onInvite }: Props) {
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
        <section className={styles.section}>
          <h2 className={styles.title}>帳本成員</h2>

          <div className={styles.card}>
            <div className={styles.member} data-testid="member-me">
              <span className={styles.avatar} style={{ background: '#B7A6E5' }} aria-hidden="true">我</span>
              <div className={styles.memberText}>
                <span className={styles.memberName}>我</span>
                <span className={styles.memberSub}>擁有者</span>
              </div>
            </div>

            <div className={styles.member} data-testid="member-partner">
              <span className={styles.avatar} style={{ background: '#DDA6D0' }} aria-hidden="true">妻</span>
              <div className={styles.memberText}>
                <span className={styles.memberName}>老婆</span>
                {/* 最後同步時間要等 Plan 08 的同步狀態機才有真值 */}
                <span className={styles.memberSub}>可編輯 · 尚未同步</span>
              </div>
            </div>

            <button
              type="button" className={styles.row} onClick={onInvite}
              data-testid="invite-member"
            >
              <span className={styles.rowLabel}>邀請成員</span>
              <span className={styles.chevron} aria-hidden="true">›</span>
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
                    <Icon name={c.icon} size={14} box={26} boxRadius={9} tint={colorSetOf(c.colorSet).tint} />
                  </span>
                ))}
              </span>

              <div className={styles.summaryText}>
                <span className={styles.rowLabel}>編輯分類與月預算</span>
                <span className={styles.rowSub} data-testid="category-summary">
                  {summary.count} 個分類 · 月額度 {formatCad(summary.budgetCents, 'none')}
                </span>
              </div>

              <span className={styles.chevron} aria-hidden="true">›</span>
            </div>
          </button>
        </section>

        <section className={styles.section}>
          <h2 className={styles.title}>其他</h2>

          <div className={styles.card}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>對方記帳時通知我</span>
              <Toggle
                checked={notifyOnPartnerEntry}
                onChange={() => void toggleNotify()}
                label="對方記帳時通知我"
                testId="toggle-notify"
              />
            </div>

            <div className={styles.row}>
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
