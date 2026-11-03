import { assertEquals, assertRejects } from '@std/assert';
import { type AccountStore, handleDeleteAccount, PHOTO_PAGE } from './handler.ts';

const USER = '00000000-0000-0000-0000-00000000000a';
const post = () => new Request('http://local/delete-account', { method: 'POST' });

/** A fake backend that records every step, with `photos` files in the user's folder. */
function backend(photos: number, fail?: keyof AccountStore) {
  const steps: string[] = [];
  let files = Array.from({ length: photos }, (_, i) => `${USER}/${String(i).padStart(5, '0')}.bin`);
  // Records the step, then runs it unless it is the one set to fail.
  const step = <T>(name: keyof AccountStore, detail: string, run: () => T): Promise<T> => {
    steps.push(`${name} ${detail}`);
    return name === fail ? Promise.reject(new Error(name)) : Promise.resolve(run());
  };
  const store: AccountStore = {
    deleteKey: (userId) => step('deleteKey', userId, () => {}),
    listPhotos: (userId, offset, limit) =>
      step('listPhotos', `${offset}`, () =>
        files.filter((f) => f.startsWith(`${userId}/`)).slice(offset, offset + limit),
      ),
    removePhotos: (paths) =>
      step('removePhotos', `${paths.length}`, () => {
        files = files.filter((f) => !paths.includes(f));
      }),
    deleteUser: (userId) => step('deleteUser', userId, () => {}),
  };
  return { store, steps, files: () => files };
}

Deno.test('shreds the key, empties the photo folder, then deletes the user', async () => {
  const { store, steps, files } = backend(3);
  const res = await handleDeleteAccount(post(), USER, store);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
  assertEquals(await res.json(), { deleted: true });
  assertEquals(steps, [
    `deleteKey ${USER}`,
    'listPhotos 0',
    'removePhotos 3',
    `deleteUser ${USER}`,
  ]);
  assertEquals(files(), []);
});

Deno.test('reads every page of photos before removing any', async () => {
  const { store, steps, files } = backend(PHOTO_PAGE * 2 + 5);
  await (await handleDeleteAccount(post(), USER, store)).body?.cancel();
  assertEquals(steps.slice(1, 4), [
    'listPhotos 0',
    `listPhotos ${PHOTO_PAGE}`,
    `listPhotos ${PHOTO_PAGE * 2}`,
  ]);
  assertEquals(
    steps.filter((s) => s.startsWith('removePhotos')),
    [`removePhotos ${PHOTO_PAGE}`, `removePhotos ${PHOTO_PAGE}`, 'removePhotos 5'],
  );
  assertEquals(files(), []);
});

Deno.test('no photos: nothing to remove', async () => {
  const { store, steps } = backend(0);
  await (await handleDeleteAccount(post(), USER, store)).body?.cancel();
  assertEquals(steps, [`deleteKey ${USER}`, 'listPhotos 0', `deleteUser ${USER}`]);
});

Deno.test('a failing step stops the run before the user goes (index.ts answers 500)', async () => {
  for (const fail of ['deleteKey', 'listPhotos', 'removePhotos'] as const) {
    const { store, steps } = backend(2, fail);
    await assertRejects(() => handleDeleteAccount(post(), USER, store));
    assertEquals(steps.includes(`deleteUser ${USER}`), false, fail);
  }
});

Deno.test('only POST deletes', async () => {
  const { store, steps } = backend(1);
  const res = await handleDeleteAccount(new Request('http://local/delete-account'), USER, store);
  assertEquals(res.status, 405);
  await res.body?.cancel();
  assertEquals(steps, []);
});
