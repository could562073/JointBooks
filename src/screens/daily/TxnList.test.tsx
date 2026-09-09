import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { Category, Txn } from '../../domain/types';
import { TxnList } from './TxnList';

const CATS: Category[] = [
  {
    id: 'c-food', kind: 'expense', name: '餐飲', icon: 'cup', budgetCents: 60_000,
    subs: [{ id: 's1', name: '早餐' }], colorSet: 0, order: 0, active: true,
  },
  {
    id: 'c-inc', kind: 'income', name: '收入', icon: 'coin', budgetCents: null,
    subs: [{ id: 's2', name: '薪資' }], colorSet: 3, order: 1, active: true,
  },
];

function txn(over: Partial<Txn> = {}): Txn {
  return {
    id: 't1', date: '2026-09-06', mainId: 'c-food', subId: 's1',
    mainName: '餐飲', subName: '早餐',
    amountCents: 1_250, currency: 'CAD', actualCadCents: 1_250,
    by: '我', note: '',
    createdAt: new Date(2026, 8, 6, 8, 30).toISOString(),
    updatedAt: new Date(2026, 8, 6, 8, 30).toISOString(),
    deleted: false,
    ...over,
  };
}

const BASE = { categories: CATS, showWhoTags: true, onEdit: () => {} };

describe('TxnList 的空狀態', () => {
  it('沒有紀錄時顯示灰饅頭與提示文字', () => {
    render(<TxnList {...BASE} txns={[]} />);
    expect(screen.getByTestId('txn-empty')).toHaveTextContent('這天還沒有紀錄');
    expect(screen.getByTestId('empty-mantou')).toBeInTheDocument();
    expect(screen.queryByTestId('txn-list')).not.toBeInTheDocument();
  });
});

describe('TxnList 的每一列', () => {
  it('顯示分類、子分類、時間與備註', () => {
    render(<TxnList {...BASE} txns={[txn({ note: '公司樓下咖啡' })]} />);
    const row = screen.getByTestId('txn-t1');
    expect(row).toHaveTextContent('餐飲');
    expect(row).toHaveTextContent('早餐');
    expect(row).toHaveTextContent('08:30');
    expect(row).toHaveTextContent('公司樓下咖啡');
  });

  it('支出前綴負號，收入前綴正號', () => {
    render(
      <TxnList
        {...BASE}
        txns={[
          txn(),
          txn({ id: 't2', mainId: 'c-inc', mainName: '收入', subName: '薪資', actualCadCents: 300_000 }),
        ]}
      />
    );
    expect(screen.getByTestId('txn-t1')).toHaveTextContent('-$12.50');
    expect(screen.getByTestId('txn-t2')).toHaveTextContent('+$3,000.00');
  });

  it('CAD 只顯示 CAD，外幣顯示原幣金額', () => {
    render(
      <TxnList
        {...BASE}
        txns={[txn(), txn({ id: 't2', amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800 })]}
      />
    );
    expect(screen.getByTestId('txn-t1')).toHaveTextContent('CAD');
    expect(screen.getByTestId('txn-t2')).toHaveTextContent('1,280 TWD');
  });

  it('分類被刪掉時退回交易上的名稱快照，不會整列消失', () => {
    render(<TxnList {...BASE} txns={[txn({ mainId: 'gone', mainName: '舊分類' })]} />);
    expect(screen.getByTestId('txn-t1')).toHaveTextContent('舊分類');
  });

  it('點一列把該筆交易回報出去', () => {
    const onEdit = vi.fn();
    const t = txn();
    render(<TxnList {...BASE} txns={[t]} onEdit={onEdit} />);
    fireEvent.click(screen.getByTestId('txn-t1'));
    expect(onEdit).toHaveBeenCalledWith(t);
  });
});

describe('TxnList 的記帳人頭像', () => {
  it('兩個人各自的底色', () => {
    render(<TxnList {...BASE} txns={[txn(), txn({ id: 't2', by: '妻' })]} />);
    expect(screen.getByTestId('by-t1')).toHaveStyle({ background: '#B7A6E5' });
    expect(screen.getByTestId('by-t2')).toHaveStyle({ background: '#DDA6D0' });
  });

  it('關掉「每筆顯示記帳人」時隱形但保留版位', () => {
    render(<TxnList {...BASE} txns={[txn()]} showWhoTags={false} />);
    const avatar = screen.getByTestId('by-t1');
    // 用 opacity 藏，不是 display:none —— 版位還在，右緣才不會跑掉
    expect(avatar).toHaveStyle({ opacity: '0' });
    expect(avatar).toBeInTheDocument();
  });
});

describe('TxnList 的排序', () => {
  it('照傳進來的順序渲染（排序由 domain 的 txnsOn 負責）', () => {
    render(
      <TxnList
        {...BASE}
        txns={[
          txn({ id: 'early', createdAt: new Date(2026, 8, 6, 7, 0).toISOString() }),
          txn({ id: 'late', createdAt: new Date(2026, 8, 6, 19, 0).toISOString() }),
        ]}
      />
    );
    const rows = screen.getAllByTestId(/^txn-(early|late)$/);
    expect(rows.map((n) => n.getAttribute('data-testid'))).toEqual(['txn-early', 'txn-late']);
  });
});
