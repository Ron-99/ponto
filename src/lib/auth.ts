import { createHmac, timingSafeEqual } from "node:crypto";

// Usado tanto pelo proxy quanto pelas Server Actions; por isso não importa "server-only".

export const SESSION_COOKIE = "ponto_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano: o ponto é usado todo dia

const password = () => process.env.APP_PASSWORD ?? "";

/** Sem APP_PASSWORD (uso local) o app fica aberto. */
export const authEnabled = () => password() !== "";

const hmac = (value: string) => createHmac("sha256", password()).update(value).digest("hex");

/** Token da sessão: derivado da senha, então trocar a senha invalida as sessões. */
export const sessionToken = () => hmac("ponto-session-v1");

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export const isValidSession = (token: string | undefined) =>
  !authEnabled() || (token !== undefined && safeEqual(token, sessionToken()));

/** Compara os HMACs (tamanho fixo) para não vazar o tamanho da senha. */
export const checkPassword = (input: string) =>
  authEnabled() && safeEqual(hmac(input), hmac(password()));
