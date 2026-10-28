import { authConfigured } from "@/lib/policy";
import { LoginButton } from "@/components/auth-buttons";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ready = authConfigured(process.env);
  const { error } = await searchParams;
  return (
    <main id="conteudo" className="login">
      <div className="brand">
        ◈ PRISMA <span>INVESTIMENTOS</span>
      </div>
      <section className="login-card">
        <span className="eyebrow">SEU AMBIENTE DE PESQUISA</span>
        <h1>
          Decisões começam
          <br />
          com evidências.
        </h1>
        <p>
          Um espaço privado para estudar empresas, documentar premissas e
          construir suas análises.
        </p>
        <div className="notice">
          Pesquisa privada · Mercado, documentos e cálculos com origem
          identificada.
        </div>
        {error && (
          <p role="alert">
            Não foi possível entrar. Verifique a conta autorizada, o banco e a
            configuração OAuth.
          </p>
        )}
        {ready ? (
          <LoginButton />
        ) : (
          <div className="notice" role="status">
            <strong>Configuração necessária</strong>
            <p>
              O acesso está bloqueado até configurar banco, GitHub OAuth,
              segredo de sessão e ID do proprietário. Siga
              docs/GUIA_INSTALACAO.md no projeto.
            </p>
          </div>
        )}
        <small>Acesso exclusivo ao proprietário · Autenticação GitHub</small>
      </section>
      <p className="foot">
        Dados verificáveis. Premissas explícitas. Cálculos auditáveis.
      </p>
    </main>
  );
}
