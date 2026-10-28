import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { apiOwner, sameOrigin } from "@/lib/api-auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { readLimited } from "@/services/http";
import { consume } from "@/services/limits";
import { extension, maxFileSize } from "@/services/documents";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await apiOwner();
  if (!user) return Response.json({ error: "Acesso negado." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 16000)
      return Response.json(
        { error: "Requisição grande demais." },
        { status: 413 },
      );
    const body = JSON.parse(
      new TextDecoder().decode(
        await readLimited(new Response(request.body), 16000),
      ),
    ) as HandleUploadBody;
    await consume(`upload:${user.id}`, 1, 20, 3600_000);
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, payload) => {
        const meta = z
          .object({
            name: z.string().min(1).max(200),
            category: z.enum([
              "empresas",
              "relatorios",
              "planilhas",
              "livros",
              "metodologias",
            ]),
          })
          .parse(JSON.parse(payload ?? "{}"));
        const ext = extension(meta.name);
        if (
          !new RegExp(`^documents/[a-f0-9-]{36}/file\\.${ext}$`).test(pathname)
        )
          throw Error("Caminho inválido.");
        await db()
          .insert(documents)
          .values({
            userId: user.id,
            name: meta.name,
            category: meta.category,
            pathname,
          });
        return {
          maximumSizeInBytes: maxFileSize,
          validUntil: Date.now() + 5 * 60_000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Upload recusado. Verifique formato, configuração e limites." },
      { status: 400 },
    );
  }
}
