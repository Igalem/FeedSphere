ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_perspectives_at TIMESTAMPTZ;
