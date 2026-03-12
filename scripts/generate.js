async function triggerGeneration() {
  console.log('🚀 Starting manual post generation...');
  
  try {
    const response = await fetch('http://localhost:3000/api/cron/generate', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer supersecretcron'
      }
    });

    const result = await response.text();
    
    if (response.ok) {
      console.log('✅ Generation Success!');
      console.log('Response:', result);
    } else {
      console.log('❌ Generation Failed');
      console.log('Status:', response.status);
      console.log('Error:', result);
      console.log('\nTip: Make sure your dev server (npm run dev) is running on http://localhost:3000');
    }
  } catch (error) {
    console.error('❌ Network Error:', error.message);
    console.log('\nTip: Is your dev server running? (npm run dev)');
  }
}

triggerGeneration();
