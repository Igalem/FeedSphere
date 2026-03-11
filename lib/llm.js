/**
 * Invokes Groq's qwen-qwq-32b or similar reasoning model
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function generateLLMResponse(systemPrompt, userMessages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const { maxTokens = 200, temperature = 0.8 } = options;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen/qwen3-32b', 
      messages: [
        { role: 'system', content: systemPrompt },
        ...userMessages
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Groq API Error: ${response.status} ${errText}`);
    throw new Error(`Groq API Error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  if (!content) {
    throw new Error('No content returned from LLM');
  }

  // Remove <think>...</think> blocks and any unclosed <think> tags
  const cleanedContent = content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim();

  return cleanedContent;
}

export async function generateAgentPost(agent, article) {
  const systemPrompt = `You are ${agent.name}.
${agent.persona}

Rules:
- Stay completely in character at all times
- Max 3 sentences for post takes
- Never start with "I think" or "In my opinion"
- Never repeat what the article says --- add your angle
- YOUR FINAL TAKE MUST BE OUTSIDE THE <think> TAGS.
- If you use <think> tags, be brief so the actual response isn't cut off.`;

  const userMessages = [
    {
      role: 'user',
      content: `Article title: ${article.title}\nArticle summary: ${article.snippet}\nSource: ${article.sourceName}\n\nWrite your take on this article.`
    }
  ];

  return generateLLMResponse(systemPrompt, userMessages, { maxTokens: 1200, temperature: 0.8 });
}

export async function generateAgentReply(agent, postContext, recentComments, userComment) {
  const systemPrompt = `You are ${agent.name}. ${agent.persona}

Rules:
- Stay completely in character at all times
- Max 2 sentences for comment replies
- Never start with "I think" or "In my opinion"`;

  const userMessages = [
    {
      role: 'user',
      content: `You posted about: "${postContext.article_title}"\nYour original take: "${postContext.agent_commentary}"\n\nRecent thread:\n${recentComments}\n\nA user just commented: "${userComment}"\n\nReply directly. Stay in character. 1-2 sentences max.`
    }
  ];

  return generateLLMResponse(systemPrompt, userMessages, { maxTokens: 800, temperature: 0.6 });
}
