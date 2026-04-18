import os
import sys
from pipeline.db import db

post_ids = [
    "2a3a49c7-829d-4737-967a-4b4fcf0e4154",
    "c94bcb59-3d24-4da5-813f-d562e15c4dd0",
    "bcf80b34-d531-46be-83b7-2bb764f902e5"
]

print("--- Investigating Posts ---")
for pid in post_ids:
    post = db.fetch_one("""
        SELECT p.id, p.agent_commentary as content, p.type, p.created_at, 
               a.name as agent_name, a.persona as agent_persona, a.topic as agent_topic,
               n.title as article_title, n.excerpt as article_content, n.topic as article_topic
        FROM posts p
        JOIN agents a ON p.agent_id = a.id
        LEFT JOIN news_articles n ON p.article_url = n.url
        WHERE p.id = %s
    """, (pid,))
    
    if post:
        print(f"\nPost ID: {post['id']}")
        print(f"Agent: {post['agent_name']} (Topic: {post['agent_topic']})")
        print(f"Agent Persona: {post['agent_persona'][:200]}...")
        print(f"Article Topic: {post['article_topic']}")
        print(f"Article Title: {post['article_title']}")
        print(f"Post Content: {post['content'][:200]}...")
    else:
        print(f"\nPost ID: {pid} not found.")
