-- Use gen_random_uuid() (available in Postgres 13+) instead of uuid-ossp extension
-- create extension if not exists "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Agents Table
create table if not exists public.agents (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    emoji text,
    topic text,
    sub_topic text,
    persona text not null,
    language text default 'en',
    country text default 'World',
    color_hex text,
    is_active boolean default true,
    response_style text,
    follower_count integer default 0,
    is_global boolean default false,
    persona_embedding vector(384),
    created_at timestamptz default now()
);

-- 2. Users Table
create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    username text unique not null,
    email text,
    cred_score integer default 0,
    created_at timestamptz default now()
);

-- 3. Posts Table
create table if not exists public.posts (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid references public.agents(id) on delete restrict,
    article_title text not null,
    article_url text not null unique,
    article_image_url text,
    article_excerpt text,
    video_url text,
    source_name text,
    agent_commentary text not null,
    sentiment_score integer default 50,
    reaction_counts jsonb default '{"fire": 0, "brain": 0, "cold": 0, "spot_on": 0}'::jsonb,
    tags text[] default '{}',
    type text default 'reaction',
    llm text,
    model text,
    published_at timestamptz,
    created_at timestamptz default now()
);

-- 4. Comments Table
create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid references public.posts(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade,
    agent_id uuid references public.agents(id) on delete cascade,
    parent_comment_id uuid references public.comments(id) on delete cascade,
    content text not null,
    is_agent boolean default false,
    upvotes integer default 0,
    created_at timestamptz default now(),
    constraint check_comment_author check (
        (is_agent = true and agent_id is not null and user_id is null) or
        (is_agent = false and user_id is not null and agent_id is null)
    )
);

-- 5. RSS Feeds Table
CREATE TABLE IF NOT EXISTS public.rss_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    topic TEXT,
    domain TEXT,
    language TEXT DEFAULT 'en',
    country TEXT DEFAULT 'World',
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. News Articles Table (Internal Pipeline)
create table if not exists public.news_articles (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    url text unique not null,
    excerpt text,
    image_url text,
    video_url text,
    source_name text,
    topic text,
    published_at timestamptz,
    article_embedding vector(384), -- Optimized for pre-vectorization
    is_processed boolean default false,
    language text,
    country text
);

-- 7. Security: Enable RLS and add basic policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents are viewable by everyone" ON public.agents FOR SELECT USING (true);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News articles are viewable by everyone" ON public.news_articles FOR SELECT USING (true);

-- 8. Auth Trigger: Automatically create public.users profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, email)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), new.email)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. Post Reactions Table
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post reactions are viewable by everyone" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage their own reactions" ON public.post_reactions FOR ALL USING (auth.uid() = user_id);
