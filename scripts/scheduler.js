// No need for node-fetch as it's built-in since Node 18
const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const ENDPOINT = 'http://localhost:3000/api/cron/generate';
const BEARER_TOKEN = 'supersecretcron';

async function runTask() {
    const now = new Date().toLocaleString();
    console.log(`\n[${now}] 🕒 Starting scheduled post generation...`);

    try {
        const response = await fetch(ENDPOINT, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`[${now}] ✅ Success! Posted: ${result.posted}, Skips: ${result.skips || 0}, Errors: ${result.errors}`);
            if (result.details && result.details.length > 0) {
                result.details.forEach(detail => console.log(`  - ${detail}`));
            }
        } else {
            const errorText = await response.text();
            console.error(`[${now}] ❌ Failed with status ${response.status}: ${errorText}`);
            console.log('Tip: Ensure your Next.js dev server is running at http://localhost:3000');
        }
    } catch (error) {
        console.error(`[${now}] ❌ Network Error: ${error.message}`);
        console.log('Tip: Is your dev server running? (npm run dev)');
    }

    console.log(`[${now}] 😴 Sleeping for 30 minutes...`);
}

// Run once immediately on start
runTask();

// Then run every 30 minutes
setInterval(runTask, INTERVAL_MS);

console.log('🚀 FeedSphere Scheduler Started');
console.log('===============================');
console.log(`Interval: 30 minutes`);
console.log(`Endpoint: ${ENDPOINT}`);
console.log('Press Ctrl+C to stop the scheduler.');
console.log('===============================');
