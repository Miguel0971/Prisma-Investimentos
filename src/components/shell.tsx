"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogoutButton } from "./auth-buttons";
const nav = [
  ["/dashboard", "◈", "Visão geral"],
  ["/mercado", "↗", "Mercado e ações"],
  ["/empresas", "▤", "Empresas e RI"],
  ["/laboratorio", "ƒ", "Laboratório de fórmulas"],
  ["/documentos", "▧", "Central de documentos"],
  ["/biblioteca", "▥", "Biblioteca"],
  ["/assistente", "✧", "Assistente de IA"],
  ["/configuracoes", "⚙", "Configurações"],
];
export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [light, setLight] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  return (
    <div
      className={`workspace ${light ? "light" : ""} ${collapsed ? "collapsed" : ""}`}
    >
      <aside>
        <div className="brand">◈ {!collapsed && "PRISMA"}</div>
        <button
          className="secondary"
          aria-expanded={!collapsed}
          aria-label="Recolher ou expandir menu"
          onClick={() => setCollapsed(!collapsed)}
        >
          ☰
        </button>
        <nav aria-label="Navegação principal">
          {nav.map(([href, icon, label]) => (
            <Link
              key={href}
              title={label}
              aria-label={label}
              aria-current={path.startsWith(href) ? "page" : undefined}
              href={href}
            >
              {collapsed ? icon : label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              const value = query.trim();
              if (!value) return;
              const cnpj = value.replace(/\D/g, "");
              router.push(
                cnpj.length === 14
                  ? `/empresas?q=${encodeURIComponent(cnpj)}`
                  : `/mercado?q=${encodeURIComponent(value)}`,
              );
            }}
          >
            <label className="sr-only" htmlFor="global-query">
              Buscar ticker, empresa ou CNPJ
            </label>
            <input
              id="global-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={80}
              placeholder="Ticker, empresa ou CNPJ"
            />
            <button className="secondary">Buscar</button>
          </form>
          <button className="secondary" onClick={() => setLight(!light)}>
            {light ? "Tema escuro" : "Tema claro"}
          </button>
          <LogoutButton />
        </header>
        <main id="conteudo">{children}</main>
      </div>
    </div>
  );
}
