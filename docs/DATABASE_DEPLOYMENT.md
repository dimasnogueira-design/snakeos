# Banco instalado — 2026-10-02

Projeto Supabase: venom-code-os (`topjkfflwrswtutlvbab`). A escolha posterior do usuário substitui a restrição inicial de não usar Supabase.

Schema privado `snake`: 23 tabelas, seis migrations registradas e RLS habilitada em todas as tabelas. `anon` e `authenticated` não têm acesso ao schema. As seis tabelas preexistentes em `public` foram preservadas. O modo inicial é `observation`.

O backend conecta diretamente ao PostgreSQL; o navegador não recebe credenciais do banco. Não adicionar `snake` aos schemas expostos pela Data API.

Configuração do backend na Oracle:

```dotenv
DATABASE_SCHEMA=snake
DATABASE_SSL=true
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/postgres
AUTO_SEND=false
MOCK_AI=true
AI_DRY_RUN=true
WHATSAPP_ENABLED=false
QA_APPROVED=false
AUTONOMOUS_AUTHORIZED=false
```

Obter a conexão no botão Connect do projeto. Preferir o session pooler na porta 5432 quando a VPS não tiver IPv6; o backend usa locks de sessão nas migrations. Não usar transaction pooler para migrations. Não incluir parâmetros que desabilitem a verificação do certificado TLS; instalar a CA confiável quando necessária. Guardar a senha apenas no ambiente do servidor.

O bootstrap SQL é destinado a uma instalação nova. Este projeto já foi instalado: executar `npm run migrate` aplica somente migrations futuras e verifica os hashes das existentes.

Verificação local após configurar o schema: TypeScript aprovado e 33 testes aprovados. A instalação do banco não significa que o backend, a Vercel ou o WhatsApp estejam implantados. Ainda é necessária a VPS Oracle para executar o serviço continuamente.
