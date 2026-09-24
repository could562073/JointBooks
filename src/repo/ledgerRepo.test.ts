import { describe, it, expect, beforeEach } from 'vitest';
import { ledgerRepo, type NewTxnInput } from './ledgerRepo';
import { db, resetDb } from '../db/schema';
import { totalsIn } from '../domain/aggregate';
import { rangeOf } from '../domain/date';
import type { Category } from '../domain/types';

let cats: Category[];
const cat = (name: string) => cats.find((c) => c.name === name)!;

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
  cats = await ledgerRepo.listCategories();
});

describe('bootstrap', () => {
  it('第一次啟動寫入預設分類', () => {
    expect(cats).toHaveLength(7);
  });

  it('重複呼叫不會重複寫入', async () => {
    await ledgerRepo.bootstrap();
    expect(await db.categories.count()).toBe(7);
  });

  it('I5：併發呼叫不會各自讀到 0 筆而重複寫入（React StrictMode 會讓 effect 跑兩次）', async () => {
    await resetDb();   // 這個測試要從真正的空庫開始，不能沿用 beforeEach 已寫入的 7 筆
    await Promise.all([ledgerRepo.bootstrap(), ledgerRepo.bootstrap()]);
    expect(await db.categories.count()).toBe(7);
  });
});

describe('addTxn', () => {
  it('寫入時快照分類名稱（增補檔 C-1）', async () => {
    const c = cat('外食');
    const t = await ledgerRepo.addTxn({
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 520, currency: 'CAD', actualCadCents: 520, by: '我', note: '咖啡',
    });
    expect(t!.mainName).toBe('外食');
    expect(t!.subName).toBe('飲料');
    expect(t!.deleted).toBe(false);
    expect(t!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(t!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('§15.1-6：金額為 0 不寫入', async () => {
    const c = cat('外食');
    const t = await ledgerRepo.addTxn({
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 0, currency: 'CAD', actualCadCents: 0, by: '我', note: '',
    });
    expect(t).toBeNull();
    expect(await db.txns.count()).toBe(0);
  });

  it('每筆寫入都排進 outbox', async () => {
    const c = cat('外食');
    await ledgerRepo.addTxn({
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 520, currency: 'CAD', actualCadCents: 520, by: '我', note: '',
    });
    const box = await db.outbox.toArray();
    expect(box).toHaveLength(1);
    expect(box[0]!.op).toBe('add');
    expect(box[0]!.serverRowId).toBeNull();
  });
});

describe('updateTxn / deleteTxn', () => {
  const seed = async () => {
    const c = cat('外食');
    return (await ledgerRepo.addTxn({
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 520, currency: 'CAD', actualCadCents: 520, by: '我', note: '咖啡',
    }))!;
  };

  it('§15.1-10b：改日期後紀錄落在新日期', async () => {
    const t = await seed();
    const u = await ledgerRepo.updateTxn(t.id, { date: '2026-09-08' });
    expect(u.date).toBe('2026-09-08');
    expect((await ledgerRepo.listTxns()).find((x) => x.id === t.id)!.date).toBe('2026-09-08');
  });

  it('改分類時重新快照名稱', async () => {
    const t = await seed();
    const m = cat('超市');
    const u = await ledgerRepo.updateTxn(t.id, { mainId: m.id, subId: m.subs[0]!.id });
    expect(u.mainName).toBe('超市');
    expect(u.subName).toBe('食材');
  });

  it('updatedAt 每次更新都往前推，createdAt 永不變動（I8）', async () => {
    const t = await seed();
    await new Promise((r) => setTimeout(r, 2));
    const u = await ledgerRepo.updateTxn(t.id, { note: '拿鐵' });
    expect(u.updatedAt > t.updatedAt).toBe(true);
    expect(u.createdAt).toBe(t.createdAt);
  });

  it('分類被改名後，任何編輯都捕捉新名稱', async () => {
    const t = await seed();
    // 改分類名稱（模擬 saveCategory）
    const cats = await ledgerRepo.listCategories();
    const foodCat = cats.find((c) => c.name === '外食')!;
    foodCat.name = '餐飲';
    await ledgerRepo.saveCategory(foodCat);

    // 編輯不相關的欄位
    const u = await ledgerRepo.updateTxn(t.id, { note: '新備註' });

    // 應該捕捉新名稱
    expect(u.mainName).toBe('餐飲');
    expect(u.note).toBe('新備註');
  });

  it('刪紀錄是軟刪，列還在但不出現在 listTxns', async () => {
    const t = await seed();
    await ledgerRepo.deleteTxn(t.id);
    expect((await db.txns.get(t.id))!.deleted).toBe(true);
    expect(await ledgerRepo.listTxns()).toHaveLength(0);
  });

  it('改為非 CAD 幣別但未供給 actualCadCents 時拋錯', async () => {
    const t = await seed();
    await expect(
      ledgerRepo.updateTxn(t.id, { currency: 'TWD' })
    ).rejects.toThrow(/非 CAD 幣別下變更幣別或金額時必須供給 actualCadCents/);
  });

  it('改為非 CAD 幣別且供給 actualCadCents 時成功', async () => {
    const t = await seed();
    const u = await ledgerRepo.updateTxn(t.id, {
      currency: 'TWD',
      actualCadCents: 250,
      amountCents: 7500,
    });
    expect(u.currency).toBe('TWD');
    expect(u.amountCents).toBe(7500);
    expect(u.actualCadCents).toBe(250);
  });

  it('I3：幣別本來就非 CAD，只改金額卻不給 actualCadCents 時拋錯（guard 不能只看 patch.currency）', async () => {
    const t = await seed();
    // 先讓它變成一筆 TWD 紀錄：128000 原幣、實扣 5720
    await ledgerRepo.updateTxn(t.id, { currency: 'TWD', amountCents: 128_000, actualCadCents: 5_720 });

    await expect(
      ledgerRepo.updateTxn(t.id, { amountCents: 200_000 })
    ).rejects.toThrow(/非 CAD 幣別下變更幣別或金額時必須供給 actualCadCents/);

    // 拋錯前的值必須維持不變，不能留下半套更新
    const stillOld = (await ledgerRepo.listTxns()).find((x) => x.id === t.id)!;
    expect(stillOld.amountCents).toBe(128_000);
    expect(stillOld.actualCadCents).toBe(5_720);
  });

  it('I3：幣別本來就非 CAD，改金額同時供給 actualCadCents 時成功', async () => {
    const t = await seed();
    await ledgerRepo.updateTxn(t.id, { currency: 'TWD', amountCents: 128_000, actualCadCents: 5_720 });

    const u = await ledgerRepo.updateTxn(t.id, { amountCents: 200_000, actualCadCents: 8_940 });
    expect(u.amountCents).toBe(200_000);
    expect(u.actualCadCents).toBe(8_940);
  });

  it('I2：分類被硬刪後，更新不相關欄位不會把名稱快照清空', async () => {
    const c = cat('外食');
    const t = await seed();
    await db.categories.delete(c.id);   // 模擬分類被硬刪 / id 從此查不到

    const u = await ledgerRepo.updateTxn(t.id, { note: '換備註' });

    expect(u.mainName).toBe('外食');
    expect(u.subName).toBe('飲料');
    expect(u.note).toBe('換備註');
  });

  it('deleteCategory 找不到時無聲返回（冪等）', async () => {
    await expect(ledgerRepo.deleteCategory('nope')).resolves.toBeUndefined();
  });

  it('updateTxn 找不到時拋錯', async () => {
    await expect(
      ledgerRepo.updateTxn('nope', { note: 'x' })
    ).rejects.toThrow(/找不到紀錄 nope/);
  });
});

describe('分類刪除（§15.1-13、§15.1-14）', () => {
  const seedThree = async () => {
    const c = cat('外食');
    for (const d of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      await ledgerRepo.addTxn({
        date: d, mainId: c.id, subId: c.subs[0]!.id,
        amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000, by: '我', note: '',
      });
    }
    return c;
  };

  it('countTxnsOf 回傳確認窗要顯示的 N', async () => {
    const c = await seedThree();
    expect(await ledgerRepo.countTxnsOf(c.id)).toBe(3);
  });

  it('假刪後：不出現在選單，但歷史紀錄與統計金額完全不變', async () => {
    const c = await seedThree();
    const range = rangeOf('month', '2026-09-02');
    const before = totalsIn(await ledgerRepo.listTxns(), range, await ledgerRepo.listCategories());
    // Minor 8：先確認 before 不是零，否則 after === before 這個 assert 就算兩邊都是 0 也會過
    expect(before.expenseCents).toBe(3_000);

    await ledgerRepo.deleteCategory(c.id);

    const after = totalsIn(await ledgerRepo.listTxns(), range, await ledgerRepo.listCategories());
    expect(after.expenseCents).toBe(before.expenseCents);
    expect(await ledgerRepo.listTxns()).toHaveLength(3);

    const cs = await ledgerRepo.listCategories();
    expect(cs.find((x) => x.id === c.id)!.active).toBe(false);
  });
});

describe('listTxns', () => {
  it('可帶 Range 篩選，且不回傳軟刪的列', async () => {
    const c = cat('外食');
    for (const d of ['2026-08-31', '2026-09-01', '2026-10-01']) {
      await ledgerRepo.addTxn({
        date: d, mainId: c.id, subId: c.subs[0]!.id,
        amountCents: 100, currency: 'CAD', actualCadCents: 100, by: '我', note: '',
      });
    }
    const rows = await ledgerRepo.listTxns(rangeOf('month', '2026-09-15'));
    expect(rows.map((r) => r.date)).toEqual(['2026-09-01']);
  });
});

describe('稅', () => {
  // cat() 與 cats 是這個檔案 beforeEach 已經準備好的，直接用
  const input = (over: Partial<NewTxnInput> = {}): NewTxnInput => {
    const c = cat('外食');
    return {
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 4_872, currency: 'CAD', actualCadCents: 4_872, by: '我', note: '',
      ...over,
    };
  };

  it('新增時存得進去', async () => {
    const t = await ledgerRepo.addTxn(input({ taxCents: 285 }));
    expect(t!.taxCents).toBe(285);
    expect((await ledgerRepo.listTxns())[0]!.taxCents).toBe(285);
  });

  it('編輯時改得掉', async () => {
    const t = await ledgerRepo.addTxn(input({ taxCents: 285 }));
    const next = await ledgerRepo.updateTxn(t!.id, { taxCents: 100 });
    expect(next.taxCents).toBe(100);
  });

  // 編輯一筆本來有稅的帳、把稅刪掉：patch 帶的是 undefined，舊值不能留著
  it('編輯時清得掉', async () => {
    const t = await ledgerRepo.addTxn(input({ taxCents: 285 }));
    const next = await ledgerRepo.updateTxn(t!.id, { taxCents: undefined });
    expect(next.taxCents).toBeUndefined();
  });
});

describe('舊的外幣紀錄編輯後轉成 CAD', () => {
  it('金額與實扣一致，幣別變成 CAD', async () => {
    const c = cat('外食');
    const t = await ledgerRepo.addTxn({
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800, by: '我', note: '',
    });

    // 面板送出的 patch：一律 CAD，金額與實扣都是含稅合計
    const next = await ledgerRepo.updateTxn(t!.id, {
      amountCents: 5_800, currency: 'CAD', actualCadCents: 5_800, taxCents: undefined,
    });

    expect(next.currency).toBe('CAD');
    expect(next.amountCents).toBe(5_800);
    expect(next.actualCadCents).toBe(5_800);
  });
});
