// Deleting the account from the app (slice 6). See "Fatia 6" in section 12 of
// decisoes_projeto_manutencao_veicular.md.

export interface AccountStore {
  /** Drops the wrapped data key: whatever is left of the account can no longer be read. */
  deleteKey(userId: string): Promise<void>;
  /** One page of the user's photo files ("<user id>/<attachment id>.bin"). */
  listPhotos(userId: string, offset: number, limit: number): Promise<string[]>;
  removePhotos(paths: string[]): Promise<void>;
  /** Removes the user; their rows, key and dossier links go with it (on delete cascade). */
  deleteUser(userId: string): Promise<void>;
}

export const PHOTO_PAGE = 1000;

// POST /delete-account -> 200 once nothing of the account is left. Every step is safe to repeat,
// so a run cut short is finished by the app trying again.
export async function handleDeleteAccount(
  req: Request,
  userId: string,
  store: AccountStore,
): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });

  // The key first: if a later step fails, the data left behind is already unreadable.
  await store.deleteKey(userId);

  // Deleting the user leaves the files behind, so they go first.
  await removeAllPhotos(userId, store);
  await store.deleteUser(userId);
  // Once more: another phone still signed in could have fetched a new key and uploaded in
  // between. With the user gone, neither works any more, so this sweep is the last.
  await removeAllPhotos(userId, store);
  return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
}

async function removeAllPhotos(userId: string, store: AccountStore): Promise<void> {
  // All names are read before any removal: paging while removing would skip files.
  const photos: string[] = [];
  for (let offset = 0; ; offset += PHOTO_PAGE) {
    const page = await store.listPhotos(userId, offset, PHOTO_PAGE);
    photos.push(...page);
    if (page.length < PHOTO_PAGE) break;
  }
  for (let i = 0; i < photos.length; i += PHOTO_PAGE)
    await store.removePhotos(photos.slice(i, i + PHOTO_PAGE));
}
