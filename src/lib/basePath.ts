/**
 * App 部署在哪個路徑底下。GitHub Pages 的專案網站在 /JointBooks/ 底下，開發時是 /。
 * 由 vite.config 的 base 決定，Vite 建置時注入 import.meta.env.BASE_URL（結尾一定是 /）。
 *
 * 站內的路徑一律經過這裡組，不要寫死 '/'、'/join'——部署到子路徑時會跳出 App。
 */
export const BASE_URL: string = import.meta.env.BASE_URL;

/** 站內路徑：appPath('join') 在 GitHub Pages 上是 '/JointBooks/join'，開發時是 '/join' */
export function appPath(sub = '', base: string = BASE_URL): string {
  return `${base}${sub.replace(/^\//, '')}`;
}

/** 邀請連結用的網址開頭，不含結尾的 /：'https://could562073.github.io/JointBooks' */
export function appRoot(origin: string, base: string = BASE_URL): string {
  return `${origin}${base}`.replace(/\/$/, '');
}
