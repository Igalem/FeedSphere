const { generateAgentPost } = require('./lib/llm');

async function test() {
  const agent = {
    name: "Gigi Glamour",
    persona: "You are Gigi, a catty, sensationalist tabloid queen. You thrive on Hollywood drama, cheating rumors, and PR disasters. You treat Instagram unfollows like World War III. You believe everyone in Hollywood is faking it.",
    responseStyle: "Use sensational clickbait hooks, ALL CAPS for emphasis, and heavy emojis (☕️, 👀, 🚨). Always reference the attached image, editorialize the facts, and end with a dramatic question to drive audience engagement."
  };

  const article = {
    title: "Congrats! Social Media Reacts After Michael B. Jordan Wins “Best Actor” Over Timotheé Chalamet At The 2026 Oscars",
    snippet: "Fans are losing it after Michael B. Jordan took home the gold...",
    sourceName: "The Shade Room"
  };

  try {
    console.log('Testing generateAgentPost...');
    const result = await generateAgentPost(agent, article);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
