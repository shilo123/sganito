type Params = Record<string, string | number | boolean | null | undefined>;

function toFormBody(params?: Params): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  return usp.toString();
}

export async function ajax<T = unknown>(method: string, params?: Params): Promise<T> {
  const body = toFormBody(params);
  const res = await fetch(`/WebService.asmx/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json',
    },
    body,
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`${method} failed: ${res.status} ${res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json') || ct.includes('text/json')) {
    const parsed = await res.json();
    if (parsed && typeof parsed === 'object' && 'd' in parsed) {
      const d = (parsed as { d: unknown }).d;
      if (typeof d === 'string') {
        try { return JSON.parse(d) as T; } catch { return d as T; }
      }
      return d as T;
    }
    return parsed as T;
  }
  const text = await res.text();
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

export function ajaxAsync<T = unknown>(
  method: string,
  params: Params | undefined,
  cb: (data: T) => void,
  onError?: (err: unknown) => void,
): void {
  ajax<T>(method, params).then(cb).catch((e) => {
    if (onError) onError(e);
    else console.error(`${method} error`, e);
  });
}
