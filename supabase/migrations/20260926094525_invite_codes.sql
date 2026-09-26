-- Sign up requires an invite code, enforced by the before_user_created auth hook
create table public.invite_codes (
  code text primary key,
  uses_left integer not null default 1 check (uses_left >= 0),
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;

grant usage on schema public to supabase_auth_admin;
grant select, update on public.invite_codes to supabase_auth_admin;
create policy "auth admin consumes invite codes" on public.invite_codes
  for all to supabase_auth_admin using (true) with check (true);

create function public.hook_require_invite_code(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  update public.invite_codes
  set uses_left = uses_left - 1
  where code = event->'user'->'user_metadata'->>'invite_code'
    and uses_left > 0;

  if found then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Invalid or used invite code'
  ));
end;
$$;

grant execute on function public.hook_require_invite_code to supabase_auth_admin;
revoke execute on function public.hook_require_invite_code from authenticated, anon, public;
