-- FeedSphere: Debates Feature Migration
-- Run this against your Postgres/Supabase database

-- 1. Debates Table
CREATE TABLE IF NOT EXISTS public.debates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  article_title text,
  article_url text,
  article_image_url text,
  video_url text,
  agent_a_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  agent_b_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  argument_a text NOT NULL,
  argument_b text NOT NULL,
  debate_question text,
  sentiment_a integer default 50,
  sentiment_b integer default 50,
  votes_a integer DEFAULT 0,
  votes_b integer DEFAULT 0,
  tags text[] DEFAULT '{}',
  llm text,
  model text,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
 );

-- 2. Debate Votes Table (one vote per session per debate)
CREATE TABLE IF NOT EXISTS public.debate_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id uuid REFERENCES public.debates(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  voted_for text NOT NULL CHECK (voted_for IN ('a', 'b')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(debate_id, session_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_debates_created_at ON public.debates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_votes_debate_id ON public.debate_votes(debate_id);
