import { describe, it, expect } from 'vitest';
import {
  areaPath, chartPoints, gridLines, HEADROOM, pathLength, polyline, seriesMax, VIEW,
} from './trendGeometry';

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

describe('chartPoints（原型 X = 8 + i·304/(n−1)、Y = 112 − v/(max·1.1)·98）', () => {
  it('沒有資料點時回空陣列', () => {
    expect(chartPoints([], 100)).toEqual([]);
  });

  it('第一點在 x=8、最後一點在 x=312', () => {
    const pts = chartPoints([0, 0, 0], 100);
    expect(pts[0]!.x).toBe(8);
    expect(pts[2]!.x).toBe(312);
  });

  it('只有一個點時擺在水平中央', () => {
    // 擺在左邊會看起來像圖表畫壞了
    expect(chartPoints([50], 100)[0]!.x).toBe(160);
  });

  it('0 落在 y=112；最大值上方留一成空間，不頂到最上面的格線', () => {
    const pts = chartPoints([0, 100], 100);
    expect(pts[0]!.y).toBe(112);
    expect(pts[1]!.y).toBeCloseTo(112 - 98 / HEADROOM, 5);
    expect(pts[1]!.y).toBeGreaterThan(gridLines()[0]!);
  });

  it('兩條線共用同一個刻度：同樣的值在兩次呼叫裡高度一致', () => {
    const max = seriesMax([100, 40], [60]);
    expect(chartPoints([60], max)[0]!.y).toBe(chartPoints([0, 60], max)[1]!.y);
  });

  it('max 是 0 時所有點貼在 0 的位置，不會除以零算出 NaN', () => {
    for (const p of chartPoints([0, 0, 0], 0)) expect(p.y).toBe(VIEW.zeroY);
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
  it('原型的三條：y = 14、56、98', () => {
    expect(gridLines()).toEqual([14, 56, 98]);
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
  it('從底部（y=120）出發、沿折線走、回到底部收尾', () => {
    const d = areaPath([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    expect(d).toBe('M10,120L10,20L30,40L30,120Z');
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
