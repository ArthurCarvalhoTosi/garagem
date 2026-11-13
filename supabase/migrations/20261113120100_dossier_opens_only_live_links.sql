-- The opens counter is keyed on a client-supplied header, so a caller sending random hashes
-- from ever-new "clients" grew dossier_opens by a row per request until the hourly cleanup.
-- Only opens of a live link count now: guessing a link is pointless (128-bit secret), and an
-- unknown one costs a read, never a write.
create or replace function public.open_dossier(p_token_hash bytea, p_client text)
returns bytea
language plpgsql
set search_path = ''
as $$
declare
  v_hits integer;
  v_ciphertext bytea;
begin
  select s.ciphertext into v_ciphertext
  from public.dossier_shares s
  where s.token_hash = p_token_hash and (s.expires_at is null or s.expires_at > now());
  if v_ciphertext is null then
    return null;
  end if;

  insert into public.dossier_opens as o (client, window_start, hits)
  values (p_client, now(), 1)
  on conflict (client) do update set
    hits = case when o.window_start < now() - interval '10 minutes' then 1 else o.hits + 1 end,
    window_start = case
      when o.window_start < now() - interval '10 minutes' then now() else o.window_start
    end
  returning hits into v_hits;

  if v_hits > 30 then
    raise exception 'too many opens' using errcode = 'GA429';
  end if;
  return v_ciphertext;
end;
$$;

revoke execute on function public.open_dossier(bytea, text) from public, anon, authenticated;
grant execute on function public.open_dossier(bytea, text) to service_role;
