# SNAKE no notebook

Primeira instalação local: painel e serviço em Observação, com IA simulada, sem envio automático e sem conexão inicial ao WhatsApp.

Iniciar: executar `Start-Snake.ps1` na pasta do projeto. O painel abre em http://127.0.0.1:13001. Usuário e senha ficam em `data/private/local-access.json`; não compartilhar esse arquivo. Para encerrar, pressionar Ctrl+C na janela do serviço.

O banco PostgreSQL local persiste em `data/private/postgres`, sem dados de demonstração. Nesta instalação, esses dados ficam no notebook; o banco Supabase preparado permanece separado até configurar a conexão e migrar. Nunca executar duas instâncias sobre a mesma pasta de banco.

O notebook precisa estar ligado, conectado à internet e sem suspender durante o horário desejado. Não abrir essas portas no roteador. A sessão de WhatsApp é configurada em uma etapa separada depois de cadastrar o número protegido da Rafaella e conferir os bloqueios. Nenhuma chamada paga de IA ocorre nesta configuração; transcrição também fica desligada até ativação controlada.

WhatsApp: executar `Start-Whatsapp.ps1` com o serviço já iniciado. Escanear o QR no celular em Aparelhos conectados. A janela precisa continuar aberta. Rafaella está cadastrada na configuração privada; grupos, contatos protegidos e códigos são ignorados. O worker apenas registra mensagens permitidas e cria rascunhos simulados. Ele rejeita chamadas fora da lista autorizada e nunca envia áudio.

Neste notebook, a sessão e os caches do Chrome do SNAKE foram configurados em `D:\SnakeOS\whatsapp`, e os temporários em `D:\SnakeOS\temp`. A configuração fica em `data/private/notebook-settings.json`. O banco local e o painel continuam na pasta original. A cópia anterior da sessão no C: foi preservada. Não compartilhar nem publicar as pastas de sessão.

Dependências já instaladas nesta entrega local. Para reinstalar: `npm ci`, `npm ci --prefix admin`, `npm ci --prefix workers/whatsapp`, `npm run build` e `npm run build --prefix admin`.

Migração futura: parar o serviço, fazer backup da pasta privada e importar o banco para PostgreSQL da VPS/Supabase. Copiar a sessão do WhatsApp com o worker parado, ou reconectar pelo QR. Manter `AUTO_SEND=false` até QA e autorização explícita.
