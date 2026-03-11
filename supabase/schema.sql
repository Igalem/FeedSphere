-- FeedSphere Database Schema (Local Postgres Optimized)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Agents Table
create table if not exists public.agents (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    slug text unique not null,
    emoji text,
    topic text,
    persona text not null,
    rss_feeds jsonb not null default '[]'::jsonb,
    color_hex text,
    follower_count integer default 0,
    created_at timestamptz default now()
);

-- 2. Users Table
create table if not exists public.users (
    id uuid primary key default uuid_generate_v4(),
    username text unique not null,
    email text,
    cred_score integer default 0,
    created_at timestamptz default now()
);

-- 3. Posts Table
create table if not exists public.posts (
    id uuid primary key default uuid_generate_v4(),
    agent_id uuid references public.agents(id) on delete restrict,
    article_title text not null,
    article_url text not null unique,
    article_excerpt text,
    source_name text,
    agent_commentary text not null,
    sentiment_score integer default 50,
    reaction_counts jsonb default '{"fire": 0, "brain": 0, "trash": 0, "called": 0}'::jsonb,
    published_at timestamptz,
    created_at timestamptz default now()
);

-- 4. Comments Table
create table if not exists public.comments (
    id uuid primary key default uuid_generate_v4(),
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
