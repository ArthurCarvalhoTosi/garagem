import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import { sessionUserId } from '../_shared/session.ts';
import { handleUserKey, type KeyStore } from './handler.ts';
import { fromByteaHex, loadKeks, toByteaHex } from './keys.ts';

// Fails at boot, not per request, when the KEKS secret is missing or malformed.
const keks = await loadKeks(Deno.env.get('KEKS'));

export default {
  // 'user': only a valid session JWT gets in; ctx.supabaseAdmin bypasses RLS, which
  // user_keys needs because app users have no grants on it.
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const userId = sessionUserId(ctx.jwtClaims);
    if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const admin = ctx.supabaseAdmin;
    const store: KeyStore = {
      async read(userId) {
        const { data, error } = await admin
          .from('user_keys')
          .select('wrapped_dek, kek_version')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw new Error(`read user key: ${error.code}`);
        return data && { wrapped: fromByteaHex(data.wrapped_dek), kekVersion: data.kek_version };
      },
      async insertIfAbsent(userId, key) {
        const { error } = await admin
          .from('user_keys')
          .upsert(
            { user_id: userId, wrapped_dek: toByteaHex(key.wrapped), kek_version: key.kekVersion },
            { onConflict: 'user_id', ignoreDuplicates: true },
          );
        if (error) throw new Error(`store user key: ${error.code}`);
      },
    };

    try {
      return await handleUserKey(req, userId, store, keks);
    } catch (e) {
      // Only the message: never the key material, and no details for the caller.
      console.error('user-key failed:', e instanceof Error ? e.message : 'unknown');
      return Response.json({ error: 'internal' }, { status: 500 });
    }
  }),
};
