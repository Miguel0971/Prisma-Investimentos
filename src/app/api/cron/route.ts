import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { cronAuthorized } from "@/services/jobs";
import {
  scheduleSources,
  runNext,
  cleanupExpired,
} from "@/services/jobs-server";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !cronAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return Response.json({ error: "Acesso negado." }, { status: 401 });
  try {
    const [user] = await db()
      .select()
      .from(users)
      .where(eq(users.githubId, process.env.OWNER_GITHUB_ID ?? ""));
    if (!user)
      return Response.json(
        { error: "Proprietário ainda não cadastrado." },
        { status: 409 },
      );
    await cleanupExpired();
    const sources = await scheduleSources(user.id);
    const results = await Promise.all(
      Array.from({ length: 3 }, () => runNext(user.id)),
    );
    return Response.json({
      sources,
      results,
      note: "Até três unidades por execução. Fontes com trabalho pendente não geram duplicatas.",
    });
  } catch {
    return Response.json(
      { error: "Sincronização indisponível." },
      { status: 503 },
    );
  }
}
