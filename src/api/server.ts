import express from 'express';
import { z } from 'zod';
import { evaluateMessage } from '../core/agent.js';
import { handleIncoming } from '../core/orchestrator.js';
import { processIncomingMessage } from '../memory/process-message.js';
import { setContactMode, addConfirmedFact, loadOpenNegotiationContext, getAdminSummary, listAdminContacts, getAdminContact, setContactAutomationPaused, getAutomationMode, setAutomationMode } from '../db/repository.js';
import { env } from '../config/env.js';
import { transcribeBase64Audio } from '../services/transcribe.js';
import { setWhatsAppStatus } from '../db/repository.js';
import type { CaseContext, ContactMode, IncomingMessage } from '../types/domain.js';
import { ingressGate } from '../memory/ingress.js';
import { getContactProfile,listAlerts,loadMemory,saveMemory,alertAdmin,saveMessage } from '../db/repository.js';
import { buildContextForMessage } from '../memory/context-builder.js';
import { getUsageDashboard,resetCircuit } from '../cost/budget.js';
import { claimDeliveryPart,ackDelivery } from '../services/delivery.js';
import { pool } from '../db/pool.js';
import { MemorySchema } from '../services/intelligence.js';
import { timingSafeEqual } from 'node:crypto';
import { preflight } from '../policies/preflight.js';
import { detectSystemMessage } from '../core/system-detector.js';
import { isProtectedContact } from '../db/repository.js';

const MessageSchema = z.object({
  externalMessageId: z.string().min(1).max(200).optional(),
  contactId: z.string().min(1).max(150),
  contactName: z.string().max(120).optional(),
  chatId: z.string().min(1).max(150),
  isGroup: z.boolean(),
  fromMe: z.boolean().optional(),
  text: z.string().max(10000),
  timestamp: z.string().datetime({offset:true}),
  mediaType: z.enum(['audio', 'image', 'document', 'other']).optional()
});

const EvaluateSchema = z.object({ message: MessageSchema, context: z.any() });
const RouteEvaluateSchema = z.object({
  message: MessageSchema,
  context: z.object({ profile: z.any(), generic: z.any(), negotiation: z.any().optional() })
});

const ContactModeSchema = z.enum(['unknown','venom_sales','venom_support','negotiation','personal','protected','system']);

