import { describe, it, expect, vi, afterEach } from 'vitest';
import { EASE, DUR, d, prefersReducedMotion } from './motion';

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
    expect(DUR.keyPress).toBe(140);      // #3
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
