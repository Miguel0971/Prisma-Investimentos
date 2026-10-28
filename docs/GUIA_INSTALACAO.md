# Guia de instalação para iniciantes — Windows

Versão 0.2: mercado, CVM, fórmulas, documentos, biblioteca, IA e tarefas possuem implementação executável. A validação dos serviços privados em produção ainda depende das suas contas. Não envie senhas ou chaves no chat. Todas as credenciais são preenchidas localmente ou no painel do serviço.

## 1. Criar contas

Abra https://github.com → Sign up; https://vercel.com → Sign Up com GitHub; https://neon.com → Sign up. Ative autenticação em dois fatores. Confira planos e limites nos painéis: opções gratuitas não significam uso ilimitado. Armazenamento, tráfego, banco e APIs de IA podem gerar cobrança.

## 2. Instalar ferramentas

Instale Node.js LTS (Node 24 obrigatório) em https://nodejs.org, Git em https://git-scm.com/download/win e VS Code em https://code.visualstudio.com. Mantenha a opção de adicionar ao PATH. Reabra o terminal PowerShell:

```powershell
node --version
npm --version
git --version
```

Resultado: três números de versão. Se o Windows bloquear npm.ps1, use npm.cmd em vez de npm; não precisa alterar políticas globais do computador.

## 3. Abrir o código

Extraia o ZIP. Em VS Code → File → Open Folder, abra a pasta investimento que contém package.json. Terminal → New Terminal abre o terminal nessa pasta. Se o projeto já estiver no GitHub, alternativamente:

```powershell
git clone https://github.com/SEU_USUARIO/prisma-investimentos.git
cd prisma-investimentos
```

Substitua SEU_USUARIO. Não clone novamente se abriu o ZIP.

## 4. Instalar dependências

```powershell
npm ci
```

Aguarde terminar sem erro. Será criada node_modules. O lockfile fixa as versões. Evite npm audit fix --force sem revisar mudanças.

## 5. Criar Neon

No console Neon → New Project, preencha nome prisma-investimentos, escolha região próxima da hospedagem e crie. Use uma branch de desenvolvimento separada de produção. O resultado é um projeto com database e branch.

## 6. Copiar conexão

No projeto Neon → Connect, selecione branch/database e copie Connection string PostgreSQL. A string inclui senha: preserve os parâmetros SSL e nunca a publique. O driver desta aplicação usa Neon HTTP; banco PostgreSQL local precisa de outro driver.

## 7. Preparar variáveis

Na pasta do projeto:

