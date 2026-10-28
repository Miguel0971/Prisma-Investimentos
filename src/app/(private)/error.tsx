"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Não foi possível carregar esta página</h1>
      <p>Verifique sua conexão e a configuração do banco.</p>
      <button onClick={reset}>Tentar novamente</button>
    </section>
  );
}
