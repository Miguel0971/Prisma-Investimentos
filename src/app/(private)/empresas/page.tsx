import Link from "next/link";
import { consume } from "@/services/limits";
import { requireOwner } from "@/lib/auth";
import { findCompanies, companyPackage } from "@/services/cvm-server";
import { cvmType, yearSchema, cnpjSchema } from "@/services/cvm";
import { ServiceError } from "@/services/http";
import { dateTime } from "@/lib/format";
import { z } from "zod";
export default async function Companies({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireOwner();
  const p = await searchParams;
  const query = (p.q ?? "").trim().slice(0, 80);
  const cnpj = cnpjSchema.safeParse(p.cnpj ?? "");
  const type = cvmType.catch("DFP").parse(p.tipo);
  const year = yearSchema.catch(new Date().getFullYear() - 1).parse(p.ano);
  const statement = z
    .enum(["DRE", "BPA", "BPP", "DFC_MD", "DFC_MI"])
    .catch("DRE")
    .parse(p.demonstrativo);
  const scope = z.enum(["con", "ind"]).catch("con").parse(p.escopo);
  let companies;
  let result;
  let error;
  try {
    if (query.length >= 2 || cnpj.success)
      await consume(`cvm:${session.githubId}`, 1, 10, 60_000);
    if (query.length >= 2) companies = await findCompanies(query);
    if (cnpj.success)
      result = await companyPackage(cnpj.data, type, year, statement, scope);
  } catch (e) {
    error =
      e instanceof ServiceError
        ? e.message
        : "Não foi possível consultar a CVM. Verifique banco e conectividade.";
  }
  const versions = result
    ? [...new Set(result.rows.map((x) => x.version))].sort(
        (a, b) => Number(b) - Number(a),
      )
    : [];
  const selectedVersion =
    p.versao && versions.includes(p.versao) ? p.versao : versions[0];
  const rows = result?.rows.filter((x) => x.version === selectedVersion) ?? [];
  const categories = [...new Set(result?.docs.map((d) => d.category) ?? [])];
  const docs =
    result?.docs.filter(
      (d) =>
        (!p.categoria || d.category === p.categoria) &&
        (!p.trimestre ||
          (!!d.reference &&
            Math.ceil(Number(d.reference.slice(5, 7)) / 3) ===
              Number(p.trimestre))) &&
        (!p.publicacao || (!!d.published && d.published >= p.publicacao)),
    ) ?? [];
  return (
    <>
      <span className="eyebrow">FONTES OFICIAIS</span>
      <h1>Companhias e documentos de RI</h1>
      <form className="toolbar">
        <label htmlFor="cvm-query">Nome ou CNPJ</label>
        <input
          id="cvm-query"
          name="q"
          defaultValue={query}
          minLength={2}
          maxLength={80}
        />
        <button>Buscar na CVM</button>
      </form>
      {companies && (
        <section className="panel">
          <h2>Cadastro oficial</h2>
          {companies.length ? (
            companies.map((c) => (
              <p key={c.cnpj}>
                <Link
                  href={`/empresas?cnpj=${c.cnpj}&q=${encodeURIComponent(query)}`}
                >
                  {c.name} · {c.cnpj}
                </Link>
                <br />
                <small>
                  {c.sector} · {c.status} · Código CVM {c.cvmCode}{" "}
                  {c.website && (
                    <a href={c.website} rel="noreferrer" target="_blank">
                      {" "}
                      · Site informado no cadastro (RI não verificado)
                    </a>
                  )}
                </small>
              </p>
            ))
          ) : (
            <p>Nenhuma companhia encontrada.</p>
          )}
        </section>
      )}
      {cnpj.success && (
        <form className="toolbar">
          <input type="hidden" name="cnpj" value={cnpj.data} />
          <label>
            Tipo{" "}
            <select name="tipo" defaultValue={type}>
              {["DFP", "ITR", "FRE", "IPE"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Ano{" "}
            <input
              type="number"
              name="ano"
              min="2010"
              max={new Date().getFullYear()}
              defaultValue={year}
            />
          </label>
          <label>
            Demonstrativo{" "}
            <select name="demonstrativo" defaultValue={statement}>
              {["DRE", "BPA", "BPP", "DFC_MD", "DFC_MI"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Escopo{" "}
            <select name="escopo" defaultValue={scope}>
              <option value="con">Consolidado</option>
              <option value="ind">Individual</option>
            </select>
          </label>
          {versions.length > 0 && (
            <label>
              Versão{" "}
              <select name="versao" defaultValue={selectedVersion}>
                {versions.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Categoria
            <select name="categoria" defaultValue={p.categoria ?? ""}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Trimestre de referência
            <select name="trimestre" defaultValue={p.trimestre ?? ""}>
              <option value="">Todos</option>
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  {t}º trimestre
                </option>
              ))}
            </select>
          </label>
          <label>
            Publicado a partir de
            <input type="date" name="publicacao" defaultValue={p.publicacao} />
          </label>
          <button>Consultar</button>
        </form>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <section className="panel">
            <h2>{result.company.name}</h2>
            <p>
              CNPJ {result.company.cnpj} · CVM {result.company.cvmCode} ·{" "}
              {result.company.sector} · {result.company.status}
            </p>
            <p>
              Registros consultados são preservados no banco por revisão e hash,
              independentemente do cache.
            </p>
          </section>
          <section className="panel">
            <h2>Documentos oficiais · {docs.length}</h2>
            <p>
              Ordenados por publicação/recebimento, não pelo período de
              referência. Versões são preservadas. Arquivos CVM podem exigir
              Empresas.NET.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Título / categoria</th>
                    <th>Referência</th>
                    <th>Recebimento</th>
                    <th>Versão</th>
                    <th>Fonte / status</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.externalId}>
                      <td>
                        {d.title}
                        <br />
                        <small>{d.category}</small>
                      </td>
                      <td>{d.reference ?? "Não informada"}</td>
                      <td>{d.published ?? "Não informada"}</td>
                      <td>{d.version}</td>
                      <td>
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer">
                            Abrir na CVM ↗
                          </a>
                        ) : (
                          "Link não disponível"
                        )}
                        <br />
                        <small>
                          Metadados consultados; arquivo não baixado
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!docs.length && <p>Nenhum documento nesta seleção.</p>}
          </section>
          <section className="panel">
            <h2>
              {statement} · versão {selectedVersion ?? "não disponível"}
            </h2>
            <p>
              Valores originais. Moeda, escala e exercício não foram
              convertidos. Trimestres podem representar valores acumulados; não
              somar sem conciliação.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Conta</th>
                    <th>Valor original</th>
                    <th>Moeda/escala</th>
                    <th>Fim do exercício</th>
                    <th>Referência / ordem</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>
                        {r.code} — {r.label}
                      </td>
                      <td>{r.value}</td>
                      <td>
                        {r.currency} / {r.scale}
                      </td>
                      <td>{r.period}</td>
                      <td>
                        {r.reference} / {r.exercise}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p>
                Sem linhas contábeis nesta seleção. FRE/IPE contêm documentos,
                não este demonstrativo.
              </p>
            )}
          </section>
          <p>
            Fonte: <a href={result.source}>pacote CVM</a> · Consulta:{" "}
            {dateTime(result.fetchedAt)} · Cache: 24h.
          </p>
        </>
      )}
    </>
  );
}

export const maxDuration = 60;
