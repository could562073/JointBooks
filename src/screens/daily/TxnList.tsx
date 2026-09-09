import { Icon } from '../../components/Icon';
import { Mantou } from '../../components/Mantou';
import { colorSetOf } from '../../domain/palette';
import { formatCad, formatOriginal } from '../../domain/money';
import type { Category, Txn } from '../../domain/types';
import { avatarColor, txnTime } from './txnRow';
import styles from './TxnList.module.css';

type Props = {
  /** 已經是當天、且依 createdAt 升冪排好的清單（domain/aggregate 的 txnsOn） */
  txns: Txn[];
  categories: Category[];
  /** 配置頁的「每筆顯示記帳人」；關掉時頭像隱形但保留版位 */
  showWhoTags: boolean;
  onEdit(txn: Txn): void;
};

export function TxnList({ txns, categories, showWhoTags, onEdit }: Props) {
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
      {txns.map((t) => (
        <TxnRow
          key={t.id}
          txn={t}
          category={categories.find((c) => c.id === t.mainId)}
          showWhoTags={showWhoTags}
          onEdit={onEdit}
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
};

function TxnRow({ txn, category, showWhoTags, onEdit }: RowProps) {
  const isIncome = category?.kind === 'income';
  const set = colorSetOf(category?.colorSet ?? 0);

  return (
    <li className={styles.item}>
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
            <span className={styles.time}>{txnTime(txn.createdAt)}</span>
          </span>
          {txn.note && <span className={styles.note}>{txn.note}</span>}
        </span>

        <span className={styles.right}>
          <span className={isIncome ? styles.income : styles.expense}>
            {formatCad(txn.actualCadCents, isIncome ? 'plus' : 'minus')}
          </span>
          <span className={styles.orig}>{formatOriginal(txn.amountCents, txn.currency)}</span>
        </span>

        {/* 關掉設定時用 opacity 藏起來而不是不渲染，讓每列的右緣對齊不變 */}
        <span
          className={styles.avatar}
          style={{ background: avatarColor(txn.by), opacity: showWhoTags ? 1 : 0 }}
          data-testid={`by-${txn.id}`}
          aria-hidden={!showWhoTags}
        >
          {txn.by}
        </span>
      </button>
    </li>
  );
}
