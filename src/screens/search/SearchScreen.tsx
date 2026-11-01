import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Mantou } from '../../components/Mantou';
import { formatCad, formatCents } from '../../domain/money';
import { colorSetOf } from '../../domain/palette';
import type { Txn } from '../../domain/types';
import { useBackToClose } from '../../lib/useBackToClose';
import { useLedger } from '../../store/useLedger';
import { avatarColor } from '../daily/txnRow';
import { loadRecent, pushRecent, saveRecent } from './recentSearches';
import {
  groupLabel, highlight, searchTxns, shortDate, type SearchFilter, type SearchHit,
} from './searchTxns';
import styles from './SearchScreen.module.css';

/** 規格 §4：輸入時即時過濾，等打字停 150ms 再算 */
export const SEARCH_DEBOUNCE_MS = 150;

type Props = {
  /** 點結果列：關掉搜尋頁，日常頁切到那筆的月份並選中那天 */
  onPick(txn: Txn): void;
  onClose(): void;
};

/**
 * 搜尋頁：全螢幕蓋過日常頁與分頁列，但在記一筆面板之下。
 * 找的是兩人所有月份的紀錄；每次開啟都是新的掛載，關鍵字與篩選自然回到初始狀態。
 */
export function SearchScreen({ onPick, onClose }: Props) {
  // 規格 §7：開著的時候對方同步了新資料不強制重整，下次開啟時生效——所以開啟當下取一次快照
  const [txns] = useState(() => useLedger.getState().txns);
  const categories = useLedger((s) => s.categories);
  const today = useLedger((s) => s.today);

  const [input, setInput] = useState('');
  // 真正拿去搜尋的關鍵字，比輸入框慢 150ms
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  // Android 返回鍵、iPhone 右滑先關搜尋頁，不直接離開 App
  useBackToClose(onClose);

  useEffect(() => {
    if (input === query) return;
    const t = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input, query]);

  // 規格 §2：全部 → 支出分類（照配置頁順序）→ 收入。收入只有一顆，不分子類
  const expenseCats = useMemo(
    () => categories.filter((c) => c.kind === 'expense' && c.active).sort((a, b) => a.order - b.order),
    [categories],
  );

  const result = useMemo(() => searchTxns(txns, categories, query, filter), [txns, categories, query, filter]);
  const thisYear = Number(today.slice(0, 4));

  /** 換關鍵字時不等 debounce（清除、點最近搜尋） */
  function setNow(v: string) {
    setInput(v);
    setQuery(v);
  }

  return (
    <div className={styles.screen} role="dialog" aria-label="搜尋紀錄" data-testid="search-screen">
      <div className={styles.top}>
        <form
          className={styles.field}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(input);
            const next = pushRecent(recent, input);
            if (next !== recent) {
              setRecent(next);
              saveRecent(next);
            }
            // 收起鍵盤，結果才看得到全部
            inputRef.current?.blur();
          }}
        >
          <SearchGlyph className={styles.glyph} />
          <input
            ref={inputRef}
            className={styles.input}
            type="search"
            enterKeyHint="search"
            autoFocus
            placeholder="店名、品項、分類或金額"
            aria-label="搜尋"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            data-testid="search-input"
          />
          {input && (
            <button
              type="button"
              className={styles.clear}
              aria-label="清除"
              onClick={() => { setNow(''); inputRef.current?.focus(); }}
              data-testid="search-clear"
            >
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </form>
        <button type="button" className={styles.cancel} onClick={onClose} data-testid="search-cancel">
          取消
        </button>
      </div>

      <div className={styles.chips} role="radiogroup" aria-label="分類篩選" data-testid="search-chips">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>全部</Chip>
        {expenseCats.map((c) => (
          <Chip
            key={c.id}
            on={typeof filter === 'object' && filter.mainId === c.id}
            onClick={() => setFilter({ mainId: c.id })}
          >
            {c.name}
          </Chip>
        ))}
        <Chip on={filter === 'income'} onClick={() => setFilter('income')}>收入</Chip>
      </div>

      <div className={styles.body} data-testid="search-body">
        {result === null ? (
          // 閒置：只有最近搜尋，空的時候連標題都不顯示
          recent.length > 0 && (
            <section data-testid="search-recent">
              <h2 className={styles.label}>最近搜尋</h2>
              <div className={styles.recent}>
                {recent.map((r) => (
                  <button key={r} type="button" className={styles.recentChip} onClick={() => setNow(r)}>
                    <ClockGlyph className={styles.clock} />
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )
        ) : result.count === 0 ? (
          <div className={styles.empty} data-testid="search-empty">
            <Mantou variant="empty" width={84} />
            <p className={styles.emptyText}>找不到符合的紀錄</p>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <span className={styles.count} data-testid="search-count">找到 {result.count} 筆</span>
              {result.expenseCents > 0 && (
                <span className={styles.total} data-testid="search-total">
                  支出合計 {formatCad(result.expenseCents, 'none')}
                </span>
              )}
            </div>
            {result.groups.map((g) => (
              <section key={g.key} className={styles.group} data-testid={`search-group-${g.key}`}>
                <div className={styles.groupHead}>
                  <span className={styles.groupLeft}>
                    <span className={styles.groupTitle}>{groupLabel(g, thisYear)}</span>
                    <span className={styles.groupCount}>{g.hits.length} 筆</span>
                  </span>
                  {g.expenseCents > 0 && (
                    <span className={styles.groupTotal} data-testid={`search-group-total-${g.key}`}>
                      支出 {formatCad(g.expenseCents, 'none')}
                    </span>
                  )}
                </div>
                <ul className={styles.card}>
                  {g.hits.map((h) => (
                    <ResultRow key={h.txn.id} hit={h} query={query} onPick={onPick} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      className={on ? `${styles.chip} ${styles.chipOn}` : styles.chip}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ResultRow({ hit, query, onPick }: { hit: SearchHit; query: string; onPick(t: Txn): void }) {
  // 規格寫「之後要改成讀取成員設定的饅頭色」：成員顏色已經有了，直接讀
  const members = useLedger((s) => s.members);
  const { txn } = hit;
  const income = hit.kind === 'income';
  // 收入沒有分類色，標籤固定用綠色系（規格 §7）
  const pill = income
    ? { background: 'var(--c-search-income-bg)', color: 'var(--c-search-income)' }
    : (({ tint, color }) => ({ background: tint, color }))(colorSetOf(hit.category?.colorSet ?? 0));

  return (
    <li className={styles.item}>
      <button type="button" className={styles.row} onClick={() => onPick(txn)} data-testid={`search-hit-${txn.id}`}>
        <span className={styles.date}>{shortDate(txn.date)}</span>
        <span className={styles.mid}>
          <span className={styles.line1}>
            <span className={styles.pill} style={pill}><Marked text={hit.mainName} query={query} /></span>
            <span className={styles.sub}><Marked text={hit.subName} query={query} /></span>
          </span>
          {txn.note && (
            <span className={styles.note}><Marked text={txn.note} query={query} /></span>
          )}
        </span>
        <span className={income ? styles.income : styles.expense}>
          {income ? '+' : '-'}{formatCents(txn.actualCadCents)}
        </span>
        <span
          className={styles.dot}
          style={{ background: avatarColor(members[txn.by].color) }}
          title={members[txn.by].name}
          aria-label={members[txn.by].name}
          data-testid={`search-by-${txn.id}`}
        />
      </button>
    </li>
  );
}

/** 只標第一個符合處（規格 §3） */
function Marked({ text, query }: { text: string; query: string }) {
  const { before, hit, after } = highlight(text, query);
  if (!hit) return <>{text}</>;
  return <>{before}<mark className={styles.mark}>{hit}</mark>{after}</>;
}

export function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

function ClockGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
