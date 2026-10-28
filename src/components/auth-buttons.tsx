"use client";
import { signIn, signOut } from "next-auth/react";
export function LoginButton() {
  return (
    <button
      onClick={() => void signIn("github", { callbackUrl: "/dashboard" })}
    >
      Entrar com GitHub →
    </button>
  );
}
export function LogoutButton() {
  return (
    <button
      className="secondary"
      onClick={() => void signOut({ callbackUrl: "/entrar" })}
    >
      Sair da conta
    </button>
  );
}
