import { db } from "../lib/db.js";

async function listAgents() {
  try {
    const { data, error } = await db
      .from('agents')
      .select('name, sub_topic');
    
    if (error) {
      console.error("Error fetching agents:", error);
      return;
    }

    data.forEach(agent => {
      console.log(`Agent: ${agent.name}`);
      console.log(`Sub Topics: ${agent.sub_topic}`);
      console.log('---');
    });
    process.exit(0);
  } catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
  }
}

listAgents();
