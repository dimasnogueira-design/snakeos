import { env } from './config/env.js';
import { createServer } from './api/server.js';

const app = createServer();
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`SNAKE OS Core v0.3 rodando na porta ${env.PORT}`);
  console.log(`MOCK_AI=${env.MOCK_AI} AUTO_SEND=${env.AUTO_SEND} WHATSAPP_ENABLED=${env.WHATSAPP_ENABLED}`);
});
