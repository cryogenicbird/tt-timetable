import {request} from './client';

export interface AuthParams {
  username: string;
  password: string;
}

export interface LoginData {
  code: number;
  message?: string;
  token?: string;
}

export interface RegisterData {
  code: number;
  message?: string;
}

export const authApi = {
  login(params: AuthParams) {
    return request<LoginData>('/login', {
      method: 'POST',
      body: JSON.stringify(params),
      auth: 'none',
    });
  },

  register(params: AuthParams) {
    return request<RegisterData>('/register', {
      method: 'POST',
      body: JSON.stringify(params),
      auth: 'none',
    });
  },
};
