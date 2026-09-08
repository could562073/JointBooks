/**
 * crypto.randomUUID() 只能在安全情境（HTTPS 或 localhost）下呼叫；
 * §15.3 的手機真機測試常在區網 HTTP 下進行，此時它會直接拋錯（Minor 10）。
 * 這裡的備援不需要密碼學等級的隨機性，只求同一裝置內不重複。
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // 不安全情境（非 HTTPS）下降級為下面的備援
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
