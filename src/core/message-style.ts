/**
 * Divide uma resposta em bolhas curtas de WhatsApp sem chamar IA novamente.
 * Evita textões e mantém o ritmo humano pedido por Dimas.
 */
export function splitWhatsAppBubbles(text: string, maxChars = 190, maxParts = 3): string[] {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const paragraph of paragraphs.length ? paragraphs : [clean]) {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph);
      continue;
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [paragraph];
    let current = '';
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length <= maxChars) current = candidate;
      else {
        if (current) chunks.push(current);
        current = sentence;
      }
    }
    if (current) chunks.push(current);
  }

  if (chunks.length <= maxParts) return chunks;
  return [...chunks.slice(0, maxParts - 1), chunks.slice(maxParts - 1).join(' ')];
}