export function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '30mb' }));
  app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'snake-os-core', version: '0.6.0', autoSend:env.AUTO_SEND,dryRun:env.AI_DRY_RUN }));
  const matchesKey=(actual:string|undefined,expected:string)=>Boolean(actual && Buffer.byteLength(actual)===Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual),Buffer.from(expected)));

  const requireWorker = (req: any, res: any, next: any) => {
    if (!matchesKey(req.header('x-snake-worker-key'),env.SNAKE_WORKER_KEY)) return res.status(401).json({ error: 'unauthorized' });
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!matchesKey(req.header('x-snake-admin-key'),env.SNAKE_ADMIN_KEY)) return res.status(401).json({ error: 'unauthorized' });
    next();
  };

  app.post('/v1/evaluate', requireAdmin, async (req, res) => {
    if(!env.MOCK_AI&&!env.AI_DRY_RUN)return res.status(410).json({error:'Use persistent /v3/process'});
    try {
      const body = EvaluateSchema.parse(req.body);
      const result = await evaluateMessage(body.message as IncomingMessage, body.context as CaseContext);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Não foi possível concluir a operação.' });
    }
  });

  app.post('/v2/route-evaluate', requireAdmin, async (req, res) => {
    if(!env.MOCK_AI&&!env.AI_DRY_RUN)return res.status(410).json({error:'Use persistent /v3/process'});
    try {
      const body = RouteEvaluateSchema.parse(req.body);
      const result = await handleIncoming(body.message as IncomingMessage, body.context as any);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Não foi possível concluir a operação.' });
    }
  });

  // v0.3: endpoint real, monta contexto a partir do PostgreSQL.
  app.post('/v3/process', requireWorker, async (req, res) => {
    try {
      const message = MessageSchema.parse(req.body) as IncomingMessage;
      const result = await processIncomingMessage(message);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Não foi possível concluir a operação.' });
    }
  });

  app.put('/v3/contacts/:externalId/mode', requireAdmin, async (req, res) => {
    try {
      const mode = ContactModeSchema.parse(req.body.mode) as ContactMode;
      await setContactMode(req.params.externalId, mode);
      res.json({ ok: true, externalId: req.params.externalId, mode });
    } catch (error) {
      res.status(400).json({ error: 'Não foi possível concluir a operação.' });
    }
  });

  app.get('/v3/cases/:externalId', requireAdmin, async (req, res) => {
    try {
      const context = await loadOpenNegotiationContext(req.params.externalId);
      if (!context) return res.status(404).json({ error: 'Nenhum caso aberto encontrado.' });
      res.json(context);
    } catch (error) {
      res.status(400).json({ error: 'Não foi possível concluir a operação.' });
    }
  });

  app.post('/v3/cases/:externalId/facts', requireAdmin, async (req, res) => {
    try {
      const body = z.object({ key: z.string().min(1), value: z.string().min(1) }).parse(req.body);
      const context = await loadOpenNegotiationContext(req.params.externalId);
      if (!context) return res.status(404).json({ error: 'Nenhum caso aberto encontrado.' });
      const fact = await addConfirmedFact(context.caseId, body.key, body.value);
      res.json({ ok: true, fact });
    } catch (error) {
      res.status(400).json({ error: 'Não foi possível concluir a operação.' });
    }
  });



  app.post('/v5/worker/transcribe', requireWorker, async (req, res) => {
    try {
      const body = z.object({ filename: z.string().min(1).max(150), mimeType: z.string().min(1).max(100), dataBase64: z.string().min(1),message:MessageSchema }).parse(req.body);
      res.json(await transcribeBase64Audio(body));
    } catch (error) { res.status(400).json({ error: 'Não foi possível concluir a operação.' }); }
  });

  app.post('/v5/worker/status', requireWorker, async (req, res) => {
    try {
      const body = z.object({ status: z.string().min(1).max(40) }).parse(req.body);
      await setWhatsAppStatus(body.status);
      res.json({ ok: true });
    } catch (error) { res.status(400).json({ error: 'Não foi possível concluir a operação.' }); }
  });

  app.get('/v4/admin/summary', requireAdmin, async (_req, res) => {
    try { res.json(await getAdminSummary()); }
    catch (error) { res.status(500).json({ error: 'Não foi possível concluir a operação.' }); }
  });

  app.get('/v4/admin/contacts', requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(300, Math.max(1, Number(req.query.limit ?? 100)));
      res.json({ contacts: await listAdminContacts(limit) });
    } catch (error) { res.status(500).json({ error: 'Não foi possível concluir a operação.' }); }
  });

  app.get('/v4/admin/contacts/:externalId', requireAdmin, async (req, res) => {
    try {
      const data = await getAdminContact(req.params.externalId);
      if (!data) return res.status(404).json({ error: 'Contato não encontrado.' });
      res.json(data);
    } catch (error) { res.status(500).json({ error: 'Não foi possível concluir a operação.' }); }
  });

  app.patch('/v4/admin/contacts/:externalId', requireAdmin, async (req, res) => {
    try {
      const body = z.object({ mode: ContactModeSchema.optional(), automationPaused: z.boolean().optional() }).parse(req.body);
      if (body.mode) await setContactMode(req.params.externalId, body.mode as ContactMode);
      if (body.automationPaused !== undefined) await setContactAutomationPaused(req.params.externalId, body.automationPaused);
      res.json({ ok: true, contact: await getAdminContact(req.params.externalId) });
    } catch (error) { res.status(400).json({ error: 'Não foi possível concluir a operação.' }); }
  });

  app.get('/v4/admin/automation', requireAdmin, async (_req, res) => {
    res.json({ mode: await getAutomationMode(), masterAutoSend: env.AUTO_SEND });
  });

  app.patch('/v4/admin/automation', requireAdmin, async (req, res) => {
    try {
      const body = z.object({ mode: z.enum(['paused','observation','autonomous']) }).parse(req.body);
      await setAutomationMode(body.mode);
      res.json({ ok: true, mode: body.mode, masterAutoSend: env.AUTO_SEND });
    } catch (error) { res.status(400).json({ error: 'Não foi possível concluir a operação.' }); }
  });

  app.post('/v6/worker/gate',requireWorker,async(req,res)=>{
    const message=MessageSchema.parse(req.body);
    const gate=await ingressGate(message);
    if(!gate.allowed)return res.json({...gate,captureOnly:gate.reason==='contact_takeover'||gate.reason==='global_pause'});
    const profile=await getContactProfile(message.contactId,message.contactName);
    res.json({...gate,canTranscribe:env.AUDIO_ENABLED&&!env.AI_DRY_RUN&&!env.MOCK_AI&&!['unknown','protected','system'].includes(profile.defaultMode)});
  });
  app.post('/v6/worker/own',requireWorker,async(req,res)=>{
    const message=MessageSchema.parse(req.body);if(!message.fromMe)return res.status(400).json({error:'invalid_direction'});
    const gate=preflight({...message,fromMe:false});
    if(!gate.allowed || await isProtectedContact(message.contactId,message.contactName) || detectSystemMessage(message.text).isSystem)return res.json({ignored:true});
    await saveMessage(message,{author:'dimas'});res.json({ok:true});
  });
  app.post('/v6/worker/call',requireWorker,async(req,res)=>{
    const {from}=z.object({from:z.string().min(1).max(150)}).parse(req.body);
    const allow=new Set([env.RAFAELLA_CONTACT_ID,...env.CALL_ALLOWLIST_IDS.split(',')].map(s=>s.trim()).filter(Boolean));
    res.json({allow:allow.has(from)});
  });
  app.post('/v6/worker/delivery/:id/claim',requireWorker,async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id), index=z.number().int().min(0).max(2).parse(req.body.index);
    res.json(await claimDeliveryPart(id,index));
  });
  app.post('/v6/worker/delivery/:id/ack',requireWorker,async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id), body=z.object({index:z.number().int().min(0).max(2),externalMessageId:z.string().max(200).optional(),failed:z.boolean().optional()}).parse(req.body);
    await ackDelivery(id,body.index,body);res.json({ok:true});
  });
  app.get('/v4/admin/usage',requireAdmin,async(_req,res)=>res.json(await getUsageDashboard()));
  app.get('/v4/admin/alerts',requireAdmin,async(_req,res)=>res.json({alerts:await listAlerts()}));
  app.patch('/v4/admin/alerts/:id',requireAdmin,async(req,res)=>{
    const id=z.coerce.number().int().positive().parse(req.params.id);await pool.query('UPDATE alerts SET resolved_at=now() WHERE id=$1',[id]);res.json({ok:true});
  });
  app.patch('/v4/admin/limits',requireAdmin,async(req,res)=>{
    const limits=z.object({dailyUsd:z.number().min(0).max(1000),monthlyUsd:z.number().min(0).max(10000),softRatio:z.number().min(.1).max(1)}).parse(req.body);
    await pool.query("UPDATE system_settings SET setting_value=$1::jsonb,updated_at=now() WHERE setting_key='cost_limits'",[JSON.stringify(limits)]);
    await pool.query("INSERT INTO audit_logs(event_type,payload) VALUES('limits_changed',$1::jsonb)",[JSON.stringify(limits)]);res.json({ok:true});
  });
  app.post('/v4/admin/circuit/reset',requireAdmin,async(_req,res)=>{await resetCircuit();res.json({ok:true});});
  app.post('/v4/admin/estimate',requireAdmin,async(req,res)=>{
    const message=MessageSchema.parse(req.body);const gate=await ingressGate(message);
    if(!gate.allowed)return res.json({ignored:true,reason:gate.reason,estimatedTokens:0,estimatedCostMicros:0});
    const context=await buildContextForMessage(message);
    res.json({...await handleIncoming(message,context,{estimateOnly:true}),autoSend:false});
  });
  app.patch('/v4/admin/contacts/:externalId/memory',requireAdmin,async(req,res)=>{
    const memory=MemorySchema.parse(req.body);await saveMemory(req.params.externalId,memory);
    await pool.query("INSERT INTO audit_logs(event_type,payload) VALUES('memory_admin_updated',jsonb_build_object('externalId',$1::text))",[req.params.externalId]);res.json({ok:true});
  });
  app.use((error:any,_req:any,res:any,_next:any)=>{
    res.status(error instanceof z.ZodError?400:503).json({error:'Não foi possível concluir. Tente novamente pelo painel.',autoSend:false,reply:null});
  });

  return app;
}

