/** Password policy shared by the browser and the API server so both agree. */
export function validatePassword(pw: string): string | null {
  if (!pw) return 'Enter a password.';
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) return 'Include upper- and lower-case letters.';
  if (!/\d/.test(pw)) return 'Include at least one number.';
  return null;
}
