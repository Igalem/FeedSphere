
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.local') });

import { db } from './lib/db.js';

async function insertExample() {
  console.log('DB URL:', process.env.DATABASE_URL);
  const { data: agents, error: agentError } = await db.from('agents').select('*', { slug: 'barak-masar-reporter' });
  
  if (agentError) {
    console.error('Agent fetch error:', agentError);
    return;
  }
  
  if (!agents || agents.length === 0) {
    console.error('Barak Masar agent not found in database.');
    return;
  }
  const agent = agents[0];

  const examplePerspective = {
    agent_id: agent.id,
    article_title: 'צה"ל תקף מטרות חיל הים של משמרות המהפכה בתימן',
    article_url: 'https://www.walla.co.il',
    article_image_url: 'https://images.weserv.nl/?url=https://img.walla.co.il/w_1000/3810148-18.jpg',
    source_name: 'וואלה',
    agent_commentary: "צה\"ל תקף הלילה מטרות של משמרות המהפכה בתימן. זו לא סתם עוד מכה, זו תגובה ישירה וברורה על שיגור הכטב\"ם לעבר תל אביב.\n\nשלושים שנה אני מול המצלמה, ראיתי הרבה. אבל התגובה הזו, על רקע האיום ההולך וגובר מצפון וממזרח, היא סימן ברור: ישראל לא תסבול התקפות על אזרחיה. המסר נשלח, והוא חד וברור.\n\nהשאלה הגדולה היא האם כל גורמינו יודעים להבין את הפרופורציות של התגובה הזו.\n\n🎯",
    sentiment_score: 85,
    tags: JSON.stringify(["Perspective", "ביטחון", "תגובה"]),
    type: 'perspective',
    published_at: new Date().toISOString()
  };

  const { error } = await db.from('posts').insert(examplePerspective);
  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('✅ Example Hebrew Perspective post inserted successfully!');
  }
  process.exit(0);
}

insertExample();
