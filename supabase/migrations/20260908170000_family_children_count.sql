alter table public.guests
  add column if not exists children_count integer not null default 0
  check (children_count between 0 and 20);

drop function if exists public.save_rsvp(text, text, text, timestamptz);

create function public.save_rsvp(
  p_token text,
  p_status text,
  p_children_count integer,
  p_message text,
  p_deadline timestamptz
)
returns setof public.guests
language plpgsql security invoker set search_path = '' as $$
declare guest_id uuid;
begin
  if p_status is null or p_status not in ('attending', 'declined')
    or p_children_count is null or p_children_count not between 0 and 20
    or (p_status = 'declined' and p_children_count <> 0)
    or p_message is null or char_length(p_message) > 500 then
    raise exception 'INVALID_RSVP';
  end if;
  select id into guest_id from public.guests where token = p_token for update;
  if not found then return; end if;
  if p_deadline is not null and clock_timestamp() >= p_deadline then
    raise exception 'RSVP_CLOSED';
  end if;
  return query update public.guests
    set status = p_status, children_count = p_children_count, message = p_message
    where id = guest_id and token = p_token returning *;
end;
$$;

revoke all on function public.save_rsvp(text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_rsvp(text, text, integer, text, timestamptz)
  to service_role;
