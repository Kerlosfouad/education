export function getDoctorWhitelist(): string[] {
  const raw = process.env.DOCTOR_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isDoctorEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return getDoctorWhitelist().includes(normalized);
}

