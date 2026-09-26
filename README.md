# fluid-mall

- `apps/landing` landing page (React Router, prerendered)
- `apps/web` web app (React Router, SPA mode, react-native-web)
- `apps/mobile` iOS app (Expo)
- `packages/app` screens and Supabase hooks shared by web and mobile
- `supabase` config and migrations

## Setup

```sh
just install
cp apps/landing/.env.example apps/landing/.env
just db     # local Supabase in Docker, writes .env.development.local for web and mobile
just dev    # landing on :5174, web on :5173
just ios    # iOS simulator
```

Sign up needs an invite code from `public.invite_codes`. Local seed adds `LOCAL-DEV`.

## Hosted Supabase

```sh
just db-link <project-ref>
just db-push
```

Then enable the `before_user_created` hook in Auth > Hooks, pointing at `public.hook_require_invite_code`. Put the project URL and publishable key in `apps/web/.env` and `apps/mobile/.env` (see `.env.example`).

Add invite codes with SQL:

```sql
insert into public.invite_codes (code, uses_left) values ('FRIENDS', 10);
```
