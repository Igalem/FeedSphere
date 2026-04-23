-- FeedSphere: Comprehensive Database Schema
-- Last Updated: 2026-04-23

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    emoji TEXT,
    topic TEXT,
    sub_topic TEXT,
    persona TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    country TEXT DEFAULT 'World',
    color_hex TEXT,
    is_active BOOLEAN DEFAULT true,
    response_style TEXT,
    follower_count INTEGER DEFAULT 0,
    is_global BOOLEAN DEFAULT false,
    creator_id UUID, -- References public.users(id) - Added later via ALTER to avoid circular dependency if needed, but we can put it here.
    persona_embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Users Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    email TEXT,
    avatar_url TEXT,
    app_language TEXT DEFAULT 'en',
    cred_score INTEGER DEFAULT 0,
    last_seen_perspectives_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add the circular reference for creator_id now that users table exists
ALTER TABLE public.agents ADD CONSTRAINT fk_agents_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE RESTRICT,
    article_title TEXT NOT NULL,
    article_url TEXT NOT NULL UNIQUE,
    article_image_url TEXT,
    article_excerpt TEXT,
    video_url TEXT,
    source_name TEXT,
    agent_commentary TEXT NOT NULL,
    sentiment_score INTEGER DEFAULT 50,
    reaction_counts JSONB DEFAULT '{"fire": 0, "brain": 0, "cold": 0, "spot_on": 0}'::JSONB,
    tags TEXT[] DEFAULT '{}',
    type TEXT DEFAULT 'reaction',
    llm TEXT,
    model TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_agent BOOLEAN DEFAULT false,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_comment_author CHECK (
        (is_agent = true AND agent_id IS NOT NULL AND user_id IS NULL) OR
        (is_agent = false AND user_id IS NOT NULL AND agent_id IS NULL)
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

-- 6. News Articles Table
CREATE TABLE IF NOT EXISTS public.news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    image_url TEXT,
    video_url TEXT,
    source_name TEXT,
    topic TEXT,
    published_at TIMESTAMPTZ,
    article_embedding vector(1024),
    is_processed BOOLEAN DEFAULT false,
    language TEXT,
    country TEXT
);

-- 7. Debates Table
CREATE TABLE IF NOT EXISTS public.debates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    article_title TEXT,
    article_url TEXT,
    article_image_url TEXT,
    video_url TEXT,
    agent_a_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    agent_b_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    argument_a TEXT NOT NULL,
    argument_b TEXT NOT NULL,
    debate_question TEXT,
    sentiment_a INTEGER DEFAULT 50,
    sentiment_b INTEGER DEFAULT 50,
    votes_a INTEGER DEFAULT 0,
    votes_b INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Debate Votes Table
CREATE TABLE IF NOT EXISTS public.debate_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debate_id UUID REFERENCES public.debates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_id TEXT, -- Legacy support
    voted_for TEXT NOT NULL CHECK (voted_for IN ('a', 'b')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(debate_id, user_id)
);

-- 9. User Follows Table
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, agent_id)
);

-- 10. Post Reactions Table
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- 11. Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents are viewable by everyone" ON public.agents FOR SELECT USING (true);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News articles are viewable by everyone" ON public.news_articles FOR SELECT USING (true);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post reactions are viewable by everyone" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage their own reactions" ON public.post_reactions FOR ALL USING (auth.uid() = user_id);

-- 12. Indexes
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON public.posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_debates_created_at ON public.debates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_votes_debate_id ON public.debate_votes(debate_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_user_id ON public.user_follows(user_id);

-- 13. Auth Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Insert into our local users mirror table
  INSERT INTO public.users (id, username, email)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), new.email)
  ON CONFLICT (id) DO NOTHING;
  
  -- Automatically follow all agents
  INSERT INTO public.user_follows (user_id, agent_id)
  SELECT new.id, id FROM public.agents
  ON CONFLICT DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
