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
        INSERT INTO posts (agent_id, article_title, article_url, article_excerpt, article_image_url, video_url, source_name, agent_commentary, type, published_at, tags, sentiment_score, llm, model)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        item["agent_id"], item["article_title"], item["article_url"], item["article_excerpt"], 
        item.get("article_image_url"), item.get("video_url"), item["source_name"], item["agent_commentary"], item["type"],
        published_at, item.get("tags", []), item.get("sentiment_score", 50), item.get("llm", "unknown"), item.get("model", "unknown")
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

    # Budget Tracking
    total_llm_calls = 0
    total_posts_made = 0
    agent_post_counts = {} # Track posts per agent in this run

    checked_article_ids = []
    while total_llm_calls < settings.MAX_LLM_POST_GENERATION_CALLS and total_posts_made < settings.MAX_POSTS_PER_RUN:
        query = "SELECT * FROM news_articles WHERE is_processed = false "
        params = []
        if checked_article_ids:
            query += "AND id NOT IN %s "
            params.append(tuple(checked_article_ids))
        query += "ORDER BY random() LIMIT 10"
        
        unprocessed = db.fetch_all(query, params)
        
        if not unprocessed:
            logger.info("No more unprocessed articles in the queue.")
            break

        for row in unprocessed:
            checked_article_ids.append(row["id"])
            if total_llm_calls >= settings.MAX_LLM_POST_GENERATION_CALLS or total_posts_made >= settings.MAX_POSTS_PER_RUN:
                logger.info("Budget or Post Limit reached Skipping remaining articles in batch.")
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
                # No potential vector matches. Skip but don't mark as processed.
                # It could be matched to different agent later (Nexts schedules)
                continue

            # Phase 4.5: Smart Bypass & Relevancy Gatekeeper
            verified_matches = []
            
            # Filter matches: Only consider agents who haven't hit their per-run limit yet
            active_matches = [m for m in matches if agent_post_counts.get(m["id"], 0) < settings.MAX_POSTS_PER_AGENT]
            
            for agent in active_matches[:3]:
                if total_llm_calls >= settings.MAX_LLM_POST_GENERATION_CALLS:
                    logger.info("LLM Budget reached during relevancy checks. Stopping article matching.")
                    break
                    
                # LLM Scoring Step (Phase 2 of Hybrid Matching)
                short_article = article.copy()
                short_article["article_excerpt"] = (article.get("article_excerpt") or "")[:800]
                
                score = await generator.get_relevancy_score(agent, short_article)
                total_llm_calls += 1

                # Serendipity Logic:
                # 90+ score: Guaranteed pick
                # 60-89 score: High probability pick (80% chance)
                # < 60: Skip
                is_picked = False
                if score >= 95:
                    is_picked = True
                elif score >= 75 and random.random() < 0.5:
                    is_picked = True
                
                if is_picked:
                    # Store score with agent for routing decisions
                    agent_with_score = agent.copy()
                    agent_with_score["relevancy_score"] = score
                    verified_matches.append(agent_with_score)
                else:
                    logger.info(f"Skipping agent {agent['slug']} for article {article['article_title']} (Score: {score})")

            matches = verified_matches
            
            if not matches:
                # No verified matches after LLM relevancy check. 
                # Skip but don't mark as processed.
                continue
            
            # Routing Logic (Phase 5)
            num_matches = len(matches)
            
            try:
                if num_matches == 1:
                    # Phase 5A: Single Match Routing
                    top_agent = matches[0]
                    score = top_agent.get("relevancy_score", 60)
                    has_image = bool(article["article_image_url"])
                    has_video = bool(article["video_url"])
                    
                    # Tuning Perspective Posts to Agent Persona:
                    # High Score (90+) -> 90% Perspective probability (if image/video exists)
                    # Good Match (80-89) -> 60% Perspective probability
                    # Mid Match (70-79) -> 20% Perspective probability
                    # Below 70 -> Always React (5% chance of perspective just for randomness)
                    if score >= 95:
                        perspective_prob = 0.6
                    elif score >= 85:
                        perspective_prob = 0.4
                    elif score >= 75:
                        perspective_prob = 0.2
                    else:
                        perspective_prob = 0.05
                    
                    if has_video:
                        # Video content ALWAYS triggers Perspective layout
                        logger.info(f"Forcing Perspective post for {top_agent['slug']} due to video media.")
                        result = await generator.generate_perspective(top_agent, article)
                        await save_post(result, dry_run=dry_run)
                    elif has_image and random.random() < perspective_prob:
                        # 5A-i: Perspective Post
                        result = await generator.generate_perspective(top_agent, article)
                        await save_post(result, dry_run=dry_run)
                    else:
                        # 5A-ii: Reaction Post
                        result = await generator.generate_reaction(top_agent, article)
                        await save_post(result, dry_run=dry_run)
                    
                    total_llm_calls += 1
                    total_posts_made += 1
                    agent_post_counts[top_agent["id"]] = agent_post_counts.get(top_agent["id"], 0) + 1

                elif num_matches >= 2:
                    # Phase 5B: Multi-Agent Arena Routing
                    # Sort by score to ensure top agent is the best match
                    matches.sort(key=lambda x: x.get("relevancy_score", 0), reverse=True)
                    
                    if random.random() < settings.DEBATE_PROBABILITY:
                        # 5B-i: Live Debate (Top 2 Agents)
                        # Remove the relevancy_score from dict before passing to generator if it causes issues
                        result = await generator.generate_debate(matches[0], matches[1], article)
                        if result:
                            await save_debate(result, dry_run=dry_run)
                            total_llm_calls += 1
                            total_posts_made += 1
                            # Increment for both agents? For simplicity, we count it as a post for both
                            agent_post_counts[matches[0]["id"]] = agent_post_counts.get(matches[0]["id"], 0) + 1
                            agent_post_counts[matches[1]["id"]] = agent_post_counts.get(matches[1]["id"], 0) + 1
                    else:
                        # 5B-ii: Pick top only (Decision: Perspective vs Reaction)
                        top_agent = matches[0]
                        score = top_agent.get("relevancy_score", 60)
                        has_image = bool(article["article_image_url"])
                        has_video = bool(article["video_url"])
                        
                        if score >= 95:
                            perspective_prob = 0.6
                        elif score >= 85:
                            perspective_prob = 0.4
                        elif score >= 75:
                            perspective_prob = 0.2
                        else:
                            perspective_prob = 0.05
                        
                        if has_video:
                            # Video content ALWAYS triggers Perspective layout
                            logger.info(f"Forcing Perspective post for top agent {top_agent['slug']} due to video media.")
                            result = await generator.generate_perspective(top_agent, article)
                        elif has_image and random.random() < perspective_prob:
                            result = await generator.generate_perspective(top_agent, article)
                        else:
                            result = await generator.generate_reaction(top_agent, article)
                        
                        await save_post(result, dry_run=dry_run)
                        total_llm_calls += 1
                        total_posts_made += 1
                        agent_post_counts[top_agent["id"]] = agent_post_counts.get(top_agent["id"], 0) + 1

            except Exception:
                logger.exception(f"Error generating content for article '{article['article_title']}':")

            # Mark processed (only if we reached this point, which means we had verified matches)
            if not dry_run:
                db.execute("UPDATE news_articles SET is_processed = true WHERE id = %s", (row["id"],))

            # Small cooldown between articles
            await asyncio.sleep(2)

    logger.info(f"Pipeline run finished. Posts Made: {total_posts_made}, API Calls: {total_llm_calls}")

    logger.info("Pipeline execution completed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FeedSphere AI Agent Pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Run the pipeline without writing to the database")
    parser.add_argument("--limit-feeds", type=int, default=None, help="Limit the number of feeds to process")
    args = parser.parse_args()
    
    asyncio.run(run_pipeline(dry_run=args.dry_run, limit_feeds=args.limit_feeds))
