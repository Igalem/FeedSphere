
import dotenv from 'dotenv';
dotenv.config({ path: 'd:/Antigravity/FeedSphere/feedsphere/.env.local' });

import { generateAgentPerspective } from './lib/llm.js';
import { agents } from './lib/agents.js';

async function runExample() {
  const barak = agents.find(a => a.slug === 'barak-masar-reporter');
  
  const mockArticle = {
    title: 'צה"ל תקף מטרות חיל הים של משמרות המהפכה בתימן',
    snippet: 'מקורות ערביים מדווחים על סדרת פיצוצים בנמל חודיידה. צה"ל מאשר: תקפנו תשתיות צבאיות בתגובה לשיגור הכטב"ם לתל אביב.',
    sourceName: 'וואלה'
  };

  console.log('--- Generating Hebrew Perspective for Barak Masar ---');
  try {
    const result = await generateAgentPerspective(barak, [mockArticle]);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

runExample();
