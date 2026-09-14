import { describe, it, expect } from 'vitest';
import { routeOf } from './route';

describe('routeOf', () => {
  it('/join 帶著 query 一起交出去', () => {
    expect(routeOf('/join', '?sid=S&t=1.a')).toEqual({ kind: 'join', search: '?sid=S&t=1.a' });
  });

  it('其他都是主程式（包含舊的 /auth/callback，登入已不走導回流程）', () => {
    expect(routeOf('/', '')).toEqual({ kind: 'app' });
    expect(routeOf('/index.html', '')).toEqual({ kind: 'app' });
    expect(routeOf('/join/extra', '')).toEqual({ kind: 'app' });
    expect(routeOf('/auth/callback', '?code=c')).toEqual({ kind: 'app' });
  });
});

describe('routeOf 部署在子路徑（GitHub Pages）', () => {
  it('/JointBooks/join 是接受邀請頁', () => {
    expect(routeOf('/JointBooks/join', '?sid=S&t=1.a', '/JointBooks/')).toEqual({ kind: 'join', search: '?sid=S&t=1.a' });
  });

  it('/JointBooks/ 與沒有結尾斜線的 /JointBooks 都是主程式', () => {
    expect(routeOf('/JointBooks/', '', '/JointBooks/')).toEqual({ kind: 'app' });
    expect(routeOf('/JointBooks', '', '/JointBooks/')).toEqual({ kind: 'app' });
  });

  it('子路徑以外的 /join 不算（不是這個 App 的網址）', () => {
    expect(routeOf('/join', '?sid=S', '/JointBooks/')).toEqual({ kind: 'app' });
  });
});
