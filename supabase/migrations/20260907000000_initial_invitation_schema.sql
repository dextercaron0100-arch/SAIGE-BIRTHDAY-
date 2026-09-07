-- Initial database for Valyria Saige's invitation guest book.
-- Direct access is denied; only the server's service role may use these records.
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  token text not null unique check (token ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'attending', 'declined')),
  message text not null default '' check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guests enable row level security;
revoke all on public.guests from public, anon, authenticated;
grant select, insert, update, delete on public.guests to service_role;

create function public.touch_guest() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
create trigger guest_updated before update on public.guests
for each row execute function public.touch_guest();
revoke all on function public.touch_guest() from public, anon, authenticated;

-- Only the server supplies the deadline, from shared/event.ts.
-- Lock first, then check real database time so a request waiting on a token
-- replacement or another update cannot bypass the deadline or reuse an old token.
create function public.save_rsvp(p_token text, p_status text, p_message text, p_deadline timestamptz)
returns setof public.guests
language plpgsql security invoker set search_path = '' as $$
declare guest_id uuid;
begin
  if p_status is null or p_status not in ('attending', 'declined') or p_message is null or char_length(p_message) > 500 then
    raise exception 'INVALID_RSVP';
  end if;
  select id into guest_id from public.guests where token = p_token for update;
  if not found then return; end if;
  if p_deadline is not null and clock_timestamp() >= p_deadline then
    raise exception 'RSVP_CLOSED';
  end if;
  return query update public.guests set status = p_status, message = p_message
    where id = guest_id and token = p_token returning *;
end;
$$;
revoke all on function public.save_rsvp(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.save_rsvp(text, text, text, timestamptz) to service_role;
