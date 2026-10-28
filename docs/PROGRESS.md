# Progresso — versão 0.2 — 28/10/2026

Esta é uma entrega incremental executável, não uma declaração de conclusão integral. `[x]` significa implementação com evidência no ambiente indicado; `[ ]` identifica pendência ou implementação sem teste conclusivo. Simulação testa o contrato e os erros, não comprova um serviço externo.

## Etapa A — Fundação

- [x] Next.js/TypeScript, navegação, tema e páginas: compilação, tipos e lint locais.
- [x] Autorização pelo ID GitHub e bloqueio sem credenciais: testes de política e HTTP.
- [x] Schema/migrations, relações, índices e persistência: PostgreSQL embarcado PGlite com pgvector, incluindo reabertura do banco.
- [ ] Implementado, mas sem teste conclusivo: login GitHub real e migrations/conexão no Neon do proprietário. Faltam credenciais de conta configuradas.
- [ ] QA visual autenticado, teclado e dispositivos em produção.

## Etapa B — Mercado

- [x] Adaptador Brapi, validação, TTL, deduplicação, histórico e indicadores: testes automatizados.
- [x] PETR4 e VALE3 consultadas em fornecedor real, com preço, horário e histórico. Veja VALIDACAO.md para execução e eventuais falhas posteriores.
- [x] Ativo inválido, resposta incompleta e API indisponível: testes de contrato com respostas simuladas.
- [x] Gráficos linha/candles e seleção de períodos: código compilado; indicadores com resultados conhecidos.
- [ ] Implementado, mas sem teste conclusivo: interação visual de todos os períodos e pesquisa por nome com plano contratado.
- [ ] Mercado fechado em situação real observada e provedor licenciado de tempo real. Status desconhecido permanece explícito quando ausente.

## Etapa C — Fundamentalista

- [x] Consulta real ao cadastro CVM e pacotes DFP/ITR/FRE/IPE da Petrobras, preservando publicação, referência, versão e escala.
- [x] DRE e suporte a balanço/fluxos, filtros, persistência normalizada e revisões por hash: testes e compilação.
- [x] Reapresentações e deduplicação: teste de banco e versões diferentes observadas nos dados oficiais.
- [x] Falha da fonte e CSV inconsistente: testes automatizados; parser ajustado ao CSV IPE real.
- [ ] Implementado, mas sem teste conclusivo: abertura de cada documento oficial pelo navegador do usuário.
- [ ] Coletor automático de páginas de RI e download/importação automática de PDFs oficiais. Links oficiais e importação manual estão disponíveis.

## Etapa D — Fórmulas

- [x] Editor, JSON/CSV/XLSX, variáveis, intervalos, unidades, versões, duplicação e arquivamento: testes de validação/persistência.
- [x] Linguagem matemática restrita, limites, divisão por zero, unidades incompatíveis e expressões maliciosas: testes automatizados.
- [x] DCF, cenários/sensibilidade e 14 métodos iniciais: resultados conferidos contra exemplos calculados.
- [x] Resultados históricos preservados; vínculo explícito com conta CVM e conversão REAL/MIL: testes com PostgreSQL e Decimal.
- [ ] Exclusão definitiva e restauração de fórmula arquivada; comparação visual de execuções arbitrárias além dos cenários DCF.
- [ ] Implementado, mas sem teste conclusivo: edição/importação pelo navegador autenticado de produção.

## Etapa E — Arquivos e biblioteca

- [x] Extratores PDF/EPUB/XLSX/CSV/TXT/Markdown, fixtures autorizadas, limites e conteúdo inválido: testes.
- [x] Emissão de token privado pelo SDK, bloqueio de origem/visitantes, deduplicação, processamento, metadados, busca e remoção de índices: testes locais; Blob simulado.
- [ ] Implementado, mas sem teste conclusivo: upload, download, persistência e exclusão no Blob privado real/Vercel. Falta store configurado.
- [ ] OCR opcional, capas e resumos estruturados automáticos dos livros.
- [ ] Processamento retomável de documentos grandes; atualmente há limites e processamento por arquivo.

## Etapa F — IA

- [x] Recuperação pgvector real em banco embarcado com embeddings de teste; escopo por documento/proprietário.
- [x] Lotes, cache, orçamento, limites, resposta JSON, referências e recusa de novos números: testes do adaptador com provedor simulado.
- [x] Prompt trata documentos como dados não confiáveis; testes incluem instruções maliciosas e citações inexistentes. Isso não garante resistência absoluta de qualquer modelo.
- [x] Resposta sem contexto, rascunho editável/exportável e exclusão de conversas associadas: testes/compilação.
- [ ] Implementado, mas sem teste conclusivo: embeddings e respostas de um modelo pago real, qualidade semântica, custo faturado e adversarial testing do modelo escolhido. Faltam provedor/modelos/chave configurados.

## Etapa G — Automação

- [x] Fila persistente, claim concorrente, lease, retentativa e recuperação: testes PostgreSQL.
- [x] Deduplicação de tarefas ativas, log de status, limite e cron protegido: testes locais e configuração versionada.
- [x] Atualização incremental CVM e indexação em lotes, fontes gerenciáveis: implementação compilada e contratos testados.
- [ ] Implementado, mas sem teste conclusivo: execução agendada real na Vercel. Cron diário processa até três tarefas; volumes maiores exigem ação/configuração adicional.

## Etapa H — Publicação

- [x] Código, lockfile, migrations, testes, fixtures, guia de instalação e configuração CI/deploy entregues.
- [x] Revisão local de segredos, autenticação, queries, tamanho e limites. Não equivale a auditoria externa.
- [ ] Deploy Vercel válido e validação das 12 condições de aceite no domínio real.
- [ ] Backup/restauração Neon e Blob executados em conta real; procedimento documentado.
- [ ] CSP por nonce, auditoria completa de ações e QA visual autenticado.

## Condições finais de aceite

| Condição                    | Evidência atual                     | Falta para aceite completo        |
| --------------------------- | ----------------------------------- | --------------------------------- |
| Entrar com segurança        | Política e bloqueio testados        | OAuth real                        |
| Pesquisar ação              | Adaptador e validação               | Pesquisa autenticada no navegador |
| Cotação real                | PETR4/VALE3 obtidas                 | Conferência no domínio            |
| Gráfico funcional           | Integração compilada e dados reais  | Interação visual                  |
| Dados verificáveis          | CVM real e contas preservadas       | Conferência visual por período    |
| Documentos oficiais         | Índices reais e links               | Abrir arquivos no navegador       |
| Fórmula própria             | Parser e versão persistida testados | Fluxo visual                      |
| Valuation salvo             | Cálculo e banco testados            | Neon real                         |
| Upload de documentos/livros | Extração e Blob simulado            | Blob real                         |
| IA com fontes               | RAG PostgreSQL, modelo simulado     | Provedor real e revisão semântica |
| Persistência após reabrir   | Banco embarcado reaberto            | Sessões/redeploy Neon/Blob        |
| Deploy Vercel               | Build local                         | Deploy e testes de produção       |

Não é necessário compartilhar segredos no chat. Siga GUIA_INSTALACAO.md para configurar cada serviço e executar os testes privados. Falhas reais devem permanecer visíveis; nenhum retorno fictício substitui um fornecedor indisponível.
