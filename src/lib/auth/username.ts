const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const INTERNAL_EMAIL_DOMAIN = "users.bizready.invalid";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value);
}

// Supabase password authentication requires an email identifier. This address is
// internal-only and uses the reserved .invalid TLD, so it cannot receive email.
export function usernameToInternalEmail(username: string) {
  return `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;
}