```powershell
Copy-Item .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Abra .env.local no VS Code. Cole a conexão Neon em DATABASE_URL; o segredo aleatório gerado em NEXTAUTH_SECRET; mantenha NEXTAUTH_URL=http://localhost:3000. Não compartilhe a saída do gerador. Nenhum segredo deve receber prefixo NEXT_PUBLIC_. O Git ignora .env.local.

## 8. Executar migrações

```powershell
npm run db:migrate
npm run db:check
```

O primeiro aplica o SQL versionado. O segundo cria registros temporários, lê, verifica unicidade e exclusão em cascata, depois limpa. Deve imprimir PASS. Neon → SQL Editor: SELECT * FROM users; deve funcionar. db:generate é usado apenas após mudar src/db/schema.ts; não é necessário a cada instalação.

## 9. Configurar login GitHub

Acesse https://github.com/settings/developers → OAuth Apps → New OAuth App. Preencha Application name: Prisma local; Homepage URL: http://localhost:3000; Authorization callback URL: http://localhost:3000/api/auth/callback/github. Clique Register application. Copie Client ID para GITHUB_CLIENT_ID. Clique Generate a new client secret e copie para GITHUB_CLIENT_SECRET.

Abra https://api.github.com/users/SEU_USUARIO. Copie o campo numérico id (não login ou node_id) para OWNER_GITHUB_ID. A autorização usa esse identificador imutável. O banco precisa estar acessível para concluir o login.

## 10. Configurar Blob privado

Vercel → projeto → Storage → Create Database → Blob → Continue: escolha acesso Private e conecte ao projeto. Em Settings → Environment Variables, localize BLOB_READ_WRITE_TOKEN e copie seu valor para .env.local. Nunca use um store público para os documentos. Consulte https://vercel.com/docs/vercel-blob/private-storage se o painel mostrar opções diferentes. Armazenamento, operações e tráfego podem gerar cobrança.

Com o servidor iniciado, abra Central de documentos, escolha categoria e um arquivo de até 20 MB. Aguarde o progresso de envio e clique Processar. O resultado esperado é status pronto e um link para abrir os trechos extraídos. PDF digital, EPUB sem DRM, XLSX, CSV, TXT e Markdown são aceitos. PDF digitalizado sem texto exige OCR externo, ainda não integrado. O upload é direto para Blob; processamento ocorre depois no servidor. Arquivos grandes podem exceder o tempo do plano Vercel: comece com um arquivo pequeno.

## 11. Configurar Brapi

Em https://brapi.dev, crie conta → Dashboard → obtenha o token da API. Copie para BRAPI_TOKEN em .env.local. Confira cobertura e cotas do plano; o token não garante dados em tempo real. Reinicie o servidor após alterar variáveis. Abra Mercado, pesquise PETR4 e VALE3. O resultado deve exibir preço, horário informado pela fonte e histórico; troque o período. Alguns ativos/períodos exigem plano. Erros de acesso ou ausência de dados são mostrados sem inventar valores.

## 12. Configurar IA

A IA começa desligada. Escolha um provedor com protocolo compatível com `/chat/completions` e `/embeddings`, resposta JSON e embeddings de 1536 dimensões. Esta aplicação não suporta automaticamente todo provedor de IA.

Exemplo de configuração para API OpenAI: acesse https://platform.openai.com → projeto → API keys → Create new secret key. Configure faturamento e limites no painel. Em .env.local, preencha:

```dotenv
AI_ENABLED=true
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=SUBSTITUA_LOCALMENTE_PELA_CHAVE
AI_MODEL=SUBSTITUA_PELO_ID_DO_MODELO_COMPATIVEL
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_MAX_OUTPUT_TOKENS=900
AI_DAILY_TOKEN_BUDGET=100000
```

Para AI_MODEL, copie o identificador de um modelo disponível na sua conta em https://developers.openai.com/api/docs/models que suporte Chat Completions, mensagens system, `response_format: json_object` e `max_completion_tokens`. O campo é propositalmente configurável; nenhum modelo pago foi validado com credenciais nesta entrega. Modelos que consomem tokens de raciocínio podem precisar de um limite maior, até 1800 nesta versão. O parâmetro inclui esses tokens. Falhas de JSON/incompatibilidade são recusadas, sem resposta simulada.

AI_USD_PER_MILLION_TOKENS é opcional: preencha uma taxa média para uma estimativa aproximada, nunca como valor de fatura. O limite diário reserva conservadoramente o orçamento por chamada; uma chamada que falha também pode consumir reserva. O custo real depende de entrada, saída, embeddings e tabela do fornecedor. Assinatura do ChatGPT não substitui créditos da API.

Importe um documento autorizado, processe, abra Assistente e clique para indexar os lotes de trechos. Repita até completar todos os documentos selecionados. Faça uma pergunta sobre o texto. A resposta deve trazer referências clicáveis; perguntas sem contexto devem declarar ausência. Pode salvar uma versão editada do relatório e exportar Markdown. Mudar o modelo de embeddings exige reindexação. Não envie livros completos em cada pergunta: o aplicativo recupera no máximo seis trechos.

## 13. Iniciar localmente

```powershell
npm run dev
```

Abra http://localhost:3000. Sem as variáveis obrigatórias, aparece Configuração necessária. Com elas, clique Entrar com GitHub. Após autorizar com a conta proprietária, verá Visão geral. Ctrl+C encerra o servidor.

## 14. Testar

```powershell
npm run check
npm run db:check
```

Check executa lint, TypeScript, testes e build. No navegador: adicione PETR4, atualize e confira a persistência; adicione novamente e confira que não duplica; remova e atualize. Saia, abra /dashboard e confirme redirecionamento. Em outra janela anônima, tente outra conta GitHub: deve negar. Teste teclado, celular, recolhimento do menu e tema claro. Tema é temporário nesta versão.

Execute também, após o build:

```powershell
npm run test:smoke
npm run test:live
```

Smoke inicia um servidor temporário na porta 3100 e confirma que páginas e APIs privadas recusam visitantes. Live consulta Brapi e CVM reais e pode consumir cotas; requer internet. Os testes locais de integração usam PostgreSQL embarcado com pgvector, sem substituir o teste Neon da sua conta.

No navegador autenticado, valide cada módulo:

1. Mercado: PETR4, VALE3, ativo inválido e troca de períodos.
2. Empresas: busque Petrobras ou CNPJ 33000167000101, selecione DFP 2025 e ITR/FRE/IPE 2026. Abra a fonte oficial e compare data, versão e unidade.
3. Laboratório: crie fórmula, salve e recarregue; importe tests/fixtures/formula-modelo.csv, execute DCF e compare cenários. Vincule um campo monetário a uma conta CVM somente quando ela representar o conceito desejado.
4. Documentos: envie os formatos aceitos, processe e confira trechos contra o original. Importe tests/fixtures/relatorio-autorizado.pdf (fixture autorizada). Exclua e confirme que o download e os índices deixam de existir.
5. Assistente: indexe tudo, pergunte um conceito presente e outro ausente; abra cada citação; repita a pergunta para verificar reaproveitamento; edite/exporte relatório.
6. Configurações: cadastre fonte de sincronização e execute uma tarefa; verifique status e horário. Cadastre CRON_SECRET com 32 ou mais caracteres aleatórios para o cron autenticado.

OAuth, Blob, IA e persistência após redeploy precisam ser confirmados na sua conta. Simulações não comprovam esses serviços em produção.

## 15. Enviar ao GitHub

Crie repositório privado vazio em https://github.com/new, nome prisma-investimentos. Não adicione README automaticamente. Na pasta local:

```powershell
git init
git add .
git status
```

Confira que .env.local e node_modules NÃO aparecem. Depois:

```powershell
git commit -m "Implementa plataforma privada de investimentos"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/prisma-investimentos.git
git push -u origin main
```

Autentique pelo navegador se solicitado. Não coloque token na URL.

## 16. Importar Vercel

Acesse https://vercel.com/new → Import Git Repository → conecte GitHub → selecione repositório → Import. Framework: Next.js. Root Directory deve conter package.json. Se a pasta investimento estiver dentro do repositório, selecione-a. Use Node 24. vercel.json define build e instalação. Não use Sites como destino deste projeto.

## 17. Configurar produção

Project → Settings → Environment Variables: adicione DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET e OWNER_GITHUB_ID em Production. Use branch de banco e segredo exclusivos de produção. NEXTAUTH_URL: domínio HTTPS definitivo. Crie um segundo OAuth App GitHub com callback https://SEU_DOMINIO/api/auth/callback/github. Não dê a previews acesso ao banco privado de produção. Adicione também BRAPI_TOKEN, BLOB_READ_WRITE_TOKEN, CRON_SECRET e as variáveis AI_* que pretende ativar. O cron em vercel.json executa diariamente às 09:00 UTC (06:00 de Brasília), até três tarefas por chamada. Para volume maior, execute tarefas manualmente ou configure agendador/plano compatível; não há promessa de atualização a cada minuto.

## 18. Publicar

Aplique migrations no banco de produção em ambiente administrativo confiável antes do deploy. Não coloque migrações no build: builds simultâneos/previews não devem alterar produção. Clique Deploy. Espere Ready e domínio HTTPS. Alterar variáveis exige redeploy. Repita os testes do item 14, inclusive persistência após redeploy e login recusado. A publicação real não foi executada nesta entrega.

## 19. Falhas comuns

- npm não encontrado: reinstale Node e reabra VS Code.
- Build: rode npm ci e npm run check; confira versão Node e primeiro erro.
- Configuração necessária: confira seis variáveis obrigatórias, segredo com pelo menos 32 caracteres e ID numérico.
- OAuthCallback/AccessDenied: confira callback, Client ID/secret, proprietário e conexão/migração do banco.
- users não existe: rode db:migrate na branch correta.
- Banco inacessível: confira URL, SSL, branch e estado do serviço.
- Upload não funciona: confirme store privado, token conectado ao projeto, tamanho de até 20 MB e extensão permitida. Se enviado mas não processado, use Processar; PDF sem texto não recebe OCR automático.
- Cotações ausentes: confira token, cota, cobertura e mensagem do fornecedor. IA ausente: confira AI_ENABLED=true, modelos compatíveis, orçamento diário e indexação completa.
- extension vector ausente: confirme que as migrations foram aplicadas e que o usuário pode criar a extensão pgvector no Neon.
- Tarefa interrompida: aguarde expirar o lease (120 segundos) e execute novamente; há até três tentativas.

Nunca publique logs que contenham credenciais.

## 20. Atualizar e recuperar

Faça uma branch Git e uma branch Neon de testes. Rode npm ci, npm run check e db:check. Revise o SQL antes de aplicar migrations; prefira mudanças aditivas. Faça backup antes de alterações destrutivas. Configure a retenção/recuperação disponível no plano Neon e teste restauração em branch separada. Para backup lógico adicional, use pg_dump e pg_restore em ambiente seguro; cifre e restrinja acesso ao backup.

Rollback da Vercel reverte código, não banco. Prefira correção por migração nova. Em incidente, restaure em outra branch, verifique integridade e contagens e só então mude DATABASE_URL/republique. Não delete banco ou store para atualizar código. Rotacione NEXTAUTH_SECRET para invalidar todas as sessões em incidente. Banco e arquivos precisam de estratégias de backup distintas.

## Referências oficiais

- https://nextjs.org/docs/app/getting-started/installation
- https://next-auth.js.org/configuration/options
- https://next-auth.js.org/configuration/providers/oauth
- https://orm.drizzle.team/docs/migrations
- https://orm.drizzle.team/docs/tutorials/drizzle-with-neon
- https://vercel.com/docs/vercel-blob/private-storage

Menus e preços podem mudar; confira os painéis antes de contratar recursos.
