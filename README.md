# SNAKE OS v0.6

Venom Code: atendimento por texto, memória por contato, handoffs e controle de custos.

## Instalação atual

Notebook Windows. SNAKE CONTROL em http://127.0.0.1:13001, serviço em http://127.0.0.1:18788. Banco PostgreSQL incorporado persistente em data/private/postgres. Sessão do WhatsApp e temporários no D:, conforme configuração privada. O schema snake do projeto Supabase venom-code-os foi preparado, mas esta instalação ainda usa o banco local.

Executar Iniciar-Snake.cmd e Conectar-Whatsapp.cmd. Manter o notebook ligado, com internet e sem suspender. Login em data/private/ACESSO-PAINEL.txt. Nunca publicar a pasta privada ou as sessões.

## Segurança e custos

Envio automático desligado. Inicialização força Observação. Grupos, Rafaella/contatos protegidos, códigos e notificações automáticas não passam pela IA. Mensagens durante atendimento humano permanecem no histórico, sem geração de rascunhos. Duplicatas não repetem chamadas. Chamadas fora da lista autorizada são rejeitadas. Áudio recebido só pode ser transcrito quando habilitado e relevante; nunca há envio de áudio.

IA inicialmente simulada. Configurar-IA-Teste.cmd aceita uma chave local com entrada oculta e proteção do Windows. O teste pago fica restrito ao contato previamente cadastrado, com limites de US$ 0,10/dia e US$ 0,50/mês, corte preventivo a 80% e AUTO_SEND=false. Reiniciar por Iniciar-Snake.cmd após configurar. Chaves nunca vão ao navegador ou ao GitHub.

Contexto compacto: memória estruturada, fatos com fontes, compromissos, tom e até 16 mensagens recentes; histórico antigo só recuperado quando explicitamente necessário. Modelo econômico para rotina, modelo forte para casos complexos. Estimativas sem chamada paga e custos por função/modelo no painel. Falhas de uso incerto mantêm reserva de custo e exigem revisão.

## Publicação

Painel Next.js em admin/, preparado para Vercel. Segredos de produção: ADMIN_USER, ADMIN_PASSWORD, SNAKE_CORE_URL (HTTPS) e SNAKE_ADMIN_KEY. O serviço continua no notebook; acesso remoto exige conexão HTTPS autorizada. Enquanto o notebook ou a conexão estiver desligado, o painel mostra indisponibilidade. Não expor diretamente as portas do serviço no roteador.

Implantação futura em VPS: Dockerfile e docker-compose.production.yml. Configurar DATABASE_URL, DATABASE_SCHEMA=snake, DATABASE_SSL=true e chaves fortes. Instalar migrations com npm run migrate:production. WhatsApp é um perfil separado, desativado por padrão. Migrar o banco local com serviço parado e backup, e reconectar o WhatsApp se necessário.

## Verificação

npm test: 38 testes. Backend, worker e painel compilados. Testes de proteção, takeover, deduplicação, PostgreSQL, custos, limites, memória, importação e restrição de IA. Provider simulado nos testes; nenhuma chamada paga para verificar controles. Conexão real do WhatsApp e recebimento/classificação local confirmados.

A IA real, a autonomia e a implantação pública precisam de verificações próprias. QA_APPROVED e AUTONOMOUS_AUTHORIZED permanecem false. Não habilitar envio autônomo sem QA e autorização explícita.

Ver README-NOTEBOOK.md e docs/DATABASE_DEPLOYMENT.md.
