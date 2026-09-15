import 'fake-indexeddb/auto';
// jest-dom 一直在 devDependencies 裡但沒有被接上，於是 toHaveTextContent 這類
// matcher 會以 "Invalid Chai property" 失敗——那是個看起來像測試寫錯、實際是
// 環境沒裝好的錯誤訊息。接上它，順便讓型別擴充生效。
import '@testing-library/jest-dom/vitest';

/*
 * jsdom 完全沒有 Pointer Capture API——不是回傳 false，是連方法都不存在，
 * 所以 useDragGesture 接管手勢時會以 "setPointerCapture is not a function" 炸掉，
 * 看起來像元件寫錯、實際是環境缺 API。補上三個 no-op，讓跟手邏輯在 jsdom 下跑得完。
 * 真正的捕捉行為（會不會擋到底下元素的 click）仍然只有瀏覽器測得出來，
 * 那部分在 e2e/gesture.spec.ts 與其他 e2e spec（原本的手動清單已改成自動測試）。
 */
if (!Element.prototype.setPointerCapture) {
  const captured = new WeakMap<Element, Set<number>>();
  Element.prototype.setPointerCapture = function (id: number) {
    const s = captured.get(this) ?? new Set<number>();
    s.add(id);
    captured.set(this, s);
  };
  Element.prototype.releasePointerCapture = function (id: number) {
    captured.get(this)?.delete(id);
  };
  Element.prototype.hasPointerCapture = function (id: number) {
    return captured.get(this)?.has(id) ?? false;
  };
}
