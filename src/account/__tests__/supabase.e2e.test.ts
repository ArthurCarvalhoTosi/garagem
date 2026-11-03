/**
 * @jest-environment node
 */
// Deleting the account against a real local Supabase: the delete-account Edge Function, the
// cascades, the photo bucket and the access records. Skipped unless SYNC_E2E=1; needs
// `npx supabase start` (with storage-api) and `npx supabase functions serve` running:
//   SYNC_E2E=1 npx jest src/account/__tests__/supabase.e2e.test.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const e2e = process.env.SYNC_E2E ? describe : describe.skip;

function localStack(): { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string } {
  const out: string = require('child_process').execSync('npx supabase status -o json', {
    encoding: 'utf8',
  });
  return JSON.parse(out.slice(out.indexOf('{')));
}
// jest-expo replaces the global fetch with a stub, even in the node environment.
const fetch = require('node-fetch');
const psql = (sql: string): string =>
  require('child_process')
    .execFileSync(
      'docker',
      ['exec', 'supabase_db_garagem', 'psql', '-U', 'postgres', '-tAc', sql],
      {
        encoding: 'utf8',
      },
    )
    .trim();

const {
  API_URL: API,
  PUBLISHABLE_KEY: PUBLISHABLE,
  SECRET_KEY: SECRET,
} = process.env.SYNC_E2E ? localStack() : ({} as ReturnType<typeof localStack>);
const admin = () =>
  createClient(API, SECRET, { auth: { persistSession: false }, global: { fetch } });

async function signedInClient(email: string): Promise<{ sb: SupabaseClient; id: string }> {
  const created = await admin().auth.admin.createUser({
    email,
    password: 'local-test-pass-123',
    email_confirm: true,
  });
  if (created.error) throw created.error;
  const sb = createClient(API, PUBLISHABLE, { auth: { persistSession: false }, global: { fetch } });
  const { error } = await sb.auth.signInWithPassword({ email, password: 'local-test-pass-123' });
  if (error) throw error;
  return { sb, id: created.data.user.id };
}

/** Everything an account leaves in the cloud: a key, a row, a dossier link, photos. */
async function fillAccount(sb: SupabaseClient, id: string, photos: number) {
  await admin()
    .from('user_keys')
    .insert({ user_id: id, wrapped_dek: '\\x' + '00'.repeat(60), kek_version: 1 })
    .throwOnError();
  await sb
    .from('sync_records')
    .insert({
      table_name: 'vehicles',
      id: '0192b3c4-0000-7000-8000-000000000001',
      updated_at: new Date().toISOString(),
      ciphertext: '\\x01',
      nonce: '\\x' + '00'.repeat(12),
      key_version: 1,
    })
    .throwOnError();
  await sb
    .from('dossier_shares')
    .insert({
      vehicle_id: '0192b3c4-0000-7000-8000-000000000001',
      token_hash: '\\x' + id.replace(/-/g, '').padEnd(64, '0'),
      ciphertext: '\\x01',
    })
    .throwOnError();
  for (let i = 0; i < photos; i++) {
    const name = `${id}/0192b3c4-0000-7000-8000-${String(i).padStart(12, '0')}.bin`;
    const { error } = await sb.storage
      .from('attachments')
      .upload(name, Uint8Array.of(1, 2, 3).buffer, { contentType: 'application/octet-stream' });
    if (error) throw error;
  }
  await sb.rpc('log_access').throwOnError();
}

const leftovers = (id: string) =>
  psql(`select
    (select count(*) from auth.users where id = '${id}') || ',' ||
    (select count(*) from public.user_keys where user_id = '${id}') || ',' ||
    (select count(*) from public.sync_records where user_id = '${id}') || ',' ||
    (select count(*) from public.dossier_shares where user_id = '${id}') || ',' ||
    (select count(*) from storage.objects where bucket_id = 'attachments' and name like '${id}/%') || ',' ||
    (select count(*) from public.access_log where user_id = '${id}')`);

e2e('delete account against local Supabase', () => {
  test('leaves nothing of the account but its access records; another account is untouched', async () => {
    const run = Date.now();
    const ana = await signedInClient(`ana-del-${run}@test.local`);
    const bia = await signedInClient(`bia-del-${run}@test.local`);
    await fillAccount(ana.sb, ana.id, 3);
    await fillAccount(bia.sb, bia.id, 1);
    expect(leftovers(ana.id)).toBe('1,1,1,1,3,1');

    const res = await ana.sb.functions.invoke('delete-account', { method: 'POST' });
    expect(res.error).toBeNull();
    expect(res.data).toEqual({ deleted: true });

    expect(leftovers(ana.id)).toBe('0,0,0,0,0,1');
    expect(leftovers(bia.id)).toBe('1,1,1,1,1,1');

    // The phone then signs out locally; the server already forgot the user.
    expect((await ana.sb.auth.signOut({ scope: 'local' })).error).toBeNull();
  });

  test('a run repeated after the user is gone still answers ok', async () => {
    const cleo = await signedInClient(`cleo-del-${Date.now()}@test.local`);
    // A second phone of the same account, still holding a valid token.
    const { data } = await cleo.sb.auth.getSession();
    const other = createClient(API, PUBLISHABLE, {
      auth: { persistSession: false },
      global: { fetch, headers: { Authorization: `Bearer ${data.session!.access_token}` } },
    });
    await cleo.sb.functions.invoke('delete-account', { method: 'POST' });
    const again = await other.functions.invoke('delete-account', { method: 'POST' });
    expect(again.error).toBeNull();
  });

  test('without a session nothing is deleted', async () => {
    const anon = createClient(API, PUBLISHABLE, {
      auth: { persistSession: false },
      global: { fetch },
    });
    const res = await anon.functions.invoke('delete-account', { method: 'POST' });
    expect(res.error).not.toBeNull();
  });
});
