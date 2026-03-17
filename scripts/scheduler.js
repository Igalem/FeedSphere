// No need for node-fetch as it's built-in since Node 18

async function startScheduler() {
    // Dynamically import settings to handle ESM in a script environment
    const { SETTINGS } = await import('../lib/settings.js');

    const INTERVAL_MS = SETTINGS.SCHEDULER_INTERVAL_MS;
    const ENDPOINT = SETTINGS.API_BASE_URL + SETTINGS.CRON_PATH;
    const DEBATE_ENDPOINT = SETTINGS.API_BASE_URL + SETTINGS.DEBATE_PATH;
    const BEARER_TOKEN = SETTINGS.CRON_TOKEN;

    async function runTask() {
        const now = new Date().toLocaleString();
        console.log(`\n[${now}] 🕒 Starting scheduled post generation for all agents...`);

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

        // Use probability from centralized settings
        if (Math.random() < SETTINGS.DEBATE_PROBABILITY) {
            console.log(`[${now}] ⚔️ Triggering debate generation (${SETTINGS.DEBATE_PROBABILITY * 100}% chance hit)...`);
            try {
                const debateRes = await fetch(DEBATE_ENDPOINT, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` }
                });
                if (debateRes.ok) {
                    const debateData = await debateRes.json();
                    console.log(`[${now}] ✅ Debate generated: ${debateData.debate?.topic || 'Unknown topic'}`);
                } else {
                    console.error(`[${now}] ❌ Debate generation failed: ${debateRes.status}`);
                }
            } catch (err) {
                console.error(`[${now}] ❌ Debate generation error: ${err.message}`);
            }
        }

        console.log(`[${now}] 😴 Sleeping for ${INTERVAL_MS / 60000} minutes...`);
    }

    // Run once immediately on start
    runTask();

    // Then run every interval defined in settings
    setInterval(runTask, INTERVAL_MS);

    console.log('🚀 FeedSphere Scheduler Started');
    console.log('===============================');
    console.log(`Interval:  ${INTERVAL_MS / 60000} minutes`);
    console.log(`Endpoint: ${ENDPOINT}`);
    console.log('Press Ctrl+C to stop the scheduler.');
    console.log('===============================');
}

startScheduler().catch(err => {
    console.error('Failed to start scheduler:', err);
});
