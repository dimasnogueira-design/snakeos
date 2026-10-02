# SNAKE CONTROL (Vercel)

Painel PWA do SNAKE OS. Não acessa PostgreSQL diretamente: chama o Core do Hostinger por HTTPS através de um proxy server-side, mantendo `SNAKE_ADMIN_KEY` fora do navegador.

## Deploy
1. Crie um projeto Vercel apontando para a pasta `admin`.
2. Configure `SNAKE_CORE_URL`, `SNAKE_ADMIN_KEY`, `ADMIN_USER` e `ADMIN_PASSWORD`.
3. Faça deploy.
4. No iPhone, abra no Safari e use **Adicionar à Tela de Início**.

O painel atualiza resumo e conversas a cada 5 segundos. Futuramente pode migrar para SSE/WebSocket sem alterar o banco.
