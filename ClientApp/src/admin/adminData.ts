// קריאת וניקוי קוקי של אדמין - נפרדת מ-UserData של בית הספר

export interface AdminData {
  AdminId: string;
  FullName: string;
  UserName: string;
  Email: string;
}

const COOKIE_NAME = 'AdminData';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function readAdminData(): AdminData | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;
  const fields = new URLSearchParams(raw.replace(/&amp;/g, '&'));
  const ad: Partial<AdminData> = {};
  for (const key of ['AdminId', 'FullName', 'UserName', 'Email'] as const) {
    const v = fields.get(key);
    if (v !== null) ad[key] = decodeURIComponent(v);
  }
  if (!ad.AdminId) return null;
  return ad as AdminData;
}

export function clearAdminData(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
