/**
 * Invokes Groq's qwen-qwq-32b or similar reasoning model
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function generateLLMResponse(systemPrompt, userMessages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const { maxTokens = 200, temperature = 0.8, retries = 3, initialDelay = 2000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`Rate limited. Retail attempt ${attempt} in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Highly efficient and much higher rate limits than 70b
          messages: [
            { role: 'system', content: systemPrompt },
            ...userMessages
          ],
          max_tokens: maxTokens,
          temperature: temperature,
        })
      });

      if (response.status === 429) {
        lastError = new Error('Groq API Error: Too Many Requests');
        continue; // Retry
      }

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
    } catch (error) {
      lastError = error;
      if (error.message.includes('Too Many Requests')) {
        continue; // Retry
      }
      throw error; // Other errors shouldn't be retried
    }
  }

  throw lastError;
}

export async function generateAgentPost(agent, article) {
  const systemPrompt = `You are ${agent.name}.
${agent.persona}

Rules:
- Write like a real, authentic human expressing genuine feelings, emotions, and imperfections. Don't be too robotic.
- Stay completely in character at all times.
- Max 3 sentences for post takes.
- Never start with "I think" or "In my opinion".
- Never repeat what the article says, simply add your raw angle.
- Never use the string '—', '--', or '-' in your output! Use commas, colons, or periods instead.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.

JSON Structure:
{
  "commentary": "Your written take as the character (max 3 sentences)",
  "sentiment_score": 0-100 (where 0 is very negative and 100 is very positive),
  "tags": ["tag1", "tag2"] (2-3 relevant hashtags without the # sign, e.g. "Sports", "Victory")
}

- If you use <think> tags, be brief so the actual response isn't cut off.`;

  const userMessages = [
    {
      role: 'user',
      content: `Article title: ${article.title}\nArticle summary: ${article.snippet}\nSource: ${article.sourceName}\n\nWrite your take on this article and provide the JSON.`
    }
  ];

  const response = await generateLLMResponse(systemPrompt, userMessages, { maxTokens: 1200, temperature: 0.8 });
  
  try {
    // Attempt to parse JSON from the response
    // Sometimes LLM might wrap it in markdown code blocks
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      commentary: response,
      sentiment_score: 50,
      tags: []
    };
  } catch (e) {
    console.error('Failed to parse LLM JSON:', e);
    return {
      commentary: response,
      sentiment_score: 50,
      tags: []
    };
  }
}

export async function generateAgentReply(agent, postContext, recentComments, userComment) {
  const systemPrompt = `You are ${agent.name}. ${agent.persona}

Rules:
- Write exactly like a real, authentic human expressing genuine feelings, emotions, and imperfections. Don't be too robotic.
- Stay completely in character at all times.
- Max 2 sentences for comment replies.
- Never start with "I think" or "In my opinion".
- Never use the string '—', '--', or '-' in your output! Use commas, colons, or periods instead.`;

  const userMessages = [
    {
      role: 'user',
      content: `You posted about: "${postContext.article_title}"\nYour original take: "${postContext.agent_commentary}"\n\nRecent thread:\n${recentComments}\n\nA user just commented: "${userComment}"\n\nReply directly. Stay in character. 1-2 sentences max.`
    }
  ];

  return generateLLMResponse(systemPrompt, userMessages, { maxTokens: 800, temperature: 0.6 });
}
