import { describe, it, expect, vi, afterEach } from 'vitest';
import { EASE, DUR, d, prefersReducedMotion, easeOutCubic } from './motion';

describe('motion 常數', () => {
  it('四條 easing 逐字符合 §10 通則', () => {
    expect(EASE.enter).toBe('cubic-bezier(.2,.8,.2,1)');
    expect(EASE.move).toBe('cubic-bezier(.22,1,.36,1)');
    expect(EASE.sheet).toBe('cubic-bezier(.32,.72,0,1)');
    expect(EASE.exit).toBe('ease-out');
  });

  it('關鍵時長符合 §10 表格', () => {
    expect(DUR.sheetIn).toBe(340);       // #1
    expect(DUR.sheetOut).toBe(260);      // #2
    // #3：使用者要求按下與彈回都比 §10 的 140 快，放開時帶回彈
    expect(DUR.keyPress).toBe(80);
    expect(DUR.keyRelease).toBe(120);
    expect(DUR.riseIn).toBe(320);        // #4 #5 #17
    expect(DUR.riseStagger).toBe(35);    // #5
    expect(DUR.slide).toBe(420);         // #7 #8 #9 #10 #14 #32 #34
    expect(DUR.calSnap).toBe(340);       // #6 #13
    expect(DUR.countUp).toBe(900);       // #11 #31
    expect(DUR.dayTotal).toBe(480);      // §11-20
    expect(DUR.budgetFill).toBe(600);    // #12
    expect(DUR.budgetStagger).toBe(50);  // #12
    expect(DUR.popIn).toBe(240);         // #18 #20 #24 #38
    expect(DUR.dialogIn).toBe(220);      // #16 #37
    expect(DUR.scrimIn).toBe(180);       // #16 #37
    expect(DUR.cardSnap).toBe(380);      // #15
    expect(DUR.toggleKnob).toBe(220);    // #21
    expect(DUR.panelSnap).toBe(260);     // #22 #35
    expect(DUR.reduced).toBe(120);
  });

  it('離場比進場短約 20%', () => {
    expect(DUR.sheetOut / DUR.sheetIn).toBeCloseTo(0.76, 1);
  });

  it('先前缺漏的四個時長：外框淡出、同步脈動、年月面板、收支變色', () => {
    expect(DUR.outlineFade).toBe(120);   // #18 #38
    expect(DUR.syncPulse).toBe(2400);    // #25
    expect(DUR.yearPanelIn).toBe(260);   // #33
    expect(DUR.kindColor).toBe(280);     // #36

    // 這四個是各自獨立命名的常數——即使 outlineFade 恰好和 reduced 同值、
    // kindColor 恰好和 toastIn 同值，也不是同一個東西，未來不可互相借用，
    // 只能各自維護、各自比對規格。
    expect(DUR).toHaveProperty('outlineFade');
    expect(DUR).toHaveProperty('syncPulse');
    expect(DUR).toHaveProperty('yearPanelIn');
    expect(DUR).toHaveProperty('kindColor');
  });
});

describe('easeOutCubic', () => {
  it('p=0 時回傳 0（動畫起點）', () => {
    expect(easeOutCubic(0)).toBe(0);
  });

  it('p=1 時回傳 1（動畫終點）', () => {
    expect(easeOutCubic(1)).toBe(1);
  });

  it('p=0.5 時符合 1-(1-p)^3 的公式值', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 10);
  });
});

describe('reduced-motion 降級', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (reduced: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: reduced && q.includes('reduce'),
      media: q, addEventListener() {}, removeEventListener() {},
    }));

  it('未開啟時 d() 原樣回傳', () => {
    stub(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(d(420)).toBe(420);
  });

  it('開啟時所有時長降為 120', () => {
    stub(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(d(420)).toBe(120);
    expect(d(900)).toBe(120);
  });
});
