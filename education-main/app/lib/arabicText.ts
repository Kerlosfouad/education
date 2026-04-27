const FORMS: Record<number, [string, string, string, string]> = {
  0x0621: ['\uFE80','\uFE80','\uFE80','\uFE80'],
  0x0622: ['\uFE81','\uFE82','\uFE81','\uFE82'],
  0x0623: ['\uFE83','\uFE84','\uFE83','\uFE84'],
  0x0624: ['\uFE85','\uFE86','\uFE85','\uFE86'],
  0x0625: ['\uFE87','\uFE88','\uFE87','\uFE88'],
  0x0626: ['\uFE89','\uFE8A','\uFE8B','\uFE8C'],
  0x0627: ['\uFE8D','\uFE8E','\uFE8D','\uFE8E'],
  0x0628: ['\uFE8F','\uFE90','\uFE91','\uFE92'],
  0x0629: ['\uFE93','\uFE94','\uFE93','\uFE94'],
  0x062A: ['\uFE95','\uFE96','\uFE97','\uFE98'],
  0x062B: ['\uFE99','\uFE9A','\uFE9B','\uFE9C'],
  0x062C: ['\uFE9D','\uFE9E','\uFE9F','\uFEA0'],
  0x062D: ['\uFEA1','\uFEA2','\uFEA3','\uFEA4'],
  0x062E: ['\uFEA5','\uFEA6','\uFEA7','\uFEA8'],
  0x062F: ['\uFEA9','\uFEAA','\uFEA9','\uFEAA'],
  0x0630: ['\uFEAB','\uFEAC','\uFEAB','\uFEAC'],
  0x0631: ['\uFEAD','\uFEAE','\uFEAD','\uFEAE'],
  0x0632: ['\uFEAF','\uFEB0','\uFEAF','\uFEB0'],
  0x0633: ['\uFEB1','\uFEB2','\uFEB3','\uFEB4'],
  0x0634: ['\uFEB5','\uFEB6','\uFEB7','\uFEB8'],
  0x0635: ['\uFEB9','\uFEBA','\uFEBB','\uFEBC'],
  0x0636: ['\uFEBD','\uFEBE','\uFEBF','\uFEC0'],
  0x0637: ['\uFEC1','\uFEC2','\uFEC3','\uFEC4'],
  0x0638: ['\uFEC5','\uFEC6','\uFEC7','\uFEC8'],
  0x0639: ['\uFEC9','\uFECA','\uFECB','\uFECC'],
  0x063A: ['\uFECD','\uFECE','\uFECF','\uFED0'],
  0x0641: ['\uFED1','\uFED2','\uFED3','\uFED4'],
  0x0642: ['\uFED5','\uFED6','\uFED7','\uFED8'],
  0x0643: ['\uFED9','\uFEDA','\uFEDB','\uFEDC'],
  0x0644: ['\uFEDD','\uFEDE','\uFEDF','\uFEE0'],
  0x0645: ['\uFEE1','\uFEE2','\uFEE3','\uFEE4'],
  0x0646: ['\uFEE5','\uFEE6','\uFEE7','\uFEE8'],
  0x0647: ['\uFEE9','\uFEEA','\uFEEB','\uFEEC'],
  0x0648: ['\uFEED','\uFEEE','\uFEED','\uFEEE'],
  0x0649: ['\uFEEF','\uFEF0','\uFEEF','\uFEF0'],
  0x064A: ['\uFEF1','\uFEF2','\uFEF3','\uFEF4'],
};

const NON_CONNECTING = new Set([
  0x0621,0x0622,0x0623,0x0624,0x0625,0x0627,0x0629,
  0x062F,0x0630,0x0631,0x0632,0x0648,0x0649,
]);

function isAr(cp: number) { return cp >= 0x0600 && cp <= 0x06FF; }

export function reshapeArabic(text: string): string {
  if (!/[\u0600-\u06FF]/.test(text)) return text;

  const cps = Array.from(text).map(c => c.codePointAt(0)!);

  // Lam-Alef ligatures
  const merged: number[] = [];
  for (let i = 0; i < cps.length; i++) {
    if (cps[i] === 0x0644 && i + 1 < cps.length) {
      if (cps[i+1] === 0x0622) { merged.push(0xFEF5); i++; continue; }
      if (cps[i+1] === 0x0623) { merged.push(0xFEF7); i++; continue; }
      if (cps[i+1] === 0x0625) { merged.push(0xFEF9); i++; continue; }
      if (cps[i+1] === 0x0627) { merged.push(0xFEFB); i++; continue; }
    }
    merged.push(cps[i]);
  }

  const shaped: string[] = [];
  for (let i = 0; i < merged.length; i++) {
    const cp = merged[i];

    // Lam-Alef: final vs isolated
    if (cp >= 0xFEF5 && cp <= 0xFEFC) {
      const prev = i > 0 ? merged[i-1] : 0;
      const prevConn = isAr(prev) && !NON_CONNECTING.has(prev) && prev < 0xFEF5;
      const base = cp % 2 === 1 ? cp : cp - 1;
      shaped.push(String.fromCodePoint(prevConn ? base + 1 : base));
      continue;
    }

    const forms = FORMS[cp];
    if (!forms) { shaped.push(String.fromCodePoint(cp)); continue; }

    const prev = i > 0 ? merged[i-1] : 0;
    const next = i < merged.length - 1 ? merged[i+1] : 0;
    const prevConn = isAr(prev) && !NON_CONNECTING.has(prev) && prev < 0xFEF5;
    const nextConn = isAr(next) && next !== 0x0621;
    const selfConn = !NON_CONNECTING.has(cp);

    let form: string;
    if (prevConn && nextConn && selfConn) form = forms[3];   // medial
    else if (prevConn)                    form = forms[1];   // final
    else if (nextConn && selfConn)        form = forms[2];   // initial
    else                                  form = forms[0];   // isolated

    shaped.push(form);
  }

  return shaped.reverse().join('');
}

// Cache Amiri font
let _amiriCache: ArrayBuffer | null = null;

export async function getAmiriFont(): Promise<ArrayBuffer> {
  if (_amiriCache) return _amiriCache;
  const res = await fetch('https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.woff2');
  if (!res.ok) throw new Error('Failed to fetch Amiri font');
  _amiriCache = await res.arrayBuffer();
  return _amiriCache;
}
