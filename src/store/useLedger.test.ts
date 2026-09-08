import { describe, it, expect, beforeEach } from 'vitest';
import { useLedger, selectedDate } from './useLedger';
import { resetDb } from '../db/schema';

const s = () => useLedger.getState();

// 模組載入當下、任何測試跑之前的完整初始狀態；用它整個替換，而不是只重置
// 「category / txns / ready」三個欄位——否則 year、month、selectedDay、tab、
// dimension、showWhoTags 會沿用上一個測試留下的值，跨測試互相汙染（Minor 7）。
const initialState = useLedger.getState();

beforeEach(async () => {
  await resetDb();
  useLedger.setState(initialState, true);
  await s().load();
});

describe('載入', () => {
  it('load 之後拿得到預設分類且 ready', () => {
    expect(s().ready).toBe(true);
    expect(s().categories).toHaveLength(7);
  });
});

describe('月份導覽（§4）', () => {
  it('跨年進退正確', () => {
    s().setMonth(2026, 11);
    s().goMonth(1);
    expect([s().year, s().month]).toEqual([2027, 0]);
    s().goMonth(-1);
    expect([s().year, s().month]).toEqual([2026, 11]);
  });

  it('§15.1-4：選到天數較少的月份時自動夾到月底，不可出現 2/31', () => {
    s().setMonth(2026, 0);
    s().selectDay(31);
    expect(s().selectedDay).toBe(31);

    s().setMonth(2026, 1);              // 2 月
    expect(s().selectedDay).toBe(28);
    expect(selectedDate(s())).toBe('2026-02-28');
  });

  it('goMonth 也會夾日', () => {
    s().setMonth(2026, 0);
    s().selectDay(31);
    s().goMonth(1);                      // → 2 月
    expect(s().selectedDay).toBe(28);
  });
});

describe('紀錄操作', () => {
  const addOne = async (date = '2026-09-05', cents = 520) => {
    const c = s().categories.find((x) => x.name === '外食')!;
    await s().addTxn({
      date, mainId: c.id, subId: c.subs[0]!.id,
      amountCents: cents, currency: 'CAD', actualCadCents: cents, by: '我', note: '咖啡',
    });
  };

  it('新增後 store 立刻拿得到（樂觀更新）', async () => {
    await addOne();
    expect(s().txns).toHaveLength(1);
  });

  it('§15.1-6：金額 0 不寫入', async () => {
    const c = s().categories.find((x) => x.name === '外食')!;
    await s().addTxn({
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 0, currency: 'CAD', actualCadCents: 0, by: '我', note: '',
    });
    expect(s().txns).toHaveLength(0);
  });

  it('刪除後從 store 消失', async () => {
    await addOne();
    await s().deleteTxn(s().txns[0]!.id);
    expect(s().txns).toHaveLength(0);
  });
});

describe('分類操作', () => {
  it('改名後 store 反映新名稱', async () => {
    const c = s().categories.find((x) => x.name === '外食')!;
    await s().saveCategory({ ...c, name: '餐飲' });
    expect(s().categories.find((x) => x.id === c.id)!.name).toBe('餐飲');
  });

  it('假刪後 active 為 false 但分類還在', async () => {
    const c = s().categories.find((x) => x.name === '娛樂')!;
    await s().deleteCategory(c.id);
    expect(s().categories.find((x) => x.id === c.id)!.active).toBe(false);
  });
});

describe('開關（§7.3）', () => {
  it('每筆顯示記帳人預設開啟，可切換', async () => {
    expect(s().showWhoTags).toBe(true);
    await s().toggleWhoTags();
    expect(s().showWhoTags).toBe(false);
  });

  it('I9：切換會持久化到 meta，重新 load() 仍保留（不是每次啟動都重置成 true）', async () => {
    expect(s().notifyOnPartnerEntry).toBe(true);
    await s().toggleNotify();
    expect(s().notifyOnPartnerEntry).toBe(false);

    useLedger.setState({ ready: false, categories: [], txns: [] });
    await s().load();

    expect(s().notifyOnPartnerEntry).toBe(false);
  });
});
