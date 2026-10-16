"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";

/** Só aceita caminhos internos, para não virar um redirecionador aberto. */
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") ? next : "/");

export async function login(password: string, next: string): Promise<{ error: string }> {
  if (!checkPassword(password)) {
    // Atraso simples para dificultar tentativa e erro.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Senha incorreta." };
  }
  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(safeNext(next));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
