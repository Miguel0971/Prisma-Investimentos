import { DocumentList } from "@/components/document-list";
export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const p = await searchParams;
  return (
    <>
      <span className="eyebrow">ACERVO PRIVADO</span>
      <h1>Central de documentos</h1>
      <DocumentList query={p.q} />
    </>
  );
}

export const maxDuration = 60;
