
import os
import json
from pipeline.db import db
from pipeline.generator import Generator
import asyncio

async def fix_subtopics():
    generator = Generator()
    
    # Fetch all agents
    agents = db.fetch_all("SELECT id, name, topic, sub_topic, persona FROM agents WHERE is_active = true")
    
    updates = []
    
    for agent in agents:
        print(f"Processing agent: {agent['name']}...")
        
        # Ask LLM to generate exactly 10 sub-topics following the rules:
        # 1. First term is the specific branch/type (e.g. Football for Sports)
        # 2. Remaining 9 terms are related concepts/places/actions.
        # 3. NO individual names of people.
        # 4. Total exactly 10 terms.
        
        prompt = f"""
        You are an AI Agent Architect. Update the sub-topics for this agent to be exactly 10 comma-separated terms.
        
        Agent Name: {agent['name']}
        Agent Topic: {agent['topic']}
        Current Sub-Topic: {agent['sub_topic']}
        Agent Persona: {agent['persona'][:500]}...
        
        RULES:
        1. Return exactly 10 terms, comma-separated.
        2. The FIRST term MUST be the specific branch/type of the main topic (e.g., if Topic is 'Sports', the first term should be something like 'Football', 'Basketball', 'F1', etc., depending on the agent's focus).
        3. The remaining 9 terms must be common terms, places, or actions directly associated with the niche.
        4. CRITICAL: DO NOT mention any individual names of people (players, CEOs, politicians, etc.).
        5. Return ONLY the 10 terms, nothing else.
        """
        
        # Use simple completion
        try:
            from langchain_core.prompts import ChatPromptTemplate
            temp_prompt = ChatPromptTemplate.from_messages([("user", "{text}")])
            response, _, _ = await generator._generate_llm_response(temp_prompt, {"text": prompt}, is_json=False)
            
            new_sub_topic = response.strip().replace('\n', '').replace('"', '').replace('.', '')
            # Clean up potential extra spaces or trailing commas
            terms = [t.strip() for t in new_sub_topic.split(',') if t.strip()]
            if len(terms) > 10:
                terms = terms[:10]
            elif len(terms) < 10:
                # Fallback: add more terms if needed
                while len(terms) < 10:
                    terms.append("General") # Should not happen with a good LLM
            
            final_sub_topic = ", ".join(terms)
            print(f"  New sub-topics: {final_sub_topic}")
            
            updates.append({
                "id": agent['id'],
                "name": agent['name'],
                "sub_topic": final_sub_topic
            })
        except Exception as e:
            print(f"  Error processing {agent['name']}: {e}")

    # Generate SQL
    print("\n--- SQL MIGRATION SCRIPT ---")
    sql_script = "-- Migration to align agent sub-topics (10 strings rule)\n"
    for up in updates:
        # Use ON CONFLICT or just UPDATE if ID is known
        # But for production deployment, it's safer to match by name or slug if IDs differ
        # However, the user usually syncs by name.
        sql_script += f"UPDATE agents SET sub_topic = '{up['sub_topic']}' WHERE name = '{up['name']}';\n"
    
    output_path = "/Users/igalemona/repos/FeedSphere/scratch/agent_subtopic_migration.sql"
    with open(output_path, "w") as f:
        f.write(sql_script)
    
    print(f"\nMigration script saved to {output_path}")

if __name__ == "__main__":
    asyncio.run(fix_subtopics())
