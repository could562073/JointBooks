import { canRetry, delayFor, isRetryable } from '../sync/backoff';

export type Fetcher = typeof fetch;

export type SheetsClientDeps = {
  /** 取目前的 access token；過期時由呼叫端負責先續期 */
  token(): Promise<string>;
  fetch?: Fetcher;
  sleep?(ms: number): Promise<void>;
};

export class SheetsError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`Sheets API ${status}`);
    this.name = 'SheetsError';
  }
}

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3';

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * §14.5：所有寫入要 exponential backoff 重試（429／5xx），最多 5 次。
 *
 * 讀取一起走同一條路：讀被 429 擋掉跟寫被擋掉一樣需要退避，而且輪詢
 * （每 60 秒一次）正是最容易撞到配額的來源。
 */
export function createSheetsClient(deps: SheetsClientDeps) {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? wait;

  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    let attempts = 0;

    for (;;) {
      const token = await deps.token();
      const res = await doFetch(url, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) return (await res.json()) as T;

      const body = await res.text().catch(() => '');
      if (!isRetryable(res.status) || !canRetry(attempts)) {
        throw new SheetsError(res.status, body);
      }

      attempts += 1;
      await sleep(delayFor(attempts));
    }
  }

  return {
    /** §14.3：建立帳本 = 在使用者硬碟建立一份 Spreadsheet */
    async createSpreadsheet(title: string, sheetTitles: readonly string[]): Promise<string> {
      const r = await call<{ spreadsheetId: string }>(API, {
        method: 'POST',
        body: JSON.stringify({
          properties: { title },
          sheets: sheetTitles.map((t) => ({ properties: { title: t } })),
        }),
      });
      return r.spreadsheetId;
    },

    /** §14.5：新增一次一列，不要先讀再寫整表 */
    async append(spreadsheetId: string, range: string, rows: readonly (readonly string[])[]) {
      const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append`
        + '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
      return call<{ updates: { updatedRange: string } }>(url, {
        method: 'POST',
        body: JSON.stringify({ values: rows }),
      });
    },

    async get(spreadsheetId: string, range: string): Promise<string[][]> {
      const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const r = await call<{ values?: string[][] }>(url);
      return r.values ?? [];
    },

    async update(spreadsheetId: string, range: string, rows: readonly (readonly string[])[]) {
      const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
      return call<unknown>(url, { method: 'PUT', body: JSON.stringify({ values: rows }) });
    },

    /**
     * 找這個使用者雲端硬碟裡、這個 App 建過的帳本（名稱是其中之一的試算表），最近改過的在前。
     * 傳多個名稱是為了連改名前建的帳本一起找到。
     * drive.file 權限只看得到這個 App 自己建或開過的檔案，剛好就是要找的範圍。
     */
    async findLedgers(titles: readonly string[]): Promise<{ id: string; ownedByMe: boolean }[]> {
      const names = titles
        .map((t) => `name = '${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
        .join(' or ');
      const params = new URLSearchParams({
        q: `(${names}) and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: 'files(id,ownedByMe)',
        orderBy: 'modifiedTime desc',
        pageSize: '10',
      });
      const r = await call<{ files?: { id: string; ownedByMe?: boolean }[] }>(`${DRIVE}/files?${params}`);
      return (r.files ?? []).map((f) => ({ id: f.id, ownedByMe: f.ownedByMe === true }));
    },

    /** §8.1-7：加入時 drive.permissions.create（role writer、type user） */
    async shareWith(spreadsheetId: string, email: string) {
      return call<unknown>(`${DRIVE}/files/${spreadsheetId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }),
      });
    },
  };
}

export type SheetsClient = ReturnType<typeof createSheetsClient>;
