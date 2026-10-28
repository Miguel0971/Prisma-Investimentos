import { spawn } from "node:child_process";
import assert from "node:assert/strict";
// Run after npm run build. Independent process; no credentials required.
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    stdio: "ignore",
    env: {
      ...process.env,
      DATABASE_URL: "",
      NEXTAUTH_SECRET: "",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
      OWNER_GITHUB_ID: "",
      CRON_SECRET: "",
    },
  },
);
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      await fetch("http://127.0.0.1:3100/entrar");
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert(ready, "Servidor indisponível");
  for (const [path, status, location] of [
    ["/entrar", 200, null],
    ["/dashboard", 307, "/entrar"],
    ["/configuracoes", 307, "/entrar"],
    ...[
      "/mercado",
      "/empresas",
      "/laboratorio",
      "/documentos",
      "/biblioteca",
      "/assistente",
    ].map((path) => [path, 307, "/entrar"]),
    ["/", 307, "/dashboard"],
  ]) {
    const response = await fetch("http://127.0.0.1:3100" + path, {
      redirect: "manual",
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("location"), location);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    if (path === "/entrar")
      assert((await response.text()).includes("Configuração necessária"));
    console.log("PASS", path, status);
  }
  for (const [path, method] of [
    ["/api/upload", "POST"],
    ["/api/documents/11111111-1111-4111-8111-111111111111", "GET"],
    ["/api/cron", "GET"],
  ]) {
    const response = await fetch("http://127.0.0.1:3100" + path, {
      method,
      redirect: "manual",
    });
    assert.equal(response.status, 401);
    console.log("PASS", method, path, 401);
  }
} finally {
  child.kill();
}
