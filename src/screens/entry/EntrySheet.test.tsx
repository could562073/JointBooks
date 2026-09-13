import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import { DUR } from '../../lib/motion';
import type { Category, Txn } from '../../domain/types';
import { EntrySheet } from './EntrySheet';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);
const EXPENSE = CATS.filter((c) => c.kind === 'expense');
const INCOME = CATS.filter((c) => c.kind === 'income');

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

const BASE = {
  categories: CATS,
  defaultDate: '2026-09-06',
  onSave: () => {},
  onClose: () => {},
  onAddMain: () => 'new-main',
  onAddSub: () => 'new-sub',
};

function txn(over: Partial<Txn> = {}): Txn {
  return {
    id: 't1', date: '2026-08-20',
    mainId: EXPENSE[0]!.id, subId: EXPENSE[0]!.subs[0]!.id,
    mainName: '租屋', subName: '租屋',
    amountCents: 1_250, currency: 'CAD', actualCadCents: 1_250,
    by: '妻', note: '原本的備註',
    createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z',
    deleted: false,
    ...over,
  };
}

/** 按一串數字鍵 */
function typeAmount(keys: string) {
  for (const k of keys) fireEvent.click(screen.getByTestId(`key-${k}`));
}

describe('EntrySheet 的兩種模式', () => {
  it('新增模式：小字是「記一筆」，只有關閉鍵', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('entry-mode')).toHaveTextContent('記一筆');
    expect(screen.getByTestId('entry-close')).toBeInTheDocument();
    expect(screen.queryByTestId('entry-delete')).not.toBeInTheDocument();
  });

  it('編輯模式：小字是「編輯這筆」，多一顆垃圾桶鍵', () => {
    render(<EntrySheet {...BASE} txn={txn()} />);
    expect(screen.getByTestId('entry-mode')).toHaveTextContent('編輯這筆');
    expect(screen.getByTestId('entry-delete')).toBeInTheDocument();
  });

  it('編輯模式帶入原值', () => {
    render(<EntrySheet {...BASE} txn={txn()} />);
    expect(screen.getByTestId('field-amount')).toHaveTextContent('12.50');
    expect(screen.getByTestId('entry-note')).toHaveValue('原本的備註');
    expect(screen.getByTestId('by-妻')).toHaveAttribute('aria-pressed', 'true');
    // 日期卡照原型顯示 ISO 日期
    expect(screen.getByTestId('date-row')).toHaveTextContent('2026-08-20');
  });

  it('新增模式的日期預設是月曆上的選中日', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('date-row')).toHaveTextContent('2026-09-06');
  });
});

describe('EntrySheet 的金額與幣別', () => {
  it('數字鍵打在金額欄', () => {
    render(<EntrySheet {...BASE} />);
    typeAmount('123');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('123');
  });

  it('CAD 時沒有實扣欄位，提示是「主幣別 CAD · 直接記錄」', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.queryByTestId('field-cad')).not.toBeInTheDocument();
    expect(screen.getByTestId('currency-hint')).toHaveTextContent('主幣別 CAD · 直接記錄');
  });

  it('切到外幣才出現實扣欄位與對應提示', () => {
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('currency-TWD'));
    expect(screen.getByTestId('field-cad')).toBeInTheDocument();
    expect(screen.getByTestId('currency-hint')).toHaveTextContent('不用匯率換算');
  });

  it('點實扣欄位後數字鍵改打在那一欄', () => {
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('currency-TWD'));
    typeAmount('1280');
    fireEvent.click(screen.getByTestId('field-cad'));
    typeAmount('58');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('1280');
    expect(screen.getByTestId('field-cad')).toHaveTextContent('58');
  });

  it('切回 CAD 時實扣欄位消失，焦點回到金額欄', () => {
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('currency-TWD'));
    fireEvent.click(screen.getByTestId('field-cad'));
    fireEvent.click(screen.getByTestId('currency-CAD'));
    expect(screen.queryByTestId('field-cad')).not.toBeInTheDocument();
    typeAmount('9');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('9');
  });
});

