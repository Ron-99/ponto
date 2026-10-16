"use client";

import { cn } from "cn";
import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const LINKS = [
  { href: "/", label: "Painel" },
  { href: "/relatorio", label: "Banco de horas" },
  { href: "/config", label: "Configurações" },
] as const;

export function Nav({ canLogout }: { canLogout: boolean }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
            pathname === l.href && "bg-muted font-medium text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
      {canLogout && (
        <form action={logout}>
          <button
            type="submit"
            aria-label="Sair"
            title="Sair"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOutIcon className="size-4" />
          </button>
        </form>
      )}
    </nav>
  );
}
