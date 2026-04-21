import { db } from "../lib/db.js";

async function checkAgent() {
  try {
    const { data, error } = await db
      .from('agents')
      .select('*', { id: 'ea66c0ed-1511-4908-a7c7-5baabbea5fe7' });
    
    if (error || !data || data.length === 0) {
      console.error("Error fetching agent or not found:", error);
      return;
    }

    const agent = data[0];
    console.log("Agent Name:", agent.name);
    console.log("Topic:", agent.topic);
    console.log("Sub Topic:", agent.sub_topic);
    process.exit(0);
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

checkAgent();
