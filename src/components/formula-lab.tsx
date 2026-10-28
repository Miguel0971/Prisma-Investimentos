"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { presets } from "@/services/valuation";
import { type Formula } from "@/services/formula";
import {
  calculate,
  saveFormula,
  archiveFormula,
  importFormula,
} from "@/app/(private)/laboratorio/actions";
type Saved = {
  id: string;
  versionId: string;
  version: number;
  definition: Formula;
};
const dcfFields = [
  ["fcf", "Fluxo de caixa livre inicial (R$)"],
  ["growth", "Crescimento anual (fração)"],
  ["years", "Horizonte (anos inteiros)"],
  ["wacc", "WACC anual (fração)"],
  ["terminal", "Crescimento terminal (fração)"],
  ["netDebt", "Dívida líquida (R$)"],
  ["shares", "Ações em circulação (unidades)"],
  ["price", "Cotação de referência manual (R$/ação, opcional)"],
];
const blank: Formula = {
  name: "Minha fórmula",
  description: "",
  category: "Valuation",
  expression: "valor / acoes",
  variables: [
    { name: "valor", label: "Valor do patrimônio", unit: "BRL" },
    {
      name: "acoes",
      label: "Ações em circulação",
      unit: "acoes",
      min: "0.000001",
    },
  ],
};
export function FormulaLab({
  saved,
  accounts,
}: {
  saved: Saved[];
  accounts: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [method, setMethod] = useState("DCF");
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>();
  const [draft, setDraft] = useState<Formula>(blank);
  const [editId, setEditId] = useState<string>();
  const [editor, setEditor] = useState(false);
  const stored = saved.find((x) => x.versionId === method);
  const f = stored?.definition ?? presets.find((x) => x.name === method);
  const fields =
    method === "DCF"
      ? dcfFields
      : (f?.variables.map((x) => [x.name, `${x.label} (${x.unit})`]) ?? []);
  async function run() {
    setBusy(true);
    setMessage("");
    try {
      const clean = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== ""),
      );
      const r = await calculate(
        stored?.definition.name ?? method,
        clean,
        stored?.versionId,
        bindings,
      );
      setResult(r.result);
      setMessage("Cálculo salvo com as premissas.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível calcular.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const r = await saveFormula(draft, values, editId);
      setMessage(r.message);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar">
        <label>
          Filtrar métodos{" "}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="DCF, Graham, depreciação…"
          />
        </label>
        <label>
          Método{" "}
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setValues({});
              setBindings({});
              setResult(undefined);
            }}
          >
            <option>DCF</option>
            {["Valuation", "Contabilidade", "Matemática financeira"].map(
              (cat) => (
                <optgroup label={cat} key={cat}>
                  {presets
                    .filter(
                      (f) =>
                        f.category === cat &&
                        f.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((f) => (
                      <option key={f.name}>{f.name}</option>
                    ))}
                </optgroup>
              ),
            )}
            <optgroup label="Minhas versões">
              {saved
                .filter((x) =>
                  x.definition.name
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((x) => (
                  <option key={x.versionId} value={x.versionId}>
                    {x.definition.name} · v{x.version}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        <button className="secondary" onClick={() => setEditor(!editor)}>
          {editor ? "Fechar editor" : "Criar / importar fórmula"}
        </button>
        {stored && (
          <>
            <button
              className="secondary"
              onClick={() => {
                setDraft(stored.definition);
                setEditId(stored.id);
                setEditor(true);
              }}
            >
              Editar nova versão
            </button>
            <button
              className="secondary"
              onClick={() => {
                setDraft({
                  ...stored.definition,
                  name: stored.definition.name + " (cópia)",
                });
                setEditId(undefined);
                setEditor(true);
              }}
            >
              Duplicar
            </button>
            <button
              className="secondary"
              onClick={async () => {
                if (
                  !confirm(
                    "Arquivar a fórmula? Análises anteriores serão mantidas.",
                  )
                )
                  return;
                try {
                  await archiveFormula(stored.id);
                  setMethod("DCF");
                  router.refresh();
                } catch {
                  setMessage("Não foi possível arquivar.");
                }
              }}
            >
              Arquivar
            </button>
          </>
        )}
      </div>
      <section className="panel">
        <h2>{f?.name ?? "Fluxo de caixa descontado"}</h2>
        <p>
          {f?.description ??
            "FCFF descontado pelo WACC. Todos os valores são premissas manuais, sem preenchimento inventado."}
        </p>
        <p>
          Use ponto decimal, sem separador de milhar. Taxas em fração: 0.12 =
          12%. Contas CVM podem preencher campos BRL; a escala MIL é convertida
          em reais. Confira se a conta selecionada corresponde à premissa.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <div className="field-grid">
            {fields.map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  disabled={!!bindings[key]}
                  required={key !== "price" && !bindings[key]}
                  inputMode="decimal"
                  value={values[key] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [key]: e.target.value })
                  }
                />
                {(method === "DCF"
                  ? ["fcf", "netDebt"].includes(key)
                  : f?.variables.some(
                      (v) => v.name === key && v.unit === "BRL",
                    )) && (
                  <select
                    aria-label={`Origem de ${label}`}
                    value={bindings[key] ?? ""}
                    onChange={(e) => {
                      const next = { ...bindings };
                      if (e.target.value) next[key] = e.target.value;
                      else delete next[key];
                      setBindings(next);
                    }}
                  >
                    <option value="">Entrada manual</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>
          <button disabled={busy}>
            {busy ? "Processando…" : "Calcular e salvar"}
          </button>
        </form>
      </section>
      {editor && (
        <section className="panel">
          <h2>{editId ? "Nova versão" : "Editor visual de fórmula"}</h2>
          <div className="field-grid">
            <label>
              Nome
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Categoria
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    category: e.target.value as Formula["category"],
                  })
                }
              >
                {["Valuation", "Contabilidade", "Matemática financeira"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <label>
            Descrição
            <input
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          <label>
            Expressão
            <input
              value={draft.expression}
              onChange={(e) =>
                setDraft({ ...draft, expression: e.target.value })
              }
            />
          </label>
          <p>
            Operadores: + − * / ^. Funções: sqrt, abs, min, max. Sem código,
            macros ou acesso externo.
          </p>
          {draft.variables.map((v, i) => (
            <div className="field-grid" key={i}>
              <label>
                Identificador
                <input
                  value={v.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variables: draft.variables.map((x, j) =>
                        i === j ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Rótulo
                <input
                  value={v.label}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variables: draft.variables.map((x, j) =>
                        i === j ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Unidade
                <select
                  value={v.unit}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      variables: draft.variables.map((x, j) =>
                        i === j
                          ? { ...x, unit: e.target.value as typeof v.unit }
                          : x,
                      ),
                    })
                  }
                >
                  {["numero", "BRL", "acoes", "BRL/acao", "taxa", "anos"].map(
                    (u) => (
                      <option key={u}>{u}</option>
                    ),
                  )}
                </select>
              </label>
              {(["min", "max", "default"] as const).map((key) => (
                <label key={key}>
                  {{ min: "Mínimo", max: "Máximo", default: "Padrão" }[key]}
                  <input
                    value={v[key] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        variables: draft.variables.map((x, j) =>
                          i === j
                            ? { ...x, [key]: e.target.value || undefined }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Valor para testar
                <input
                  value={values[v.name] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [v.name]: e.target.value })
                  }
                />
              </label>
              <button
                className="secondary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    variables: draft.variables.filter((_, j) => j !== i),
                  })
                }
              >
                Remover variável
              </button>
            </div>
          ))}
          <div className="toolbar">
            <button
              className="secondary"
              onClick={() =>
                setDraft({
                  ...draft,
                  variables: [
                    ...draft.variables,
                    {
                      name: `x${draft.variables.length}`,
                      label: "Nova variável",
                      unit: "numero",
                    },
                  ],
                })
              }
            >
              Adicionar variável
            </button>
            <button disabled={busy} onClick={() => void save()}>
              Validar, testar e salvar versão
            </button>
            <label>
              Importar JSON/CSV/XLSX
              <input
                type="file"
                accept=".json,.csv,.xlsx"
                onChange={async (e) => {
                  try {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.set("file", file);
                    setDraft(await importFormula(form));
                    setEditId(undefined);
                    setMessage(
                      "Definição carregada. Preencha valores de teste e salve.",
                    );
                  } catch (e) {
                    setMessage(
                      e instanceof Error ? e.message : "Arquivo incompatível.",
                    );
                  }
                }}
              />
            </label>
          </div>
        </section>
      )}
      <p role="status">{message}</p>
      {result !== undefined && (
        <section className="panel">
          <h2>Resultado auditável</h2>
          <p>
            DCF: cenários variam o crescimento em −2, 0 e +2 pontos percentuais.
            Sensibilidade varia WACC em ±1 p.p. e crescimento terminal em ±0,5
            p.p. São simulações derivadas das suas premissas.
          </p>
          {typeof result === "object" &&
            result !== null &&
            "base" in result && (
              <div className="cards">
                {Object.entries(
                  (result as { base: Record<string, unknown> }).base,
                )
                  .filter(([k]) =>
                    ["perShare", "enterprise", "equity"].includes(k),
                  )
                  .map(([k, v]) => (
                    <section className="panel" key={k}>
                      <small>
                        {
                          {
                            perShare: "VALOR POR AÇÃO",
                            enterprise: "VALOR DA FIRMA",
                            equity: "PATRIMÔNIO ESTIMADO",
                          }[k as "perShare"]
                        }
                      </small>
                      <strong className="metric">{money(String(v))}</strong>
                    </section>
                  ))}
              </div>
            )}
          <details open>
            <summary>Premissas, etapas, cenários e sensibilidade</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      )}
    </>
  );
}
