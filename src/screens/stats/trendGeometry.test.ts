import { describe, it, expect } from 'vitest';
import {
  areaPath, chartPoints, gridLines, pathLength, polyline, seriesMax, VIEW,
} from './trendGeometry';

const BASELINE = VIEW.h - VIEW.padBottom;

describe('seriesMax', () => {
  it('取所有數列的最大值', () => {
    expect(seriesMax([1, 5, 3], [2, 9])).toBe(9);
  });

  it('全空時是 0，不是 -Infinity', () => {
    expect(seriesMax([], [])).toBe(0);
  });

  it('全是 0 時是 0', () => {
    expect(seriesMax([0, 0], [0])).toBe(0);
  });
});

describe('chartPoints', () => {
  it('沒有資料點時回空陣列', () => {
    expect(chartPoints([], 100)).toEqual([]);
  });

  it('第一點貼左緣、最後一點貼右緣', () => {
    const pts = chartPoints([0, 0, 0], 100);
    expect(pts[0]!.x).toBe(VIEW.padX);
    expect(pts[2]!.x).toBe(VIEW.w - VIEW.padX);
  });

  it('只有一個點時擺在水平中央', () => {
    // 擺在左邊會看起來像圖表畫壞了
    expect(chartPoints([50], 100)[0]!.x).toBe(VIEW.w / 2);
  });

  it('0 貼底線，最大值貼頂', () => {
    const pts = chartPoints([0, 100], 100);
    expect(pts[0]!.y).toBe(BASELINE);
    expect(pts[1]!.y).toBe(VIEW.padTop);
  });

  it('兩條線共用同一個刻度：同樣的值在兩次呼叫裡高度一致', () => {
    const max = seriesMax([100, 40], [60]);
    expect(chartPoints([60], max)[0]!.y).toBe(chartPoints([0, 60], max)[1]!.y);
  });

  it('max 是 0 時所有點貼底線，不會除以零算出 NaN', () => {
    const pts = chartPoints([0, 0, 0], 0);
    for (const p of pts) expect(p.y).toBe(BASELINE);
  });

  it('資料點多寡都撐滿寬度', () => {
    for (const n of [2, 7, 12, 31]) {
      const pts = chartPoints(Array(n).fill(0), 10);
      expect(pts[0]!.x).toBe(VIEW.padX);
      expect(pts[n - 1]!.x).toBe(VIEW.w - VIEW.padX);
    }
  });
});

describe('gridLines', () => {
  it('均分繪圖區的可用高度，含頂線與底線', () => {
    expect(gridLines(3)).toEqual([VIEW.padTop, VIEW.padTop + (BASELINE - VIEW.padTop) / 2, BASELINE]);
  });

  it('數量可調整', () => {
    expect(gridLines(2)).toEqual([VIEW.padTop, BASELINE]);
  });
});

describe('polyline', () => {
  it('組成 SVG 的 points 字串', () => {
    expect(polyline([{ x: 1, y: 2 }, { x: 3.456, y: 4 }])).toBe('1,2 3.46,4');
  });

  it('空陣列給空字串', () => {
    expect(polyline([])).toBe('');
  });
});

describe('areaPath', () => {
  it('從底線出發、沿折線走、回到底線收尾', () => {
    const d = areaPath([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    expect(d).toBe(`M10,${BASELINE}L10,20L30,40L30,${BASELINE}Z`);
  });

  it('少於兩個點時沒有面積可畫', () => {
    expect(areaPath([])).toBe('');
    expect(areaPath([{ x: 1, y: 2 }])).toBe('');
  });
});

describe('pathLength', () => {
  it('各段直線距離相加', () => {
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 14 }])).toBe(15);
  });

  it('少於兩個點時長度是 0', () => {
    expect(pathLength([])).toBe(0);
    expect(pathLength([{ x: 1, y: 1 }])).toBe(0);
  });
});
