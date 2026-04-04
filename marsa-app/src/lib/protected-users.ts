// Protected accounts that can NEVER be deleted
// Uses phone numbers as primary identifiers
export const PROTECTED_PHONES = [
  "0500000000", // Admin: Mohammed Mosa
];

// Legacy email protection (for backward compat)
export const PROTECTED_EMAILS = [
  "m.mosa@bmarsa.com",
];

export function isProtectedUser(identifier: string): boolean {
  const lower = identifier.toLowerCase();
  return PROTECTED_PHONES.includes(lower) || PROTECTED_EMAILS.includes(lower);
}
