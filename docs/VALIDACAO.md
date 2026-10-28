# Evidências de validação — 28/10/2026

Ambiente: Node.js 24, npm 11, Linux. Projeto 0.2.0. Nenhuma credencial de produção foi usada para simular login, Blob ou IA.

## Verificação final

| Comando              | Resultado observado                                                 |
| -------------------- | ------------------------------------------------------------------- |
| npm run lint         | Sem erros                                                           |
| npm run typecheck    | Tipos gerados; sem erros TypeScript                                 |
| npm test             | 83 testes aprovados, 12 arquivos                                    |
| npm run build        | Build de produção webpack concluído, 16 rotas listadas              |
| npm run test:smoke   | 13 verificações HTTP aprovadas                                      |
| npm audit --omit=dev | Zero vulnerabilidades reportadas no catálogo no momento da execução |

Lint, tipos e testes rodaram pelo comando agregado `check`; o build final foi executado separadamente até conclusão comprovada. Auditoria de dependências não substitui revisão de segurança nem cobre todas as dependências de desenvolvimento.

O smoke iniciou Next em modo produção e confirmou `/entrar` com status 200, redirecionamento de oito páginas privadas para login, redirecionamento inicial e status 401 para upload, download e cron sem autorização. Verificou também o cabeçalho nosniff. Não houve navegador autenticado nem inspeção visual.

## APIs públicas reais

Brapi consultada em 28/10/2026 às 22:33:40 UTC, período de um mês:

| Ativo | Preço devolvido | Horário da cotação      | Pontos históricos |
| ----- | --------------- | ----------------------- | ----------------- |
| PETR4 | R$ 52,51        | 28/10/2026 21:30:30 UTC | 22                |
| VALE3 | R$ 61,38        | 28/10/2026 21:30:30 UTC | 22                |

São amostras registradas do teste, não preços atuais garantidos nem dados ao vivo. O horário da consulta é diferente do horário da cotação. Os testes de erros do fornecedor usam respostas controladas, identificadas nos arquivos de teste.

CVM consultada em 28/10/2026 às 22:35:42–44 UTC para Petrobras, CNPJ 33000167000101:

| Pacote   | Documentos no filtro | Linhas DRE consolidada | Evidência                                                                  |
| -------- | -------------------- | ---------------------- | -------------------------------------------------------------------------- |
| DFP 2025 | 1                    | 86                     | Referência 31/12/2025, publicação 05/03/2026, versão 1                     |
| ITR 2026 | 3                    | 258                    | Contas da referência 31/03/2026 versão 2; documento de 30/06/2026 versão 1 |
| FRE 2026 | 12                   | Não aplicável          | Documento versão 11; referência e publicação preservadas separadamente     |
| IPE 2026 | 236                  | Não aplicável          | Índice com título original e link oficial de comunicado                    |

As linhas incluem exercício atual/comparativo, não devem ser somadas indiscriminadamente. O valor original continua decimal com escala MIL quando assim fornecido. Pacotes oficiais: https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ .

A tentativa adicional de baixar o PDF do comunicado IPE pelo link oficial terminou com `IncompleteRead` (14.599 bytes parciais). Não foi possível confirmar a integridade desse arquivo; abertura/download oficial permanece pendente. O aplicativo oferece o link e importação manual como alternativa.

## Banco e cenários simulados

Os testes usam PostgreSQL embarcado PGlite com extensão pgvector real. Aplicam as dez migrations e verificam relações, unicidade, cascata, reabertura persistente, revisões CVM, conversão de escala, versões de fórmula, resultados históricos, rate limit e concorrência da fila. Esse resultado não comprova configuração, rede ou permissões do Neon remoto.

Blob usa armazenamento de teste e o SDK emite um token com credencial fictícia. PDFs autorizados, EPUB/XLSX criados em teste e CSV/TXT verificam extração, corrupção, limites, sinais/unidades, deduplicação e remoção dos índices. Isso não comprova upload direto nem download privado em produção.

Embeddings e resposta textual são simulados; a busca vetorial executa SQL real. Testes verificam citações permitidas, limite de contexto, ausência de contexto, números não presentes, orçamento, cache, relatório editável e exclusão associada. A qualidade semântica e resistência adversarial do modelo escolhido continuam sem teste conclusivo.

Fórmulas usam exemplos calculados para DCF e 14 métodos, incluindo WACC, Gordon, Graham, múltiplos, margem, depreciações, VP/VF e CAGR. Há casos de divisão por zero, unidades incompatíveis, código malicioso, expoentes extremos, importação insegura e valores acima da precisão inteira do JavaScript.

## Reproduzir e concluir produção

Siga `GUIA_INSTALACAO.md`, configure suas variáveis localmente, execute `npm ci`, `npm run check`, `npm run test:smoke`, `npm run test:live`, `npm run db:migrate` e `npm run db:check`. O live usa internet e pode consumir cota. Prossiga pelos fluxos autenticados descritos no item 14 do guia; repita no domínio Vercel após deploy e após redeploy. Não marque OAuth, Neon, Blob, IA, backup ou deploy como testados sem executar na conta correspondente.
