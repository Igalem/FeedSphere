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

export async function generateAgentPerspective(agent, articles) {
  // Use the first article as the primary news item to transform
  const primaryArticle = articles[0];
  
  const systemPrompt = `You are an AI agent acting as a specific persona on a social network. 
Your task is to transform a dry news item (from an RSS feed) into an engaging, highly opinionated, and independent social media post. 

Do NOT act like a news reporter or an aggregator. Do NOT summarize the article. You are a creator sharing your subjective, emotional take on the news. The users cannot see the original article, so you must organically weave the essential facts into your rant/praise.

Here is your Persona Profile:
Name: ${agent.name}
Traits: ${agent.persona}

INPUT DATA:
News Title: ${primaryArticle.title}
News Summary/Content: ${primaryArticle.snippet || ''}

POST STRUCTURE REQUIREMENTS:
1. The Hook (1 sentence): Start with a strong, emotional, or provocative opening that immediately establishes your persona's point of view.
2. The Core (2-3 short paragraphs): Blend the facts from the news with your heavy bias. Use formatting like line breaks, a couple of relevant emojis, and bullet points if appropriate to make it highly scannable.
3. The Call to Action (CTA - Optional): If you feel the need to engage the users directly, end the post by asking for their opinion. If you include a CTA, it MUST be on a new line with an EMPTY LINE ABOVE IT. Tell them to use the platform's specific reaction buttons. 
Available buttons: 🔥 (Fire/Strongly Agree), 🧠 (Brain/Deep thought/Need more info), 🧊 (Cold/Disagree/Pessimistic), 🎯 (Accurate/Spot on).

RULES:
- Language: Write the post in English.
- Never mention "According to this article" or "The RSS feed says". Act as if you heard the news, saw the game, or read the data yourself.
- DO NOT add hashtags or tags in the post text. Use plain text for the commentary.
- Keep it under 150 words.
- Be authentic to the persona.
- YOUR FINAL OUTPUT MUST BE A VALID JSON OBJECT.
- IMPORTANT: Any line breaks in your text must be escaped as \n inside the JSON string.

JSON Structure:
{
  "commentary": "The full text of your post using the structure and rules above.",
  "sentiment_score": 0-100 (Be extreme and biased based on your persona),
  "tags": ["Perspective", "tag1", "tag2"]
}`;

  const userMessages = [
    {
      role: 'user',
      content: `Transform this news into your highly opinionated perspective post: ${primaryArticle.title}`
    }
  ];

  const response = await generateLLMResponse(systemPrompt, userMessages, { maxTokens: 1200, temperature: 0.85 });
  
  try {
    // 1. Extract potential JSON block
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { commentary: response, sentiment_score: 50, tags: ['Perspective'] };
    }

    let jsonStr = jsonMatch[0];

    // 2. Pre-clean: Remove common LLM-isms that break JSON.parse
    // Remove line comments like // some comment
    jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
    // Remove trailing commas before closing braces/brackets
    jsonStr = jsonStr.replace(/,\s*([\}\]])/g, '$1');

    try {
      // Attempt 1: Regular parse
      let parsed = JSON.parse(jsonStr);
      
      // Post-process commentary to ensure empty line before CTA
      if (parsed.commentary) {
        // Look for sentences that look like CTAs (closing questions or reaction mentions)
        const ctaRegex = /(\n|^)([^.!?\n]*(\?|🔥|🧠|🧊|🎯)[^.!?\n]*)$|(\n|^)(So, what's your take.*)$|(\n|^)(What do you think.*)$|(\n|^)(Let me know.*)$/i;
        const parts = parsed.commentary.split('\n').filter(p => p.trim() !== '');
        
        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1];
          if (ctaRegex.test(lastPart)) {
            // Re-assemble with an extra empty line before the last part
            const mainContent = parts.slice(0, -1).join('\n\n');
            parsed.commentary = mainContent + '\n\n' + lastPart;
          } else {
             // Just join with double newlines anyway for better readability if not already
             parsed.commentary = parts.join('\n\n');
          }
        }
      }
      return parsed;

    } catch (e) {
      try {
        // Attempt 2: Handle literal newlines and cleaning
        const cleaned = jsonStr
          .split('\n')
          .map((line, i, arr) => {
            const trimmed = line.trim();
            if (i < arr.length - 1 && 
                !trimmed.endsWith(',') && 
                !trimmed.endsWith('{') && 
                !trimmed.endsWith('[') && 
                !trimmed.startsWith('"') &&
                trimmed !== '') {
               return line + '\\n';
            }
            return line;
          })
          .join(' ');
        let parsed = JSON.parse(cleaned);

        // Post-process commentary same as above
        if (parsed.commentary) {
           const parts = parsed.commentary.split(/\n|\\n/).filter(p => p.trim() !== '');
           if (parts.length > 1) {
              const lastPart = parts[parts.length - 1];
              const mainContent = parts.slice(0, -1).join('\n\n');
              parsed.commentary = mainContent + '\n\n' + lastPart;
           }
        }
        return parsed;
      } catch (e2) {
        // Attempt 3: Regex extraction as a last resort
        const commentaryMatch = jsonStr.match(/"commentary"\s*:\s*"([\s\S]*?)"\s*(?:,|$)/);
        const sentimentMatch = jsonStr.match(/"sentiment_score"\s*:\s*(-?\d+)/);
        
        if (commentaryMatch) {
          return {
            commentary: commentaryMatch[1].replace(/\\n/g, '\n'),
            sentiment_score: sentimentMatch ? parseInt(sentimentMatch[1], 10) : 50,
            tags: ['Perspective']
          };
        }
        
        throw new Error('All parsing attempts failed');
      }
    }
  } catch (e) {
    console.error('Failed to parse Perspective LLM JSON:', e.message);
    // If it STILL fails, don't return the raw JSON if it exists
    const cleanResponse = response.replace(/\{[\s\S]*\}/, '').trim();
    return {
      commentary: cleanResponse || "I have some thoughts on this, but I'm struggling to put them into words right now.",
      sentiment_score: 50,
      tags: ['Perspective']
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
