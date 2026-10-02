import 'dotenv/config';
import { z } from 'zod';

const bool = z.preprocess((v) => {
  if (v === undefined || v === null || v === '') return undefined;
  return String(v).toLowerCase() === 'true';
}, z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().default('postgresql://snake_os:change_me@localhost:5432/snake_os'),
  DATABASE_SCHEMA: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/).default('snake'),
  DATABASE_SSL: bool.default(false),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_FAST: z.string().default(''),
  OPENAI_MODEL_NEGOTIATION: z.string().default(''),
  MOCK_AI: bool.default(true),
  AUTO_SEND: bool.default(false),
  WHATSAPP_ENABLED: bool.default(false),
  TELEGRAM_ENABLED: bool.default(false),
  PROTECTED_CONTACT_NAMES: z.string().default('Rafaella'),
  PROTECTED_CONTACT_IDS: z.string().default(''),
  CONTEXT_RECENT_MESSAGES: z.coerce.number().int().min(12).max(20).default(16),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(1400).default(700),
  OPENAI_TRANSCRIBE_MODEL: z.string().default('gpt-4o-mini-transcribe'),
  AI_DRY_RUN: bool.default(true),
  AI_TEST_ONLY: bool.default(false),
  AI_TEST_CONTACT_IDS: z.string().default(''),
  AI_DAILY_LIMIT_USD: z.coerce.number().nonnegative().max(1000).default(1),
  AI_MONTHLY_LIMIT_USD: z.coerce.number().nonnegative().max(10000).default(15),
  AI_SOFT_LIMIT_RATIO: z.coerce.number().min(.1).max(1).default(.8),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
  AI_CONTEXT_MAX_BYTES: z.coerce.number().int().min(2000).max(18000).default(12000),
  AI_FAILURE_THRESHOLD: z.coerce.number().int().min(1).max(10).default(3),
  QA_APPROVED: bool.default(false),
  AUTONOMOUS_AUTHORIZED: bool.default(false),
  CALL_ALLOWLIST_IDS: z.string().default(''),
  RAFAELLA_CONTACT_ID: z.string().default(''),
  AUDIO_ENABLED: bool.default(false),
  AUDIO_MAX_SECONDS: z.coerce.number().int().min(1).max(300).default(120),
  SNAKE_WORKER_KEY: z.string().default('change-me-worker'),
  SNAKE_ADMIN_KEY: z.string().default('change-me-before-production')
});

const parsed = schema.parse(process.env);

if (parsed.NODE_ENV === 'production' && [parsed.SNAKE_ADMIN_KEY, parsed.SNAKE_WORKER_KEY].some(k => k.startsWith('change-me') || k.length < 32)) {
  throw new Error('Configure chaves administrativas e de worker com pelo menos 32 caracteres.');
}
if (parsed.AUTO_SEND && (!parsed.QA_APPROVED || !parsed.AUTONOMOUS_AUTHORIZED)) {
  throw new Error('AUTO_SEND exige QA_APPROVED e AUTONOMOUS_AUTHORIZED.');
}

if (!parsed.MOCK_AI && (!parsed.OPENAI_API_KEY || !parsed.OPENAI_MODEL_FAST || !parsed.OPENAI_MODEL_NEGOTIATION)) {
  throw new Error('Com MOCK_AI=false, configure OPENAI_API_KEY, OPENAI_MODEL_FAST e OPENAI_MODEL_NEGOTIATION no ambiente.');
}

export const env = {
  ...parsed,
  protectedContactNames: ['rafaella',...parsed.PROTECTED_CONTACT_NAMES.split(',')].map(s => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()).filter(Boolean),
  protectedContactIds: [parsed.RAFAELLA_CONTACT_ID, ...parsed.PROTECTED_CONTACT_IDS.split(',')].map(s => s.trim()).filter(Boolean)
};
