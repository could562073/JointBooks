import { describe, it, expect } from 'vitest';
import { appPath, appRoot } from './basePath';

describe('部署子路徑', () => {
  it('開發時（base 是 /）', () => {
    expect(appPath('', '/')).toBe('/');
    expect(appPath('join', '/')).toBe('/join');
    expect(appRoot('http://localhost:5173', '/')).toBe('http://localhost:5173');
  });

  it('GitHub Pages 的專案網站（base 是 /JointBooks/）', () => {
    expect(appPath('', '/JointBooks/')).toBe('/JointBooks/');
    expect(appPath('join', '/JointBooks/')).toBe('/JointBooks/join');
    expect(appPath('/join', '/JointBooks/')).toBe('/JointBooks/join');
    expect(appRoot('https://could562073.github.io', '/JointBooks/')).toBe('https://could562073.github.io/JointBooks');
  });
});
