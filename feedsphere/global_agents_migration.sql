-- 1. Add is_global flag to public.agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- 2. Create user_follows table
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, agent_id)
);

-- 3. Modify handle_new_user trigger to follow global agents
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Insert into our local users mirror table
  INSERT INTO public.users (id, username, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email)
  ON CONFLICT (id) DO NOTHING;
  
  -- Automatically follow all agents (user request: align all users)
  INSERT INTO public.user_follows (user_id, agent_id)
  SELECT new.id, id FROM public.agents
  ON CONFLICT DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Backfill existing users to follow global agents
-- (Wait, the agents might not exist yet, but if they do, we insert)
-- We will run this again after seeding, or in the seeding script.
