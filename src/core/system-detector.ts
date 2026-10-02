export type SystemCategory = 'otp' | 'bank_auto' | 'marketing_auto' | 'generic_auto' | null;

export interface SystemDetection {
  isSystem: boolean;
  category: SystemCategory;
  severity: 'ignore' | 'info' | 'important';
  reason: string;
}

const otp = [
  /^\s*\d{4,8}\s*$/,
  /^\s*\d{3}[-\s]\d{3}\s*$/,
  /\b(?:c[oó]digo|verification code|one.time.password|token de acesso)\b.{0,40}\d{4,8}/i,
  /\bc[oó]digo de (seguran[cç]a|verifica[cç][aã]o|acesso)\b/i,
  /\b(n[aã]o compartilhe|nunca compartilhe).*c[oó]digo\b/i,
  /\bOTP\b/i
];

const automatic = [
  /criptografia de ponta a ponta|end.to.end encrypted|c[oó]digo de seguran[cç]a mudou|mensagem apagada|message deleted/i,
  /(?:compra|transa[cç][aã]o|pix) (?:aprovad[oa]|recebid[oa]|realizad[oa])|fatura dispon[ií]vel|saldo dispon[ií]vel/i,
  /para (?:sair|cancelar|parar).*(?:SAIR|STOP)|unsubscribe/i,
  /\bmensagem autom[aá]tica\b/i,
  /\bn[aã]o responda (a )?esta mensagem\b/i,
  /\bprotocolo\b.*\batendimento\b/i,
  /\bresponda\s+[0-9]\b/i
];

const bank = [
  /\b(Santander|Ita[uú]|Bradesco|Banco do Brasil|Caixa|Nubank|Inter)\b/i,
  /\b(fatura|boleto|vencimento|parcela|d[eé]bito|pix)\b/i
];

const marketing = [
  /\b(oferta|promo[cç][aã]o|aproveite|desconto|imperd[ií]vel)\b/i,
  /\bcompre agora|saiba mais\b/i
];

function any(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

export function detectSystemMessage(text: string): SystemDetection {
  const body = text.trim();
  if (!body) return { isSystem: false, category: null, severity: 'ignore', reason: 'sem texto' };

  if (any(body, otp)) {
    return { isSystem: true, category: 'otp', severity: 'ignore', reason: 'Código/OTP detectado; não responder nem enviar à IA.' };
  }

  const looksAutomatic = any(body, automatic);
  const looksBank = any(body, bank);
  const looksMarketing = any(body, marketing);

  if (looksAutomatic && looksBank) {
    const important = /\b(vencimento|atrasad[oa]|negativ|bloque|suspens|parcela|cobran[cç]a)\b/i.test(body);
    return {
      isSystem: true,
      category: 'bank_auto',
      severity: important ? 'important' : 'info',
      reason: 'Mensagem bancária automática detectada; registrar, não responder.'
    };
  }

  if (looksAutomatic && looksMarketing) {
    return { isSystem: true, category: 'marketing_auto', severity: 'ignore', reason: 'Marketing automático; ignorar sem gastar IA.' };
  }

  if (looksAutomatic) {
    return { isSystem: true, category: 'generic_auto', severity: 'info', reason: 'Automação genérica detectada; registrar, não responder.' };
  }

  return { isSystem: false, category: null, severity: 'ignore', reason: 'Mensagem humana ou não classificada como sistema.' };
}
