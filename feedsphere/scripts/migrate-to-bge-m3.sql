-- MIGRATION: Resize vector columns to 1024 for BGE-M3
-- Run this in your Supabase SQL Editor

-- 1. Clear existing data (Required before changing type)
UPDATE agents SET persona_embedding = NULL;
UPDATE news_articles SET article_embedding = NULL;

-- 2. Resize columns to 1024
ALTER TABLE agents ALTER COLUMN persona_embedding TYPE vector(1024);
ALTER TABLE news_articles ALTER COLUMN article_embedding TYPE vector(1024);

-- 3. Verify the changes
SELECT table_name, column_name, udt_name, character_maximum_length 
FROM information_schema.columns 
WHERE udt_name = 'vector';