describe('EntrySheet 的支出／收入切換', () => {
  it('切到收入時分類換成收入分類', () => {
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('kind-income'));
    expect(screen.getByTestId(`main-${INCOME[0]!.id}`)).toHaveAttribute('aria-pressed', 'true');
    // 整批換成收入分類，不是在支出分類後面多加幾顆
    expect(screen.queryByTestId(`main-${EXPENSE[0]!.id}`)).not.toBeInTheDocument();
  });

  it('切換不會清掉已輸入的金額', () => {
    render(<EntrySheet {...BASE} />);
    typeAmount('42');
    fireEvent.click(screen.getByTestId('kind-income'));
    expect(screen.getByTestId('field-amount')).toHaveTextContent('42');
  });
});

describe('EntrySheet 的分類與日期（使用者裁決：分類一直展開，取代增補檔 B-3）', () => {
  it('分類區一打開就在，不用先點開', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('category-picker')).toBeInTheDocument();
    expect(screen.getByTestId('main-chips')).toBeInTheDocument();
    expect(screen.getByTestId('sub-chips')).toBeInTheDocument();
  });

  it('小月曆預設收起，點日期卡才展開', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.queryByTestId('mini-calendar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('date-row'));
    expect(screen.getByTestId('mini-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('date-row')).toHaveAttribute('aria-expanded', 'true');
  });

  it('選日期後收合，日期卡顯示新日期', () => {
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('date-row'));
    fireEvent.click(screen.getByTestId('mini-day-18'));
    expect(screen.queryByTestId('mini-calendar')).not.toBeInTheDocument();
    expect(screen.getByTestId('date-row')).toHaveTextContent('2026-09-18');
  });

  it('選子分類後它被選中，分類區不會收起來', () => {
    const multi = EXPENSE.find((c) => c.subs.length > 1)!;
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId(`main-${multi.id}`));
    fireEvent.click(screen.getByTestId(`sub-${multi.subs[1]!.id}`));
    expect(screen.getByTestId(`sub-${multi.subs[1]!.id}`)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('category-picker')).toBeInTheDocument();
  });

  it('子分類小標跟著選中的主分類換', () => {
    const multi = EXPENSE.find((c) => c.subs.length > 1)!;
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId(`main-${multi.id}`));
    expect(screen.getByTestId('category-picker')).toHaveTextContent(`子分類 · ${multi.name}`);
  });

  // 原本在 FieldRow.test 裡的 MOTION #38 覆蓋；FieldRow 移除後搬到這裡
  it('日期卡的 ▾ 展開時轉 180°（MOTION #38）', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('date-row-chevron')).toHaveStyle({ transform: 'none' });
    fireEvent.click(screen.getByTestId('date-row'));
    expect(screen.getByTestId('date-row-chevron')).toHaveStyle({ transform: 'rotate(180deg)' });
  });

  it('reduced-motion 下 ▾ 不做轉場', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('date-row-chevron')).toHaveStyle({ transition: 'none' });
  });
});

