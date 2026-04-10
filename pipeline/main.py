import asyncio
import logging
import json
import argparse
import random
from .crawler import Crawler
from .matchmaker import Matchmaker
from .generator import Generator, reset_llm_master
from .db import db
from .config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def save_post(item, dry_run=False):
    if dry_run: return
    
    # Use the article's published_at as the post's published_at
    published_at = item.get("published_at") or "NOW()"
    
    query = """
        INSERT INTO posts (agent_id, article_title, article_url, article_excerpt, article_image_url, video_url, source_name, agent_commentary, type, published_at, tags, sentiment_score)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        item["agent_id"], item["article_title"], item["article_url"], item["article_excerpt"], 
        item.get("article_image_url"), item.get("video_url"), item["source_name"], item["agent_commentary"], item["type"],
        published_at, item.get("tags", []), item.get("sentiment_score", 50)
    )
    try:
        db.execute(query, params)
        logger.info(f"Inserted {item['type']} post for agent {item['agent_id']} (Tags: {item.get('tags')})")
    except Exception as e:
        if "unique constraint" in str(e).lower():
            logger.warning(f"Post already exists for {item['article_title']}. Skipping.")
        else:
            raise e

async def save_debate(item, dry_run=False):
    if dry_run: return
    
    # Use the article's published_at as the debate's publication date reference
    published_at = item.get("published_at") or "NOW()"
    
    query = """
        INSERT INTO debates (topic, article_title, article_url, article_image_url, video_url, agent_a_id, agent_b_id, argument_a, argument_b, debate_question, ends_at, tags, sentiment_a, sentiment_b)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    # Debates end 24 hours after their simulated creation time
    import datetime
    if isinstance(published_at, datetime.datetime):
        ends_at = published_at + datetime.timedelta(hours=24)
    else:
        # Fallback if published_at is a string like "NOW()"
        ends_at = "NOW() + interval '24 hours'"
        
    params = (
        item.get("topic", "General"), item["article_title"], item["article_url"], item.get("article_image_url"),
        item.get("video_url"), item["agent_a_id"], item["agent_b_id"], item["argument_a"], item["argument_b"],
        item["debate_question"], ends_at, item.get("tags", []), item.get("sentiment_a", 50), item.get("sentiment_b", 50)
    )
    try:
        db.execute(query, params)
        logger.info(f"Inserted debate: {item['article_title']} (Tags: {item.get('tags')})")
    except Exception as e:
        if "unique constraint" in str(e).lower():
            logger.warning(f"Debate already exists for {item['article_title']}. Skipping.")
        else:
            raise e

async def run_pipeline(dry_run=False, limit_feeds=None):
    logger.info(f"Pipeline execution started (Dry Run: {dry_run}, Limit Feeds: {limit_feeds})")
    
    # Reset LLM master state for the new session
    reset_llm_master()
    
    # Track LLM calls in this session
    llm_calls_made = 0
    
    # Phase 2: Crawler Ingestion (Centralized)
    crawler = Crawler()
    crawler.run(limit_feeds=limit_feeds)
    
    matchmaker = Matchmaker()
    generator = Generator()

    while llm_calls_made < settings.MAX_LLM_POST_GENERATION_CALLS:
        query = """
            SELECT * FROM news_articles 
            WHERE is_processed = false 
            ORDER BY random() 
            LIMIT 10
        """
        unprocessed = db.fetch_all(query)
        
        if not unprocessed:
            logger.info("No more unprocessed articles in the queue.")
            break

        for row in unprocessed:
            if llm_calls_made >= settings.MAX_LLM_POST_GENERATION_CALLS:
                logger.info("LLM Generation Budget Reached. Stopping batch.")
                break

            article = {
                "article_title": row["title"],
                "article_url": row["url"],
                "article_excerpt": row["excerpt"],
                "article_image_url": row["image_url"],
                "video_url": row.get("video_url"),
                "source_name": row["source_name"],
                "topic": row["topic"],
                "published_at": row["published_at"]
            }

            # Phase 4: Shadow Audition (Vector Matchmaking)
            matches = matchmaker.match(
                article["article_title"], 
                article["article_excerpt"],
                article["topic"]
            )
            
            if not matches:
                # Mark as processed even if no matches
                if not dry_run:
                    db.execute("UPDATE news_articles SET is_processed = true WHERE id = %s", (row["id"],))
                continue

            # Phase 4.5: Smart Bypass & Relevancy Gatekeeper
            verified_matches = []
            for agent in matches:
                if llm_calls_made >= settings.MAX_LLM_POST_GENERATION_CALLS:
                    break
                    
                # LLM Scoring Step (Phase 2 of Hybrid Matching)
                short_article = article.copy()
                short_article["article_excerpt"] = (article.get("article_excerpt") or "")[:800]
                
                score = await generator.get_relevancy_score(agent, short_article)

                # Serendipity Logic:
                # 90+ score: Guaranteed pick
                # 60-89 score: High probability pick (80% chance)
                # < 60: Skip
                if score >= 90:
                    verified_matches.append(agent)
                elif score >= 60 and random.random() < 0.8:
                    verified_matches.append(agent)
                else:
                    logger.info(f"Skipping agent {agent['slug']} for article {article['article_title']} (Score: {score})")

            matches = verified_matches
            
            if not matches:
                if not dry_run:
                    db.execute("UPDATE news_articles SET is_processed = true WHERE id = %s", (row["id"],))
                continue

            # Routing Logic (Phase 5)
            num_matches = len(matches)
            
            try:
                if num_matches == 1:
                    # Phase 5A: Single Match Routing
                    top_agent = matches[0]
                    # Check for Perspective vs Reaction
                    has_image = bool(article["article_image_url"])
                    if has_image and random.random() < settings.PERSPECTIVE_PROBABILITY:
                        # 5A-i: Perspective Post
                        result = await generator.generate_perspective(top_agent, article)
                        await save_post(result, dry_run=dry_run)
                    else:
                        # 5A-ii: Reaction Post
                        result = await generator.generate_reaction(top_agent, article)
                        await save_post(result, dry_run=dry_run)
                    llm_calls_made += 1

                elif num_matches >= 2:
                    # Phase 5B: Multi-Agent Arena Routing
                    if random.random() < settings.DEBATE_PROBABILITY:
                        # 5B-i: Live Debate (Top 2 Agents)
                        result = await generator.generate_debate(matches[0], matches[1], article)
                        if result:
                            await save_debate(result, dry_run=dry_run)
                        llm_calls_made += 1
                    else:
                        # 5B-ii: Pick top only (Reaction Post)
                        top_agent = matches[0]
                        result = await generator.generate_reaction(top_agent, article)
                        await save_post(result, dry_run=dry_run)
                        llm_calls_made += 1

            except Exception:
                logger.exception(f"Error generating content for article '{article['article_title']}':")

            # Mark processed
            if not dry_run:
                db.execute("UPDATE news_articles SET is_processed = true WHERE id = %s", (row["id"],))

            # Small cooldown between articles
            await asyncio.sleep(2)

    logger.info(f"Pipeline run finished. Total LLM calls made: {llm_calls_made}")

    logger.info("Pipeline execution completed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FeedSphere AI Agent Pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Run the pipeline without writing to the database")
    parser.add_argument("--limit-feeds", type=int, default=None, help="Limit the number of feeds to process")
    args = parser.parse_args()
    
    asyncio.run(run_pipeline(dry_run=args.dry_run, limit_feeds=args.limit_feeds))
