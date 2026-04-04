// Protected accounts that can NEVER be deleted
// Add emails of critical system accounts here
export const PROTECTED_EMAILS = [
  "m.mosa@bmarsa.com",
];

export function isProtectedUser(email: string): boolean {
  return PROTECTED_EMAILS.includes(email.toLowerCase());
}
