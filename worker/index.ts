/**
 * 登入用的小型雲端端點（Cloudflare Worker）。
 *
 * 為什麼需要它：Google 規定「網頁應用程式」類型的用戶端，拿授權碼換 token、
 * 用 refresh token 續期時都必須附上用戶端密碼，而密碼不能放進手機或網站裡
 * （GitHub Pages 是純靜態，任何人都看得到）。這支程式只做兩件事，密碼只存在
 * 它的環境變數（wrangler secret），永遠不會回傳給瀏覽器。
 *
 *   POST /auth/exchange { code, origin }   → { access_token, expires_in, refresh_token?, scope }
 *   POST /auth/refresh  { refresh_token }  → { access_token, expires_in, scope }
 *
 * refresh token 本身交給 App 保管（存在手機的 IndexedDB）：GitHub Pages 與這支
 * Worker 不同網域，跨網站 cookie 在 Safari 一律被擋，做不成伺服器端的會話。
 * 之後整個 App 搬到同一個網域時，可以改成 Worker 自己保管、瀏覽器只拿一個會話 id。
 */

export type Env = {
  /** wrangler secret put GOOGLE_CLIENT_SECRET */
  GOOGLE_CLIENT_SECRET: string;
  /** 跟 App 用的是同一個用戶端 ID（公開資訊） */
  GOOGLE_CLIENT_ID: string;
  /** 允許呼叫的來源，逗號分隔，例如 https://could562073.github.io,http://localhost:5173 */
  ALLOWED_ORIGINS: string;
};

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * 彈出視窗的授權碼要換 token 時，redirect_uri 該填什麼，兩份官方文件與實作說法不一：
 * JavaScript 參考說「預設是呼叫頁面的來源」，實際可行的範例則說只有 'postmessage' 會過。
 * 與其賭一邊，先用 postmessage，被判定不符時改用來源網址再試一次。
 */
const REDIRECT_FALLBACKS = ['postmessage'] as const;

function allowed(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const ok = origin !== null && allowed(env).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

type GoogleToken = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function postToGoogle(
  fetchImpl: typeof fetch,
  params: Record<string, string>
): Promise<{ status: number; body: GoogleToken }> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const body = (await res.json()) as GoogleToken;
  return { status: res.status, body };
}

/** 用授權碼換 token。redirect_uri 先試 postmessage，被判定不符時改用頁面來源 */
async function exchange(
  fetchImpl: typeof fetch,
  env: Env,
  code: string,
  origin: string
): Promise<{ status: number; body: GoogleToken }> {
  const candidates = [...REDIRECT_FALLBACKS, origin];
  let last: { status: number; body: GoogleToken } | null = null;
  for (const redirectUri of candidates) {
    const r = await postToGoogle(fetchImpl, {
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (r.status === 200) return r;
    last = r;
    // 只有「重新導向網址不符」才值得換一個再試；其他錯誤（授權碼過期、密碼不對）再試也一樣
    const mismatch = r.body.error === 'redirect_uri_mismatch'
      || (r.body.error_description ?? '').toLowerCase().includes('redirect_uri');
    if (!mismatch) break;
  }
  return last!;
}

async function refresh(
  fetchImpl: typeof fetch,
  env: Env,
  refreshToken: string
): Promise<{ status: number; body: GoogleToken }> {
  return postToGoogle(fetchImpl, {
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
}

/** 把 Google 的回應整理成 App 要的形狀；密碼與其他欄位一律不外流 */
function reply(r: { status: number; body: GoogleToken }, headers: Record<string, string>): Response {
  if (r.status !== 200 || !r.body.access_token) {
    return json({ error: r.body.error ?? 'token_request_failed', detail: r.body.error_description ?? '' }, 502, headers);
  }
  return json({
    access_token: r.body.access_token,
    expires_in: r.body.expires_in ?? 3600,
    ...(r.body.refresh_token ? { refresh_token: r.body.refresh_token } : {}),
    scope: r.body.scope ?? '',
  }, 200, headers);
}

export async function handle(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = cors(origin, env);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
  // 只接受自己 App 的網址：這支端點握有密碼，不能變成任何人都能用的換 token 服務
  if (origin === null || !allowed(env).includes(origin)) return json({ error: 'origin_not_allowed' }, 403, headers);

  const path = new URL(request.url).pathname;
  let body: { code?: string; refresh_token?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json' }, 400, headers);
  }

  if (path === '/auth/exchange') {
    if (!body.code) return json({ error: 'missing_code' }, 400, headers);
    return reply(await exchange(fetchImpl, env, body.code, origin), headers);
  }
  if (path === '/auth/refresh') {
    if (!body.refresh_token) return json({ error: 'missing_refresh_token' }, 400, headers);
    return reply(await refresh(fetchImpl, env, body.refresh_token), headers);
  }
  return json({ error: 'not_found' }, 404, headers);
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
