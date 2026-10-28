import { it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  companiesFromCsv,
  documentIndex,
  safeOfficialLink,
  unzipSelected,
  packageUrl,
} from "../src/services/cvm";
it("cadastro preserva CNPJ e setor", async () => {
  const rows = await companiesFromCsv(
    strToU8(
      "CNPJ_CIA;DENOM_SOCIAL;CD_CVM;SETOR_ATIV;WEB_SITE;SIT\n00.000.000/0001-91;Teste;1;Bancos;https://example.com;ATIVO",
    ),
  );
  expect(rows[0].cnpj).toBe("00000000000191");
  expect(rows[0].sector).toBe("Bancos");
});
it("preserva publicação e versão sem confundir período", async () => {
  const csv =
    "CNPJ_CIA;ID_DOC;VERSAO;DT_REFER;DT_RECEB;CATEG_DOC;LINK_DOC\n00.000.000/0001-91;10;1;2024-12-31;2025-02-10;DFP;https://www.rad.cvm.gov.br/a\n00.000.000/0001-91;11;2;2024-12-31;2025-03-01;DFP;https://www.rad.cvm.gov.br/b";
  const docs = await documentIndex(
    strToU8(csv),
    "00000000000191",
    "DFP",
    "CVM",
  );
  expect(docs[0].version).toBe("2");
  expect(docs[0].reference).toBe("2024-12-31");
  expect(new Set(docs.map((x) => x.externalId)).size).toBe(2);
});
it("bloqueia links injetados e ano/categoria inválidos", () => {
  expect(safeOfficialLink("javascript:alert(1)")).toBeNull();
  expect(safeOfficialLink("https://cvm.gov.br.attacker.com/")).toBeNull();
  expect(() => packageUrl("../abc", 2025)).toThrow();
  expect(() => packageUrl("DFP", 2000)).toThrow();
});
it("descompacta apenas entrada escolhida e impõe limite", () => {
  const zip = zipSync({ "a.csv": strToU8("teste"), "b.csv": strToU8("outro") });
  expect(new TextDecoder().decode(unzipSelected(zip, "a.csv"))).toBe("teste");
  expect(() => unzipSelected(zip, "a.csv", 2)).toThrow();
  expect(() => unzipSelected(zip, "c.csv")).toThrow();
});
