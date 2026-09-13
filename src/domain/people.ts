import type { Person } from './types';

/*
 * 明細的 by 欄位存的是「帳本裡的哪一位」，不是「這台裝置的人」：
 * 「我」是建立帳本的人，「妻」是用邀請連結加入的人。顯示用的名稱在 domain/members。
 */

export function otherPerson(p: Person): Person {
  return p === '我' ? '妻' : '我';
}

/** 配置頁成員列的身分：建立帳本的是擁有者，加入的人可編輯 */
export function roleLabel(p: Person): string {
  return p === '我' ? '擁有者' : '可編輯';
}
