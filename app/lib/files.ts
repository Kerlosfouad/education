import { cloudinary } from '@/lib/cloudinary';

/**
 * Ensures filename is clean, safe, and has proper extension.
 */
export function sanitizeFilename(filename: string, defaultExt = 'pdf'): { safeAscii: string; utf8Name: string } {
  let clean = (filename || 'document').trim();
  // Remove trailing slashes or path separators
  clean = clean.replace(/[/\\?%*:|"<>]/g, '_');

  const ext = `.${defaultExt.replace(/^\./, '')}`;
  if (!clean.toLowerCase().endsWith(ext.toLowerCase())) {
    clean += ext;
  }

  // Create an ASCII-safe fallback filename
  const asciiBase = clean
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, '_')
    .trim();

  const safeAscii = asciiBase.length > ext.length ? asciiBase : `file_${Date.now()}${ext}`;

  return {
    safeAscii,
    utf8Name: clean,
  };
}

/**
 * Generate a route URL to securely view or download any file with guaranteed proper headers & extension
 */
export function getFileDownloadUrl(fileUrl?: string | null, filename = 'document.pdf', mode: 'inline' | 'download' = 'download'): string {
  if (!fileUrl) return '#';
  const cleanName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  return `/api/files/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(cleanName)}&mode=${mode}`;
}

/**
 * Fetch binary data for any fileUrl (Cloudinary restricted image/upload, Cloudinary raw, UploadThing, data:base64, etc.)
 */
export async function fetchFileBuffer(fileUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  // Strip fragment identifier if added for client-side hint
  const cleanUrl = fileUrl.split('#')[0];

  // 1. Data URL
  if (cleanUrl.startsWith('data:')) {
    const parts = cleanUrl.split(';base64,');
    if (parts.length === 2) {
      const mime = parts[0].replace('data:', '') || 'application/pdf';
      const buffer = Buffer.from(parts[1], 'base64');
      return { buffer, contentType: mime };
    }
  }

  // 2. Cloudinary blocked image/upload (e.g. assignments uploaded as image/upload with .pdf)
  if (cleanUrl.includes('cloudinary.com') && cleanUrl.includes('/image/upload/') && cleanUrl.endsWith('.pdf')) {
    const match = cleanUrl.match(/dr_emad_platform\/assignments\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const publicId = `dr_emad_platform/assignments/${match[1]}`;
      try {
        const privateUrl = cloudinary.utils.private_download_url(publicId, 'pdf', {
          resource_type: 'image',
          type: 'upload',
        });
        const res = await fetch(privateUrl);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          return { buffer: Buffer.from(arrayBuf), contentType: 'application/pdf' };
        }
      } catch (err) {
        console.warn('Cloudinary private download url error:', err);
      }
    }
  }

  // 3. Regular HTTP / HTTPS (UploadThing, Cloudinary raw, etc.)
  try {
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      let contentType = res.headers.get('content-type') || 'application/octet-stream';

      // Verify magic bytes for PDF (%PDF-)
      if (buffer.length >= 4 && buffer.toString('utf8', 0, 4) === '%PDF') {
        contentType = 'application/pdf';
      }

      return { buffer, contentType };
    }

    // If HTTP failed (e.g. 401 on Cloudinary), try Cloudinary authenticated download fallback
    if (cleanUrl.includes('cloudinary.com')) {
      const match = cleanUrl.match(/dr_emad_platform\/(.+?)(\.pdf)?$/);
      if (match) {
        const publicId = `dr_emad_platform/${match[1].replace(/\.pdf$/, '')}`;
        for (const resType of ['image', 'raw'] as const) {
          try {
            const privateUrl = cloudinary.utils.private_download_url(publicId, 'pdf', {
              resource_type: resType,
              type: 'upload',
            });
            const retryRes = await fetch(privateUrl);
            if (retryRes.ok) {
              const arrayBuf = await retryRes.arrayBuffer();
              return { buffer: Buffer.from(arrayBuf), contentType: 'application/pdf' };
            }
          } catch {}
        }
      }
    }

    throw new Error(`Failed to fetch file from storage: HTTP ${res.status}`);
  } catch (err: any) {
    // If it's a Cloudinary URL, one more attempt using resource API
    if (cleanUrl.includes('cloudinary.com')) {
      const match = cleanUrl.match(/dr_emad_platform\/(.+?)(\.pdf)?$/);
      if (match) {
        const publicId = `dr_emad_platform/${match[1].replace(/\.pdf$/, '')}`;
        for (const resType of ['image', 'raw'] as const) {
          try {
            const privateUrl = cloudinary.utils.private_download_url(publicId, 'pdf', {
              resource_type: resType,
              type: 'upload',
            });
            const retryRes = await fetch(privateUrl);
            if (retryRes.ok) {
              const arrayBuf = await retryRes.arrayBuffer();
              return { buffer: Buffer.from(arrayBuf), contentType: 'application/pdf' };
            }
          } catch {}
        }
      }
    }
    throw err;
  }
}
