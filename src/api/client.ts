import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://124.223.162.5:8080';
const TOKEN_KEY = 'user_token';

export type RequestAuth = 'none' | 'optional';

export interface RequestOptions extends RequestInit {
  /** 是否自动带上登录 token，默认 optional */
  auth?: RequestAuth;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  message?: string;
  code?: number;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(
  path: string,
  {auth = 'optional', ...init}: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);

  if (auth !== 'none') {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // FormData 由 RN 自动带 boundary，不能手动设 Content-Type
  if (typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE_URL}${path}`, {...init, headers});

  // 有些 401/500 不是 JSON，先读 text 再尝试解析
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  const message =
    data && typeof data === 'object' && typeof data.message === 'string'
      ? data.message
      : undefined;
  const code =
    data && typeof data === 'object' && typeof data.code === 'number'
      ? data.code
      : undefined;

  return {
    ok: res.ok,
    status: res.status,
    data: data as T | null,
    message,
    code,
  };
}
