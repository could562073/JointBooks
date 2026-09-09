import 'fake-indexeddb/auto';
// jest-dom 一直在 devDependencies 裡但沒有被接上，於是 toHaveTextContent 這類
// matcher 會以 "Invalid Chai property" 失敗——那是個看起來像測試寫錯、實際是
// 環境沒裝好的錯誤訊息。接上它，順便讓型別擴充生效。
import '@testing-library/jest-dom/vitest';
