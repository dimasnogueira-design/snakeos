import { NextRequest, NextResponse } from 'next/server';
import {adminAuthorized} from '../../../../lib/auth';

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if(!adminAuthorized(req.headers.get('authorization')))return new NextResponse('Authentication required',{status:401,headers:{'WWW-Authenticate':'Basic realm="SNAKE CONTROL"','Cache-Control':'no-store'}});
  if(req.method!=='GET'&&req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'origin_rejected'},{status:403});
  const base = process.env.SNAKE_CORE_URL;
  const key = process.env.SNAKE_ADMIN_KEY;
  if (!base || !key) return NextResponse.json({ error: 'Core not configured' }, { status: 503 });
  const { path } = await ctx.params;
  const commander = path[0] === 'commander';
  const validCommander = commander && path.length === 2 && (
    (path[1] === 'status' && req.method === 'GET') ||
    (path[1] === 'missions' && ['GET','POST'].includes(req.method))
  );
  const validLegacy = !commander && ['summary','contacts','automation','usage','alerts','limits','circuit','estimate'].includes(path[0]) &&
    !path.some(p=>p==='..'||p==='.'||p.includes('/')||p.includes('\\'));
  if(!validCommander&&!validLegacy)return NextResponse.json({error:'invalid_path'},{status:400});
  const suffix = path.map(encodeURIComponent).join('/');
  const query = req.nextUrl.search;
  const init: RequestInit = {
    method: req.method,
    headers: { 'content-type': 'application/json', 'x-snake-admin-key': key },
    cache: 'no-store',
    signal: AbortSignal.timeout(25000)
  };
  if (!['GET','HEAD'].includes(req.method)) init.body = await req.text();
  try {
  const versionedPath = commander ? `/v7/admin/${suffix}` : `/v4/admin/${suffix}`;
  const upstream = await fetch(`${base.replace(/\/$/, '')}${versionedPath}${query}`, init);
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { 'content-type': 'application/json','Cache-Control':'no-store' } });
  }catch{return NextResponse.json({error:'O servidor está indisponível. Tente novamente.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

export const GET = proxy;
export const PATCH = proxy;
export const POST = proxy;
