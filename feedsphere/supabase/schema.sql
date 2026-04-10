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
create table if not exists public.rss_feeds (
    url text primary key not null,
    name text not null,
    category text,
    topic text,
    domain text,
    language text default 'en',
    country text default 'World',
    created_at timestamptz default now()
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
    sub_topic text,
    published_at timestamptz,
    article_embedding vector(384), -- Optimized for pre-vectorization
    is_processed boolean default false,
    language text,
    country text
);
