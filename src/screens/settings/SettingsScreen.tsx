import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { Mantou } from '../../components/Mantou';
import { ScrollThumb, TAB_BAR_INSET } from '../../components/ScrollThumb';
import { MANTOU_COLOR_LABEL, MANTOU_COLORS } from '../../domain/mantouColors';
import { MEMBER_NAME_MAX, type Member } from '../../domain/members';
import { roleLabel } from '../../domain/people';
import type { Person } from '../../domain/types';
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
  /** 改了成員名稱或饅頭顏色：要求同步推上雲端 */
  onMembersChanged?(): void;
};

type MemberRowProps = {
  person: Person;
  member: Member;
  /** 這台裝置的使用者 */
  isSelf: boolean;
  open: boolean;
  onToggle(): void;
  onChange(patch: Partial<Member>): void;
  status: ReactNode;
  testId: string;
};

/**
 * 帳本成員的一列。點頭像或名稱展開編輯：改名稱、換饅頭顏色（使用者要求；會同步到
 * 雲端，兩支手機看到的一樣）。稱謂不寫死「我／老婆」——兩個人都是使用者。
 */
function MemberRow({ person, member, isSelf, open, onToggle, onChange, status, testId }: MemberRowProps) {
  return (
    <div className={styles.member} data-testid={testId}>
      <button
        type="button" className={styles.memberMain} onClick={onToggle}
        aria-expanded={open} data-testid={`${testId}-toggle`}
      >
        <span className={styles.avatar} style={{ background: `var(--c-mantou-${member.color})` }} aria-hidden="true">
          <span className={styles.avatarHi} style={{ background: `var(--c-mantou-${member.color}-hi)` }} />
          <span className={styles.avatarEyeL} />
          <span className={styles.avatarEyeR} />
          <span className={styles.avatarMouth} />
        </span>
        <span className={styles.memberText}>
          <span className={styles.memberName}>{member.name}</span>
          <span className={styles.memberSub}>{roleLabel(person)}{isSelf ? ' · 這台裝置' : ''}</span>
        </span>
      </button>
      <span className={styles.freshness}>{status}</span>
      {open && <MemberEditor member={member} onChange={onChange} testId={testId} />}
    </div>
  );
}

/** 展開後的編輯區。每次打開都從目前的名稱開始，不沿用上次沒存的草稿 */
function MemberEditor({ member, onChange, testId }: Pick<MemberRowProps, 'member' | 'onChange' | 'testId'>) {
  const [draft, setDraft] = useState(member.name);

  function commitName() {
    const name = draft.trim();
    // 清空就當作沒改，不存成空白
    if (!name) { setDraft(member.name); return; }
    if (name !== member.name) onChange({ name });
  }

  return (
    <div
      className={styles.memberEdit}
      style={{ ['--pop' as string]: `${DUR.popIn}ms` }}
      data-testid={`${testId}-edit`}
    >
      <label className={styles.editLabel} htmlFor={`${testId}-name`}>名稱</label>
      <input
        id={`${testId}-name`}
        className={styles.nameInput}
        value={draft}
        maxLength={MEMBER_NAME_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        data-testid={`${testId}-name`}
      />
      <span className={styles.editLabel}>饅頭顏色</span>
      <div className={styles.swatches} role="radiogroup" aria-label="饅頭顏色">
        {MANTOU_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={member.color === c}
            aria-label={MANTOU_COLOR_LABEL[c]}
            className={styles.swatch}
            data-selected={member.color === c ? '' : undefined}
            onClick={() => onChange({ color: c })}
            data-testid={`${testId}-color-${c}`}
          >
            <Mantou variant="full" width={28} minimal color={c} />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * §7 配置頁。
 *
 * 增補檔 A 已移除「月結日」與「週起始」兩列（固定 1 號／週一，常數在
 * domain/constants），所以「其他」區只剩兩個開關。
 */
export function SettingsScreen({ onInvite, syncState, lastSyncAt, onRetrySync, onMembersChanged }: Props) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  // 從分類子頁返回時，配置頁自左側滑回來（使用者要求）。切走再切回配置分頁會重掛、歸零
  const [returned, setReturned] = useState(false);
  const members = useLedger((s) => s.members);
  const self = useLedger((s) => s.self);
  const setMember = useLedger((s) => s.setMember);
  // 正在編輯哪一位的名稱與饅頭顏色；null 表示都收起來
  const [editing, setEditing] = useState<Person | null>(null);
  const changeMember = (p: Person, patch: Partial<Member>) => {
    void setMember(p, patch).then(() => onMembersChanged?.());
  };
  // 只在捲動時出現的捲動條要跟著這個捲動區（hook 要在下面的提早 return 之前）
  const scrollRef = useRef<HTMLDivElement>(null);
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
          onBack={() => { setCategoriesOpen(false); setReturned(true); }}
        />
      </div>
    );
  }

  return (
    <div
      className={returned ? `${styles.screen} ${styles.backIn}` : styles.screen}
      style={returned ? { ['--slide' as string]: `${DUR.slide}ms` } : undefined}
      data-returning={returned ? '' : undefined}
      data-testid="settings-screen"
    >
      <ScrollThumb target={scrollRef} bottomInset={TAB_BAR_INSET} />
      <div ref={scrollRef} className={styles.scroll} data-testid="settings-scroll">
        <div className={styles.pageTitle}>
          <h1 className={styles.pageTitleMain}>配置</h1>
          <p className={styles.pageTitleSub}>budgets &amp; categories</p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.titleFirst}>帳本成員</h2>

          <div className={styles.card}>
            {(['我', '妻'] as const).map((p) => (
              <MemberRow
                key={p}
                person={p}
                member={members[p]}
                isSelf={p === self}
                open={editing === p}
                onToggle={() => setEditing((e) => (e === p ? null : p))}
                onChange={(patch) => changeMember(p, patch)}
                // 自己這一列寫「線上」，另一位那列放同步狀態（原型同樣位置）
                status={p === self
                  ? '線上'
                  : <SyncStatus state={syncState} lastSyncAt={lastSyncAt} onRetry={onRetrySync} />}
                testId={p === '我' ? 'member-me' : 'member-partner'}
              />
            ))}

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
