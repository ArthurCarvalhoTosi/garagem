// @supabase/server checks a token's signature and expiry, not which kind of token the project
// signed: the key and account functions only open for a signed-in person's session, never an
// anonymous one or another role (such as an OAuth client's, if the project ever issues them).
export function sessionUserId(
  claims: { sub?: unknown; role?: unknown; is_anonymous?: unknown } | null,
): string | null {
  const person = claims?.role === 'authenticated' && claims.is_anonymous !== true;
  return person && typeof claims.sub === 'string' ? claims.sub : null;
}
