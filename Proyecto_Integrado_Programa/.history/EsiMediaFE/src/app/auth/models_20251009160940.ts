export interface UserDto {
  id: string;
  email: string;
  nombre?: string;
  role: 'USUARIO' | 'GESTOR_CONTENIDO' | 'ADMINISTRADOR';
}

export type MfaMethod = 'TOTP' | 'EMAIL_OTP' | 'NONE' | null;

export interface BackendLoginResponse {
  needMfa3: boolean;
  mfaMethod: MfaMethod;
  mfaToken: string | null;
  captchaToken: string | null;
  captchaImage: string | null;
  user?: UserDto;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MfaVerifyRequest {
  mfaToken: string;
  code: string;
}

export interface CaptchaVerifyRequest {
  captchaToken: string;
  answer: string;
}

export interface SimpleStatus {
  status: string;
}
