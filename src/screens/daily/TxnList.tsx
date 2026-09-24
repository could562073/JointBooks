import { Icon } from '../../components/Icon';
import { Mantou } from '../../components/Mantou';
import { colorSetOf } from '../../domain/palette';
import { formatCad } from '../../domain/money';
import type { Category, Txn } from '../../domain/types';
import { DUR } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { useLedger } from '../../store/useLedger';
import { avatarColor, riseDelay, txnTime } from './txnRow';
import styles from './TxnList.module.css';

type Props = {
  /** 已經是當天、且依 createdAt 升冪排好的清單（domain/aggregate 的 txnsOn） */
  txns: Txn[];
  categories: Category[];
  /** 配置頁的「每筆顯示記帳人」；關掉時頭像隱形但保留版位 */
  showWhoTags: boolean;
  onEdit(txn: Txn): void;
  /** MOTION #37：正在播刪除收合動畫的紀錄 id */
  collapsing?: ReadonlySet<string>;
};

export function TxnList({ txns, categories, showWhoTags, onEdit, collapsing }: Props) {
  const reduced = useReducedMotion();

  if (txns.length === 0) {
    return (
      <div className={styles.empty} data-testid="txn-empty">
        <Mantou variant="empty" width={84} data-testid="empty-mantou" />
        <p className={styles.emptyText}>這天還沒有紀錄</p>
      </div>
    );
  }

  return (
    <ul className={styles.list} data-testid="txn-list">
      {txns.map((t, i) => (
        <TxnRow
          key={t.id}
          txn={t}
          category={categories.find((c) => c.id === t.mainId)}
          showWhoTags={showWhoTags}
          onEdit={onEdit}
          // MOTION #5：逐張浮現。reduced-motion 時不排延遲，整批直接就位
          delayMs={reduced ? 0 : riseDelay(i, DUR.riseStagger)}
          collapsing={collapsing?.has(t.id) ?? false}
        />
      ))}
    </ul>
  );
}

type RowProps = {
  txn: Txn;
  /** 分類可能已被刪掉；顯示一律以 id 解析，解析不到才退回交易上的名稱快照 */
  category: Category | undefined;
  showWhoTags: boolean;
  onEdit(txn: Txn): void;
  /** MOTION #5 的逐張延遲（ms） */
  delayMs: number;
  /** MOTION #37：正在播刪除的收合動畫 */
  collapsing: boolean;
};

function TxnRow({ txn, category, showWhoTags, onEdit, delayMs, collapsing }: RowProps) {
  // 記帳人頭像跟著配置頁幫兩人選的饅頭顏色
  const members = useLedger((s) => s.members);
  const isIncome = category?.kind === 'income';
  const set = colorSetOf(category?.colorSet ?? 0);

  return (
    <li
      className={collapsing ? `${styles.item} jb-row-collapsing` : styles.item}
      style={{ ['--rise-delay' as string]: `${delayMs}ms`, ['--rise' as string]: `${DUR.riseIn}ms` }}
      data-delay={delayMs}
      data-collapsing={collapsing ? '' : undefined}
    >
      <button
        type="button"
        className={styles.row}
        onClick={() => onEdit(txn)}
        data-testid={`txn-${txn.id}`}
      >
        <Icon name={category?.icon ?? 'coin'} size={20} box={36} boxRadius={13} tint={set.tint} />

        <span className={styles.mid}>
          <span className={styles.line1}>
            <span className={styles.pill} style={{ background: set.tint, color: set.color }}>
              {category?.name ?? txn.mainName}
            </span>
            <span className={styles.sub}>{txn.subName}</span>
          </span>
          {/* 原型的第二行是「時間 備註」，時間在前——不是把時間擠進第一行 */}
          <span className={styles.line2}>
            <span className={styles.time}>{txnTime(txn.createdAt)}</span>
            {txn.note && <span className={styles.note}>{txn.note}</span>}
          </span>
        </span>

        <span className={styles.right}>
          <span className={styles.amountBox}>
            {/* 全部都是 CAD，右下角不再標幣別，所以金額自己帶錢字號 */}
            <span className={isIncome ? styles.income : styles.expense}>
              {formatCad(txn.actualCadCents, isIncome ? 'plus' : 'minus')}
            </span>
          </span>

          {/* 關掉設定時用 opacity 藏起來而不是不渲染，讓每列的右緣對齊不變 */}
          <span
            className={styles.avatar}
            style={{ opacity: showWhoTags ? 1 : 0 }}
            data-testid={`by-${txn.id}`}
            aria-hidden={!showWhoTags}
          >
            {/* 原型的頭像是一顆 22px 的小饅頭臉，不是「我／妻」兩個字 */}
            <span className={styles.face} style={{ background: avatarColor(members[txn.by].color) }}>
              <span className={styles.eye} style={{ left: '5.5px' }} />
              <span className={styles.eye} style={{ right: '5.5px' }} />
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}
