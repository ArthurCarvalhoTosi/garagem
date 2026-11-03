import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import { type AccountStore, handleDeleteAccount } from './handler.ts';

const BUCKET = 'attachments';

export default {
  // 'user': only the account's own session deletes it. ctx.supabaseAdmin (service role) is what
  // may delete the key, the files and the user.
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const admin = ctx.supabaseAdmin;
    const store: AccountStore = {
      async deleteKey(userId) {
        const { error } = await admin.from('user_keys').delete().eq('user_id', userId);
        if (error) throw new Error(`delete key: ${error.code}`);
      },
      async listPhotos(userId, offset, limit) {
        const { data, error } = await admin.storage
          .from(BUCKET)
          .list(userId, { offset, limit, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw new Error(`list photos: ${error.name}`);
        return data.map((f) => `${userId}/${f.name}`);
      },
      async removePhotos(paths) {
        const { error } = await admin.storage.from(BUCKET).remove(paths);
        if (error) throw new Error(`remove photos: ${error.name}`);
      },
      async deleteUser(userId) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        // Already gone: an earlier run got this far.
        if (error && error.status !== 404) throw new Error(`delete user: ${error.status}`);
      },
    };

    try {
      return await handleDeleteAccount(req, ctx.userClaims!.id, store);
    } catch (e) {
      console.error('delete-account failed:', e instanceof Error ? e.message : 'unknown');
      return Response.json({ error: 'internal' }, { status: 500 });
    }
  }),
};
