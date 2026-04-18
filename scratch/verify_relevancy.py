import asyncio
import os
from pipeline.generator import Generator
from pipeline.db import db
import json

async def verify():
    gen = Generator()
    
    # Get El Cule
    agent = db.fetch_one("SELECT * FROM agents WHERE name = 'El Cule'")
    if not agent:
        print("El Cule not found!")
        return

    test_articles = [
        {
            "title": "Cricbuzz Live Hindi: #GT vs #KKR, #IPL2026: Pre-match show (Hindi)",
            "excerpt": "Pre-match analysis of the IPL cricket match between Gujarat Titans and Kolkata Knight Riders.",
            "label": "Cricket (Should be REJECTED)"
        },
        {
            "title": "Cason Wallace says it was 'fun' supporting Kiki Rice at 2026 WNBA draft",
            "excerpt": "NBA player Cason Wallace talks about his experience at the WNBA draft supporting Kiki Rice.",
            "label": "Basketball (Should be REJECTED)"
        },
        {
            "title": "Scotland carry no burden in chase for World Cup spot",
            "excerpt": "The Scotland national team is confident ahead of their World Cup qualifying match.",
            "label": "General Football (Should be REJECTED or LOW SCORE)"
        },
        {
            "title": "Barcelona interested in signing Erling Haaland",
            "excerpt": "Reports suggest that FC Barcelona president Joan Laporta is preparing a massive bid for Erling Haaland.",
            "label": "Actual Barcelona News (Should be ACCEPTED)"
        }
    ]

    print(f"--- Verifying Relevancy for Agent: {agent['name']} ---")
    for art in test_articles:
        print(f"\nTesting: {art['label']}")
        print(f"Title: {art['title']}")
        
        # We need a dict with article_title and article_excerpt for get_relevancy_score
        article_dict = {
            "article_title": art['title'],
            "article_excerpt": art['excerpt']
        }
        
        score = await gen.get_relevancy_score(agent, article_dict)
        print(f"Resulting Score: {score}")
        
        if score >= 75:
             print("STATUS: ACCEPTED (Potential issue if not Barcelona news)")
        else:
             print("STATUS: REJECTED (Correct behavior for unrelated content)")

if __name__ == "__main__":
    asyncio.run(verify())
