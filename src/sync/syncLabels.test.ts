import { describe, it, expect } from 'vitest';
import { agoLabel, syncLabel } from './syncLabels';

const NOW = 1_000_000_000;
const ago = (sec: number) => NOW - sec * 1000;

describe('agoLabel', () => {
  it('沒同步過', () => {
    expect(agoLabel(null, NOW)).toBe('尚未同步');
  });

  it('一分鐘內是「剛剛」', () => {
    expect(agoLabel(NOW, NOW)).toBe('剛剛');
    expect(agoLabel(ago(59), NOW)).toBe('剛剛');
  });

  it('分鐘、小時、天', () => {
    expect(agoLabel(ago(60), NOW)).toBe('1 分鐘前');
    expect(agoLabel(ago(59 * 60), NOW)).toBe('59 分鐘前');
    expect(agoLabel(ago(60 * 60), NOW)).toBe('1 小時前');
    expect(agoLabel(ago(25 * 60 * 60), NOW)).toBe('1 天前');
  });

  it('時鐘倒退時不會顯示負數', () => {
    expect(agoLabel(NOW + 5000, NOW)).toBe('剛剛');
  });
});

describe('syncLabel', () => {
  it('同步中', () => {
    expect(syncLabel('syncing', NOW, NOW)).toBe('同步中…');
  });

  it('離線時明說資料還在這支手機上', () => {
    expect(syncLabel('offline', NOW, NOW)).toContain('已存在這支手機');
  });

  it('失敗時說會重試', () => {
    expect(syncLabel('error', NOW, NOW)).toContain('稍後重試');
  });

  it('完成時是「已同步 · 剛剛」（MOTION #26）', () => {
    expect(syncLabel('synced', NOW, NOW)).toBe('已同步 · 剛剛');
  });

  it('idle 也顯示上次同步時間', () => {
    expect(syncLabel('idle', ago(300), NOW)).toBe('已同步 · 5 分鐘前');
  });
});
