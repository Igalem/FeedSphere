-- Migration to change default language to Hebrew for all users
-- This updates existing users and sets the default for future users

-- 1. Update public.users table
ALTER TABLE public.users ALTER COLUMN app_language SET DEFAULT 'he';
UPDATE public.users SET app_language = 'he' WHERE app_language IS NULL OR app_language = 'en';

-- 2. Update public.agents table (since agents serve the users)
ALTER TABLE public.agents ALTER COLUMN language SET DEFAULT 'he';
UPDATE public.agents SET language = 'he' WHERE language IS NULL OR language = 'en';

-- 3. Update public.rss_feeds table (to favor Hebrew sources if possible, though this only affects metadata)
ALTER TABLE public.rss_feeds ALTER COLUMN language SET DEFAULT 'he';
UPDATE public.rss_feeds SET language = 'he' WHERE language IS NULL OR language = 'en';
