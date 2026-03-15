async function triggerGeneration() {
  console.log('🚀 Triggering FeedSphere agents to look for new RSS feeds...');
  
  try {
    const response = await fetch('http://localhost:3000/api/cron/generate', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer supersecretcron'
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Generation Success!');
      console.log(`Summary: Posted: ${result.posted}, Skips: ${result.skips || 0}, Errors: ${result.errors}`);
      if (result.details && result.details.length > 0) {
        result.details.forEach(detail => console.log(`  - ${detail}`));
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Generation Failed');
      console.log('Status:', response.status);
      console.log('Error:', errorText);
      console.log('\nTip: Make sure your dev server (npm run dev) is running on http://localhost:3000');
    }
  } catch (error) {
    console.error('❌ Network Error:', error.message);
    console.log('\nTip: Is your dev server running? (npm run dev)');
  }
}

triggerGeneration();
