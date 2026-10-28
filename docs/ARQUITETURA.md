# Arquitetura — versão 0.2

## Fluxo e limites de confiança

Next.js App Router serve páginas em português e componentes React. Server actions e rotas privadas verificam sessão e ID GitHub do proprietário antes de acessar dados. NextAuth v4 usa JWT de oito horas; OAuth não é simulado em produção. Credenciais são variáveis de servidor. O driver Neon HTTP/Drizzle usa consultas parametrizadas; nenhuma conexão ou token é enviado ao navegador.

Serviços de mercado e CVM ficam separados da interface. O cache persistente tem TTL, agrupamento de chamadas concorrentes e leases distribuídos. Brapi fornece cotação/histórico; o horário vem da fonte. Status do mercado e atraso não são inferidos como fatos quando o fornecedor não os informa. Lightweight Charts renderiza dados recebidos; não há extração de TradingView.

CVM usa URLs oficiais fixas, CSV com codificação adequada e ZIP limitado. Cadastro, versões documentais e contas contábeis são persistidos separadamente; hash preserva revisões inclusive quando o número de versão se repete. Unidade, escala, período, publicação e reapresentação não são confundidos. Link de site no cadastro não equivale a RI verificado. Falhas não geram documentos inventados.

## Dados

Dez migrations (`0000` a `0009`) criam 17 tabelas: users, watchlists, data_cache, formulas, formula_versions, valuation_runs, documents, document_chunks, document_embeddings, ai_conversations, request_limits, sync_jobs, sync_sources, lease_locks, companies, official_documents e financial_statements. Confira nomes definitivos e restrições em `src/db/schema.ts`.

Resultados de valuation guardam premissas, expressão e versão; vínculos contábeis guardam a fonte e o valor convertido. Fórmulas são arquivadas sem apagar resultados. Documentos guardam somente referência Blob, hash e metadados; arquivos binários não vão para PostgreSQL. Chunks e embeddings usam relações com exclusão em cascata. Conversas afetadas são excluídas ao remover documentos. pgvector usa 1536 dimensões; mudar o modelo exige reindexar.

## Cálculo e IA

O interpretador matemático usa Decimal, gramática restrita, unidades, limites de tamanho/profundidade/expoente e funções aprovadas. Não usa eval, macros, JavaScript ou Python do usuário. DCF é determinístico e separa valor da firma, dívida, patrimônio e ações. Uma conta de DFC não é automaticamente fluxo de caixa livre: o usuário precisa validar o significado do vínculo.

Upload direto privado usa token temporário emitido por rota autenticada, origem validada e limite de tamanho. Processamento posterior verifica conteúdo, limita ZIP/texto/células/páginas e deduplica por hash. PDF digitalizado pode exigir OCR externo. O extrator é síncrono por documento e ainda não permite retomar a partir de uma página.

RAG indexa lotes de 12 chunks e recupera até seis trechos selecionados pelo proprietário. O modelo recebe dados como conteúdo não confiável, sem ferramentas de execução. Resposta JSON é validada: citações devem existir no conjunto recuperado, categorias são restritas e novos números são recusados. Isso não prova que toda inferência é verdadeira. Trechos de referência e rascunho editável ficam separados da resposta original. Nenhum cálculo financeiro é delegado ao modelo.

## Operação

Fila PostgreSQL usa claim atômico com SKIP LOCKED, lease de 120 segundos, token de posse e até três tentativas. Índice parcial impede duas tarefas ativas para a mesma fonte. Cron autenticado executa diariamente às 09:00 UTC e processa até três tarefas; limite diário não atende volumes arbitrários. Indexação de um livro pode requerer vários lotes manuais.

Há limites de chamadas, orçamento diário conservador, cache e erros sem credenciais. Configurações mostram somente presença das integrações. Downloads exigem login. URLs externas de coleta são controladas; configuração do provedor de IA é administrativa e HTTPS. CSP estática ainda usa unsafe-inline para scripts/estilos do Next; endurecimento por nonce e QA de CSP autenticado continuam pendentes. Não há trilha de auditoria genérica completa de todas as ações.

## Publicação e recuperação

GitHub → CI → Vercel; migrations são uma etapa administrativa separada, nunca executadas implicitamente no build. Neon e Blob exigem backup/retensão independentes. Faça branch de teste e backup antes de migrar. Rollback de código não desfaz SQL: prefira migration corretiva ou restauração em branch separada, com validação antes de trocar a conexão. Não apague banco/store para atualizar. Consulte o guia de instalação.
