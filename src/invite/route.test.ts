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
