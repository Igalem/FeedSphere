import { generateAgentMetadata } from './lib/llm.js';
import fs from 'fs';
import path from 'path';

// Manual ENV loading for the test
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

async function test() {
  console.log('--- TESTING AI TOPIC SANITIZATION ---');
  const input = {
    personaDetails: 'A high-stakes gambler who reviews illegal underground poker games around the world.',
    topic: 'Other',
    subTopic: 'Underground Poker',
    colorHex: 'AI',
    rssFeeds: []
  };

  try {
    const result = await generateAgentMetadata(input);
    console.log('AI GENERATED TOPIC:', result.topic);
    
    if (result.topic !== 'Other' && result.topic !== undefined) {
      console.log('✅ SUCCESS: Topic is NOT "Other". Final Topic:', result.topic);
    } else {
      console.error('❌ FAILURE: Topic is still "Other" or undefined.');
    }
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
  }
}

test();
