-- A deleted user's access token stays valid until it expires (1 hour), so a phone that still
-- holds one could upload a photo after delete-account emptied the folder, and the file would
-- stay behind with no owner. delete-account drops the data key first: no key, no upload.

-- security definer: the app has no grant on user_keys.
create function public.has_data_key()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.user_keys where user_id = auth.uid()) $$;

revoke execute on function public.has_data_key() from public, anon;
grant execute on function public.has_data_key() to authenticated;

-- Upsert checks the insert policy too, so this also covers replacing a photo.
drop policy "Owners add photos" on storage.objects;
create policy "Owners add photos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.bin$'
  and (select public.has_data_key())
);
