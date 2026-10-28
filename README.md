# Prisma — pesquisa privada de investimentos

Versão 0.2 executável, com módulos A–G implementados parcialmente e testes locais. **Ainda não atende integralmente ao aceite em produção.** Consulte `docs/PROGRESS.md` para evidências, limitações e requisitos restantes.

Next.js App Router, React, TypeScript, Tailwind, NextAuth/Auth.js v4, Neon PostgreSQL, Drizzle, Blob privado e pgvector. Versões fixadas no lockfile; Node.js 24 ou superior.

## Executar

```sh
npm ci
cp .env.example .env.local
# Preencha as variáveis conforme docs/GUIA_INSTALACAO.md
npm run db:migrate
npm run db:check
npm run dev
```

No Windows use `Copy-Item .env.example .env.local`. Sem credenciais, o build funciona e o acesso permanece bloqueado. Não há login de demonstração ou dados financeiros fictícios em produção. O proprietário é autorizado pelo ID numérico imutável do GitHub; sessão de oito horas. Rotacionar NEXTAUTH_SECRET invalida as sessões.

## Funcionalidades

- Cotações Brapi, histórico, candles/linha, médias, RSI e MACD; horários, cache e limites explícitos.
- Cadastro CVM, DFP/ITR/FRE/IPE, demonstrativos e documentos oficiais, revisões preservadas e filtros.
- DCF com cenários/sensibilidade, 14 fórmulas iniciais, editor restrito, importação JSON/CSV/XLSX, versões e resultados persistidos. Vinculação explícita de contas CVM com unidade e origem.
- Upload privado PDF/EPUB/XLSX/CSV/TXT/Markdown, extração, busca textual, biblioteca e exclusão coerente de índices.
- RAG com pgvector, citações verificáveis, limites de contexto/orçamento, cache de respostas e relatório editável/exportável. IA opcional e desligada por padrão.
- Fila persistente de sincronização, leases, retentativas limitadas e cron diário autenticado.

A lista de estudo aceita cadastro manual de ticker, identificado como não verificado. Tema claro/escuro e recolhimento do menu são temporários. Nenhuma cotação é anunciada como tempo real licenciado.

## Verificação

```sh
npm run check
npm run test:smoke
npm run test:live
npm run db:check
```

`check`: lint, tipos, testes e build. `test:smoke`: servidor de produção temporário sem credenciais, bloqueio de rotas. `test:live`: Brapi/CVM reais, exige internet e pode consumir cotas. `db:check`: Neon configurado, registros temporários. Os testes locais incluem PostgreSQL embarcado com pgvector; autenticação, Blob e modelos são simulados exclusivamente em testes.

## Estrutura

```text
src/app/             páginas, APIs e server actions autenticados
src/components/      navegação, gráficos, editores, upload e chat
src/services/        mercado, CVM, cálculo, extração, RAG e fila
src/lib/             autenticação, política, formatação e limites
src/db/              esquema e conexão de servidor
scripts/             verificação de banco, APIs públicas e smoke
 tests/              testes automatizados e arquivos autorizados
 drizzle/            dez migrations SQL e snapshots versionados
 docs/               instalação, arquitetura, progresso e validação
 .github/workflows/   CI: check e smoke
```

## Publicação e limites

Use repositório privado no GitHub e Vercel. Configure variáveis exclusivamente no servidor, aplique migrations no Neon antes do deploy e conecte Blob privado. O cron diário executa até três tarefas por chamada; volumes maiores exigem execução manual ou agendamento compatível com o plano.

Processamento de arquivos é limitado (20 MB, páginas/células/texto) e ainda não é retomável por página: arquivos complexos podem exceder o tempo da Vercel. OCR, crawler de RI, capa/resumos estruturados automáticos de livros, exclusão definitiva de fórmulas e dados de mercado licenciados ao vivo não estão implementados. A política de IA reduz riscos de instruções maliciosas e referências inventadas, mas não garante correção semântica; revise fontes e inferências.

Login OAuth real, Neon, Blob privado, modelos pagos, QA visual autenticado e deploy Vercel permanecem sem validação conclusiva nesta entrega. O guia contém os procedimentos para concluir esses testes sem compartilhar segredos no chat.
