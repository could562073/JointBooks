import type { IconKey } from '../components/Icon';
import type { Category, CategoryKind, SubCategory, Txn } from './types';
import { NEW_CATEGORY_BUDGET_CENTS, NEW_CATEGORY_ICON } from './constants';

const uuid = () => crypto.randomUUID();

type Seed = {
  kind: CategoryKind;
  name: string;
  icon: IconKey;
  budgetCents: number | null;
  subs: string[];
};

/** §3 表格 + 增補檔 B-2 */
const SEEDS: Seed[] = [
  { kind: 'expense', name: '租屋', icon: 'house',  budgetCents: 210_000, subs: ['租屋'] },
  { kind: 'expense', name: '保險', icon: 'shield', budgetCents:  26_000, subs: ['保險'] },
  { kind: 'expense', name: '外食', icon: 'cup',    budgetCents:  45_000, subs: ['飲料', '外帶', '內用'] },
  { kind: 'expense', name: '超市', icon: 'basket', budgetCents:  80_000,
    subs: ['食材', '水果', '雜貨', '消耗品', '化妝品', '零食', '熟食', '稅'] },
  { kind: 'expense', name: '娛樂', icon: 'ticket', budgetCents:  20_000, subs: ['門票', '電影票'] },
  { kind: 'expense', name: '交通', icon: 'bus',    budgetCents:  18_000, subs: ['儲值', '單程票'] },
  // 收入固定用 coin（§3）；收入沒有預算（增補檔 B-2）
  { kind: 'income',  name: '收入', icon: 'coin',   budgetCents: null,
    subs: ['薪資', '退稅', '獎金', '其他'] },
];

export function defaultCategories(newId: () => string = uuid): Category[] {
  return SEEDS.map((s, i) => ({
    id: newId(),
    kind: s.kind,
    name: s.name,
    icon: s.icon,
    budgetCents: s.budgetCents,
    subs: s.subs.map((n) => ({ id: newId(), name: n })),
    colorSet: i,
    order: i,
    active: true,
  }));
}

export function makeCategory(args: {
  kind: CategoryKind;
  name: string;
  existingCount: number;
  newId?: () => string;
}): Category {
  const newId = args.newId ?? uuid;
  const name = args.name.trim();
  return {
    id: newId(),
    kind: args.kind,
    name,
    icon: NEW_CATEGORY_ICON,
    budgetCents: args.kind === 'income' ? null : NEW_CATEGORY_BUDGET_CENTS,
    subs: [{ id: newId(), name }],
    colorSet: args.existingCount,
    order: args.existingCount,
    active: true,
  };
}

/** 空白名稱視為取消，回傳原物件內容 */
export function renameCategory(c: Category, name: string): Category {
  const n = name.trim();
  return n ? { ...c, name: n } : { ...c };
}

export function setIcon(c: Category, icon: IconKey): Category {
  return { ...c, icon };
}

export function setBudget(c: Category, cents: number): Category {
  return { ...c, budgetCents: Math.max(0, Math.round(cents)) };
}

export function addSub(c: Category, name: string, newId: () => string = uuid): Category {
  const n = name.trim();
  if (!n || c.subs.some((s) => s.name === n)) return { ...c };
  const sub: SubCategory = { id: newId(), name: n };
  return { ...c, subs: [...c.subs, sub] };
}

/** §11-6：至少留一個，拒絕刪成空 */
export function removeSub(c: Category, subId: string): Category {
  if (c.subs.length <= 1) return { ...c };
  return { ...c, subs: c.subs.filter((s) => s.id !== subId) };
}

/** 假刪：歷史紀錄與統計金額完全不受影響（§15.1-14） */
export function softDelete(c: Category): Category {
  return { ...c, active: false };
}

/** 記帳選單可選的分類 */
export function selectable(cats: Category[], kind: CategoryKind): Category[] {
  return cats
    .filter((c) => c.kind === kind && c.active)
    .sort((a, b) => a.order - b.order);
}

/**
 * 增補檔 C-1：顯示一律以 id 解析當前名稱（→ 改名自動連動，含假刪的分類）；
 * 查不到才退回寫入時的名稱快照。
 */
export function resolveNames(cats: Category[], t: Txn): { main: string; sub: string } {
  const main = cats.find((c) => c.id === t.mainId);
  if (!main) return { main: t.mainName, sub: t.subName };
  const sub = main.subs.find((s) => s.id === t.subId);
  return { main: main.name, sub: sub?.name ?? t.subName };
}
