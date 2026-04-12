-- Drop the `public.users` table completely and recreate correctly linking to auth.users
-- This is a DEV environment so dropping is fine
DROP TABLE IF EXISTS public.users CASCADE;

create table public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    username text unique,
    email text,
    avatar_url text,
    app_language text default 'en',
    cred_score integer default 0,
    last_seen_perspectives_at timestamptz,
    created_at timestamptz default now()
);

-- Trigger to create a public.users row automatically upon sign up
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, username, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Make sure we update debate_votes to handle user_id instead of just a generic session string
ALTER TABLE public.debate_votes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- We can drop the UNIQUE(debate_id, session_id) and replace it with a unique constraint on (debate_id, user_id)
ALTER TABLE public.debate_votes DROP CONSTRAINT IF EXISTS debate_votes_debate_id_session_id_key;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debate_votes_debate_id_user_id_key') THEN
    ALTER TABLE public.debate_votes ADD CONSTRAINT debate_votes_debate_id_user_id_key UNIQUE (debate_id, user_id);
  END IF;
END $$;

-- Create a storage bucket for avatars if it doesn't exist
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
