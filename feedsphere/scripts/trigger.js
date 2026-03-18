async function trigger() {
  try {
    console.log('Triggering cron generation...');
    const response = await fetch('http://localhost:3000/api/cron/generate', {
      headers: { 'Authorization': 'Bearer supersecretcron' }
    });
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Trigger failed:', err.message);
  }
}
trigger();
