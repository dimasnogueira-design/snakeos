# Painel remoto

Publicado em https://snake-control.vercel.app. Login configurado no ambiente privado da Vercel; nenhuma senha ou chave no código ou no GitHub.

A Vercel consulta o serviço no notebook por um túnel HTTPS Cloudflare autorizado pelo usuário. O navegador recebe somente os dados autorizados pelo painel. A chave de acesso ao serviço fica no servidor da Vercel.

O notebook precisa permanecer ligado, com internet e sem suspender. Serviço, worker WhatsApp e túnel precisam continuar ativos. O painel remoto não transforma o notebook em um serviço 24 horas na nuvem.

Após reiniciar o computador: iniciar SNAKE e WhatsApp pelos atalhos locais. Se o painel remoto indicar indisponibilidade, executar Reconectar-Painel-Remoto.cmd. Esse comando cria uma nova conexão e atualiza a URL privada na Vercel, mantendo o endereço público do painel. A reconexão pode exigir novo login oficial na Vercel se a sessão expirar. Não executar várias reconexões simultâneas.

Esta instalação usa um túnel temporário gratuito, sem garantia de disponibilidade. Para operação permanente, migrar o serviço para VPS ou configurar um túnel nomeado com domínio estável.

Verificado: painel autenticado retorna HTTP 200; sem login retorna HTTP 401; consulta remota retorna WhatsApp ready e modo observation; controle remoto mantém AUTO_SEND=false; layout em 390x844 sem erros no navegador.

IA continua simulada enquanto a chave da API não for cadastrada localmente e o teste habilitado. Não ativar Autônomo antes da QA e autorização explícita.
