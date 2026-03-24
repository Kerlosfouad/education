import QRCode from 'qrcode';
import { generateBarcode, generateRandomString } from './utils';
import { db } from './db';

// Generate QR Code data URL
export async function generateQRCode(data: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(data, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

// Generate QR Code for student
export async function generateStudentQRCode(studentId: string): Promise<string> {
  const baseUrl = process.env.QR_CODE_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const qrData = `${baseUrl}/verify/${studentId}`;
  return generateQRCode(qrData);
}

// Generate barcode for student
export function generateStudentBarcode(): string {
  return generateBarcode();
}

// Generate unique student code
export async function generateUniqueStudentCode(): Promise<string> {
  let code: string;
  let exists = true;
  
  do {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = generateRandomString(6).toUpperCase();
    code = `STU${year}${random}`;
    
    const existing = await db.student.findUnique({
      where: { studentCode: code },
    });
    
    exists = !!existing;
  } while (exists);
  
  return code;
}

// Generate unique barcode
export async function generateUniqueBarcode(): Promise<string> {
  let barcode: string;
  let exists = true;
  
  do {
    barcode = generateStudentBarcode();
    
    const existing = await db.student.findUnique({
      where: { barcode },
    });
    
    exists = !!existing;
  } while (exists);
  
  return barcode;
}

// Generate attendance session QR code
export async function generateAttendanceQRCode(sessionId: string): Promise<string> {
  const baseUrl = process.env.QR_CODE_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const qrData = `${baseUrl}/attendance/scan/${sessionId}`;
  return generateQRCode(qrData);
}

// Verify QR code data
export function parseQRCodeData(qrData: string): {
  type: 'student' | 'attendance' | 'unknown';
  id: string | null;
} {
  try {
    const baseUrl = process.env.QR_CODE_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    if (qrData.startsWith(`${baseUrl}/verify/`)) {
      const id = qrData.replace(`${baseUrl}/verify/`, '');
      return { type: 'student', id };
    }
    
    if (qrData.startsWith(`${baseUrl}/attendance/scan/`)) {
      const id = qrData.replace(`${baseUrl}/attendance/scan/`, '');
      return { type: 'attendance', id };
    }
    
    return { type: 'unknown', id: null };
  } catch {
    return { type: 'unknown', id: null };
  }
}

// Generate SVG barcode (for printing)
export function generateBarcodeSVG(barcode: string): string {
  // Simple Code 128-like barcode generation
  const barWidth = 2;
  const height = 80;
  const quietZone = 20;
  
  let x = quietZone;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${barcode.length * 12 + quietZone * 2}" height="${height + 30}">`;
  
  // Generate bars based on character codes
  for (let i = 0; i < barcode.length; i++) {
    const charCode = barcode.charCodeAt(i);
    const barCount = (charCode % 3) + 1;
    
    for (let j = 0; j < barCount; j++) {
      const width = ((charCode + j) % 3) + 1;
      svg += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="black"/>`;
      x += width + 1;
    }
    x += 2;
  }
  
  // Add text
  svg += `<text x="${(barcode.length * 12 + quietZone * 2) / 2}" y="${height + 20}" text-anchor="middle" font-family="monospace" font-size="14">${barcode}</text>`;
  svg += '</svg>';
  
  return svg;
}

// Generate QR code for app download
export async function generateAppDownloadQRCode(): Promise<string> {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return generateQRCode(appUrl);
}

// Generate verification code for attendance
export function generateAttendanceCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
