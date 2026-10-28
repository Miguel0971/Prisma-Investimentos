import { DocumentList } from "@/components/document-list";
export default async function Books({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const p = await searchParams;
  return (
    <>
      <span className="eyebrow">CONHECIMENTO COM REFERÊNCIAS</span>
      <h1>Biblioteca de investimentos</h1>
      <p>
        Livros privados; texto por capítulo ou página. Envie com categoria
        livros para organizar o acervo.
      </p>
      <DocumentList books query={p.q} />
    </>
  );
}

export const maxDuration = 60;
