/**
 * 這一頁是按上一頁／下一頁回來的（iPhone 從左緣右滑也算），不是點連結或輸入網址打開的。
 *
 * 接受邀請頁要用：已經在帳本裡的手機右滑回到舊的邀請頁時，應該直接回主程式（使用者回報）。
 */
export function arrivedByHistory(): boolean {
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === 'back_forward';
}

/** 換頁但不留歷史紀錄。包一層是為了測試看得到導去哪裡（jsdom 不會真的換頁） */
export function replaceLocation(url: string): void {
  location.replace(url);
}
