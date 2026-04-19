// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: bidiFactory } = require('bidi-js');

const bidi = bidiFactory();

export function prepareArabicText(text: string): string {
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  if (!hasArabic) return text;
  try {
    const embeddingLevels = bidi.getEmbeddingLevels(text, 'rtl');
    const reordered = bidi.getReorderedString(text, embeddingLevels);
    return reordered;
  } catch {
    return text;
  }
}

// Cache Amiri font in memory
let _amiriCache: ArrayBuffer | null = null;

export async function getAmiriFont(): Promise<ArrayBuffer> {
  if (_amiriCache) return _amiriCache;
  // Try local file first
  try {
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const localPath = path.join(process.cwd(), 'public', 'fonts', 'Amiri-Regular.ttf');
    if (fs.existsSync(localPath)) {
      const buf = fs.readFileSync(localPath);
      _amiriCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      return _amiriCache;
    }
  } catch {}
  // Fallback: Google Fonts CDN
  const res = await fetch('https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.woff2');
  if (!res.ok) throw new Error('Failed to fetch Amiri font');
  _amiriCache = await res.arrayBuffer();
  return _amiriCache;
}
