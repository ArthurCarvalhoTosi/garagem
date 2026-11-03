-- Access records (Marco Civil da Internet, art. 15): the IP, date and time an account used the
-- app, kept for 6 months as the privacy policy promises. Supabase's own logs on the free plan
-- last a day. See "Registros de acesso" in section 12 of
-- decisoes_projeto_manutencao_veicular.md.
--
-- One row per stretch of use from the same address: a call within 10 minutes of the last one
-- stretches the row instead of adding another, so a sync every few seconds stays one row.
-- No foreign key to auth.users: the records outlive a deleted account by design.
create table public.access_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  -- The x-forwarded-for chain as the API gateway passed it on. Kept whole: a client may prepend
  -- made-up entries, and the gateways append the address they saw.
  forwarded_for text not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);

create index access_log_user_idx on public.access_log (user_id, last_at desc);
create index access_log_last_at_idx on public.access_log (last_at);

-- Only log_access writes here; reading is for legal requests, by the project owner.
alter table public.access_log enable row level security;
revoke all on public.access_log from anon, authenticated, service_role;

-- Called by the app at the start of every sync (a POST, so PostgREST runs it read-write).
create function public.log_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_forwarded text := left(coalesce(
    current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), 512);
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.access_log set last_at = now()
  where id = (
    select id from public.access_log
    where user_id = v_user and forwarded_for = v_forwarded
      and last_at > now() - interval '10 minutes'
    order by last_at desc
    limit 1
  );
  if not found then
    insert into public.access_log (user_id, forwarded_for) values (v_user, v_forwarded);
  end if;
end;
$$;

revoke execute on function public.log_access() from public, anon;
grant execute on function public.log_access() to authenticated;

select cron.schedule(
  'access-log-cleanup',
  '17 3 * * *',
  $$ delete from public.access_log where last_at < now() - interval '6 months' $$
);
