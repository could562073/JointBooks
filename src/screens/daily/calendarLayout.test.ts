import { describe, it, expect } from 'vitest';
import { CELL_H, cellPosition, heatColor, rowCount, sliderOffset } from './calendarLayout';

describe('cellPosition', () => {
  it('offset 0 時 1 號落在第一列第一格', () => {
    expect(cellPosition(0, 1)).toEqual({ col: 0, row: 0 });
  });

  it('offset 會把 1 號往右推', () => {
    expect(cellPosition(3, 1)).toEqual({ col: 3, row: 0 });
  });

  it('跨到下一列', () => {
    expect(cellPosition(0, 8)).toEqual({ col: 0, row: 1 });
    expect(cellPosition(3, 5)).toEqual({ col: 0, row: 1 });
  });

  it('每一列都剛好七格', () => {
    const cols = [1, 2, 3, 4, 5, 6, 7].map((d) => cellPosition(0, d).col);
    expect(cols).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(cellPosition(0, 7).row).toBe(0);
    expect(cellPosition(0, 8).row).toBe(1);
  });

  it('月底也對：offset 6 的 31 號', () => {
    expect(cellPosition(6, 31)).toEqual({ col: 1, row: 5 });
  });
});

describe('rowCount', () => {
  it('剛好塞滿四列', () => {
    expect(rowCount(0, 28)).toBe(4);
  });

  it('offset 讓 28 天要用到五列', () => {
    expect(rowCount(1, 28)).toBe(5);
  });

  it('會出現六列的月份，版面不能寫死五列', () => {
    expect(rowCount(6, 31)).toBe(6);
  });

  it('31 天從第一格開始是五列', () => {
    expect(rowCount(0, 31)).toBe(5);
  });
});

describe('heatColor', () => {
  it('ratio 0 是規格的下限 .14', () => {
    expect(heatColor(0)).toBe('rgba(183,166,229,0.14)');
  });

  it('ratio 1 是 .14 + .44 = .58', () => {
    expect(heatColor(1)).toBe('rgba(183,166,229,0.58)');
  });

  it('中間值線性內插', () => {
    expect(heatColor(0.5)).toBe('rgba(183,166,229,0.36)');
  });

  it('超出範圍的 ratio 會被夾住，不會算出無效的 alpha', () => {
    expect(heatColor(-3)).toBe('rgba(183,166,229,0.14)');
    expect(heatColor(9)).toBe('rgba(183,166,229,0.58)');
  });
});

describe('sliderOffset', () => {
  it('欄轉成七分之一寬的百分比，列轉成格高的倍數', () => {
    expect(sliderOffset({ col: 0, row: 0 })).toEqual({ left: '0.0000%', top: '0px' });
    expect(sliderOffset({ col: 6, row: 2 })).toEqual({ left: '85.7143%', top: `${CELL_H * 2}px` });
  });
});