describe('EntrySheet 的誰記的', () => {
  it('是兩顆小圓臉而不是「我」「妻」文字，選中的那顆 aria-pressed', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('by-我').textContent).toBe('');
    expect(screen.getByTestId('by-我')).toHaveAccessibleName('我');
    fireEvent.click(screen.getByTestId('by-妻'));
    expect(screen.getByTestId('by-妻')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('by-我')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('EntrySheet 的儲存', () => {
  it('金額 0 時儲存鍵停用（§5：金額為 0 時不寫入）', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('key-save')).toBeDisabled();
  });

  it('有金額後可以存，寫入的是面板上的日期而不是月曆選中日', () => {
    const onSave = vi.fn();
    render(<EntrySheet {...BASE} onSave={onSave} />);
    typeAmount('12');
    fireEvent.click(screen.getByTestId('date-row'));
    fireEvent.click(screen.getByTestId('mini-day-18'));
    fireEvent.click(screen.getByTestId('key-save'));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-09-18', amountCents: 1200, currency: 'CAD', actualCadCents: 1200,
    }));
  });

  it('外幣沒填實扣時不給存', () => {
    render(<EntrySheet {...BASE} />);
    typeAmount('1280');
    fireEvent.click(screen.getByTestId('currency-TWD'));
    expect(screen.getByTestId('key-save')).toBeDisabled();
  });

  it('儲存後關閉面板', () => {
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} onClose={onClose} />);
    typeAmount('12');
    fireEvent.click(screen.getByTestId('key-save'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('備註留空時存空字串', () => {
    const onSave = vi.fn();
    render(<EntrySheet {...BASE} onSave={onSave} />);
    typeAmount('12');
    fireEvent.click(screen.getByTestId('key-save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ note: '' }));
  });
});

describe('EntrySheet 的關閉', () => {
  it('✕ 關閉', () => {
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('entry-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('點遮罩關閉', () => {
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('entry-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('點面板內不會誤關', () => {
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('entry-sheet'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('EntrySheet 的刪除（MOTION #37）', () => {
  it('按垃圾桶先跳確認窗，不直接刪', () => {
    const onDelete = vi.fn();
    render(<EntrySheet {...BASE} txn={txn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('entry-delete'));
    expect(screen.getByTestId('delete-confirm')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('確認窗顯示該筆的分類·子分類與金額（§5）', () => {
    render(<EntrySheet {...BASE} txn={txn()} />);
    fireEvent.click(screen.getByTestId('entry-delete'));
    const subject = screen.getByTestId('delete-confirm-subject');
    expect(subject).toHaveTextContent('租屋 · 租屋');
    expect(subject).toHaveTextContent('-$12.50');
  });

  it('取消不刪，回到面板', () => {
    const onDelete = vi.fn();
    render(<EntrySheet {...BASE} txn={txn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('entry-delete'));
    fireEvent.click(screen.getByTestId('delete-confirm-cancel'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument();
  });

  it('確認後刪除並關閉面板', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} txn={txn()} onDelete={onDelete} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('entry-delete'));
    fireEvent.click(screen.getByTestId('delete-confirm-confirm'));
    expect(onDelete).toHaveBeenCalledWith('t1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('EntrySheet 的離場（MOTION #2）', () => {
  /** 這一段要看「有動畫」的路徑，所以把 reduced-motion 關掉 */
  function stubNormalMotion() {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, addEventListener() {}, removeEventListener() {},
    }));
  }

  it('reduced-motion 時直接關，不等動畫', () => {
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('entry-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('一般情況下先播離場動畫，260ms 後才真的關', () => {
    stubNormalMotion();
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('entry-close'));
    expect(screen.getByTestId('entry-scrim')).toHaveAttribute('data-closing');
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(260);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('連點兩下只關一次', () => {
    stubNormalMotion();
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<EntrySheet {...BASE} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('entry-close'));
    fireEvent.click(screen.getByTestId('entry-close'));
    vi.advanceTimersByTime(600);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('離場途中卸載不會對已消失的元件呼叫 onClose', () => {
    stubNormalMotion();
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { unmount } = render(<EntrySheet {...BASE} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('entry-close'));
    unmount();
    vi.advanceTimersByTime(600);
    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('EntrySheet 的小月曆收合動畫（MOTION #38：展開與收起都有動畫）', () => {
  function stubNormalMotion() {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, addEventListener() {}, removeEventListener() {},
    }));
  }

  it('再點一次日期卡：先留著播完離場，時間到才卸載', () => {
    stubNormalMotion();
    vi.useFakeTimers();
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('date-row'));
    expect(screen.getByTestId('date-row-panel')).not.toHaveAttribute('data-exiting');

    fireEvent.click(screen.getByTestId('date-row'));
    expect(screen.getByTestId('date-row-panel')).toHaveAttribute('data-exiting');
    expect(screen.getByTestId('mini-calendar')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(DUR.popIn); });
    expect(screen.queryByTestId('date-row-panel')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('選了日期之後一樣播完才收掉', () => {
    stubNormalMotion();
    vi.useFakeTimers();
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('date-row'));
    fireEvent.click(screen.getByTestId('mini-day-18'));
    expect(screen.getByTestId('date-row-panel')).toHaveAttribute('data-exiting');

    act(() => { vi.advanceTimersByTime(DUR.popIn); });
    expect(screen.queryByTestId('mini-calendar')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('收起途中又點開：不會被先前排好的卸載收掉', () => {
    stubNormalMotion();
    vi.useFakeTimers();
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('date-row'));
    fireEvent.click(screen.getByTestId('date-row'));
    act(() => { vi.advanceTimersByTime(DUR.popIn / 2); });
    fireEvent.click(screen.getByTestId('date-row'));
    act(() => { vi.advanceTimersByTime(DUR.popIn * 2); });
    expect(screen.getByTestId('date-row-panel')).not.toHaveAttribute('data-exiting');
    vi.useRealTimers();
  });

  it('reduced-motion 時收起當下就消失', () => {
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('date-row'));
    fireEvent.click(screen.getByTestId('date-row'));
    expect(screen.queryByTestId('date-row-panel')).not.toBeInTheDocument();
  });
});
