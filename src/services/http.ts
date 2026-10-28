export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
export async function readLimited(response: Response, limit: number) {
  if (Number(response.headers.get("content-length")) > limit)
    throw new ServiceError("SIZE", "Resposta excede o limite.");
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError("EMPTY", "Resposta vazia.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit)
        throw new ServiceError("SIZE", "Resposta excede o limite.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export type Fetcher = typeof fetch;
export async function fetchJson(
  url: URL,
  token: string | undefined,
  fetcher: Fetcher = fetch,
) {
  let r: Response;
  try {
    r = await fetcher(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new ServiceError(
      "NETWORK",
      "Fornecedor indisponível ou tempo de resposta excedido.",
    );
  }
  if (!r.ok) {
    const messages: Record<number, string> = {
      400: "Período ou recurso não permitido pelo fornecedor/plano.",
      401: "Credencial do fornecedor ausente ou inválida.",
      403: "Recurso não autorizado pelo plano.",
      404: "Ativo não encontrado.",
      429: "Cota de requisições atingida. Tente mais tarde.",
    };
    throw new ServiceError(
      `HTTP_${r.status}`,
      messages[r.status] ?? "Fornecedor indisponível.",
      r.status === 404 ? 404 : 502,
    );
  }
  try {
    return JSON.parse(
      new TextDecoder().decode(await readLimited(r, 8_000_000)),
    ) as unknown;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    throw new ServiceError("FORMAT", "Formato inesperado do fornecedor.");
  }
}
