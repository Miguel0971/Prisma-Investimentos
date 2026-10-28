import { get } from "@vercel/blob";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { apiOwner } from "@/lib/api-auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await apiOwner();
  if (!user) return new Response("Acesso negado.", { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new Response("ID inválido", { status: 400 });
  const [doc] = await db()
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)));
  if (!doc || doc.status === "deleting")
    return new Response("Não encontrado", { status: 404 });
  try {
    const blob = await get(doc.pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200)
      return new Response("Arquivo indisponível", { status: 404 });
    return new Response(blob.stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Armazenamento indisponível", { status: 503 });
  }
}
