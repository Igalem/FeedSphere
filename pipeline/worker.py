import asyncio
import logging
import time
import sys
import os
from pipeline.main import run_pipeline
from pipeline.config import settings

# Ensure UTF-8 output on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Older python versions
        pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("worker")


async def main():
    logger.info("Starting FeedSphere Worker...")
    while True:
        try:
            start_time = time.time()
            logger.info("Executing pipeline run...")
            
            # Run the actual pipeline (not dry-run)
            await run_pipeline(dry_run=False)
            
            elapsed = time.time() - start_time
            logger.info(f"Pipeline run completed in {elapsed:.2f}s")
            
            # Interval in seconds (calculated from config)
            fetch_interval = settings.WORKER_INTERVAL_MINUTES * 60
            
            wait_time = max(0, fetch_interval - elapsed)
            logger.info(f"Next run in {wait_time/60:.1f} minutes")
            await asyncio.sleep(wait_time)
            
        except Exception as e:
            logger.error(f"Worker encountered an error: {e}")
            logger.info("Retrying in 60 seconds...")
            await asyncio.sleep(60)

if __name__ == "__main__":
    asyncio.run(main())
