export interface UserData {
  UserId: string;
  RoleId: string;
  ConfigurationId: string;
  UserName: string;
  HebDate: string;
  Name: string;
  SchoolId: string;
}

const COOKIE_NAME = 'UserData';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function readUserData(): UserData | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;
  const fields = new URLSearchParams(raw.replace(/&amp;/g, '&'));
  const ud: Partial<UserData> = {};
  for (const key of ['UserId', 'RoleId', 'ConfigurationId', 'UserName', 'HebDate', 'Name', 'SchoolId'] as const) {
    const v = fields.get(key);
    if (v !== null) ud[key] = decodeURIComponent(v);
  }
  if (!ud.UserId) return null;
  return ud as UserData;
}

export function clearUserData(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
