import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCategories } from '../domain/categories';
import { InvitePanel } from '../invite/InvitePanel';
import { EntrySheet } from '../screens/entry/EntrySheet';
import { useBackToClose } from './useBackToClose';

function Panel({ onClose }: { onClose(): void }) {
  useBackToClose(onClose);
  return <div data-testid="panel" />;
}

/** 模擬按返回：歷史紀錄回到開面板之前那一格，瀏覽器發出 popstate */
function pressBack(): void {
  window.history.replaceState({}, '');
  window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
}

const tick = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  // 減少動態效果：面板關閉不播動畫，直接呼叫 onClose，測試不必等 260ms
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('返回鍵／右滑先關面板', () => {
  it('打開時佔一格歷史紀錄；按返回就關面板', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.history.state?.jbLayer).toBeTruthy();

    pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('用按鈕關掉（卸載）時自己退掉那一格，不會多一格「上一頁」', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onClose = vi.fn();
    const { unmount } = render(<Panel onClose={onClose} />);
    unmount();
    await tick();
    expect(back).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('按返回關掉的：不再多退一格（否則會離開 App）', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { unmount } = render(<Panel onClose={() => {}} />);
    pressBack();
    unmount();
    await tick();
    expect(back).not.toHaveBeenCalled();
  });

  it('開發模式（StrictMode）掛兩次：只佔一格，也不會一打開就被自己關掉', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<StrictMode><Panel onClose={onClose} /></StrictMode>);
    await tick();
    expect(push).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('記一筆面板：按返回就關', () => {
    const onClose = vi.fn();
    render(
      <EntrySheet
        categories={defaultCategories()}
        defaultDate="2026-09-14"
        onSave={() => {}}
        onDelete={() => {}}
        onClose={onClose}
        onAddMain={async () => ''}
        onAddSub={async () => ''}
      />
    );
    pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('邀請面板：按返回就關', () => {
    const onClose = vi.fn();
    render(<InvitePanel url={null} onClose={onClose} onPreview={() => {}} />);
    pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
