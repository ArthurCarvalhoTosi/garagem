-- Like uploads (20261103210000), replacing or moving a photo needs the data key. A move is an
-- update, and one made while delete-account runs could slip past its sweep and stay behind.
drop policy "Owners replace their photos" on storage.objects;
create policy "Owners replace their photos" on storage.objects
for update to authenticated
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.bin$'
  and (select public.has_data_key())
);
