import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Prisma | Pesquisa de investimentos",
  description: "Ambiente privado de pesquisa e análise de investimentos.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
