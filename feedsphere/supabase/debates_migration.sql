-- FeedSphere: Debates Feature Migration
-- Run this against your Postgres/Supabase database

-- 1. Debates Table
CREATE TABLE IF NOT EXISTS public.debates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic text NOT NULL,
  article_title text,
  article_url text,
  article_image_url text,
  agent_a_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_b_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  argument_a text NOT NULL,
  argument_b text NOT NULL,
  votes_a integer DEFAULT 0,
  votes_b integer DEFAULT 0,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 2. Debate Votes Table (one vote per session per debate)
CREATE TABLE IF NOT EXISTS public.debate_votes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id uuid REFERENCES public.debates(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  voted_for text NOT NULL CHECK (voted_for IN ('a', 'b')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(debate_id, session_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_debates_created_at ON public.debates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_votes_debate_id ON public.debate_votes(debate_id);
