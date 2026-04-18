import asyncio
import httpx
from pipeline.config import settings

async def test_ollama():
    print(f"Testing Ollama at {settings.OLLAMA_BASE_URL} with model {settings.OLLAMA_MODEL}")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            data = {
                "model": settings.OLLAMA_MODEL,
                "messages": [{"role": "user", "content": "hi"}],
                "stream": False,
                "format": "json"
            }
            resp = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=data)
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text[:100]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ollama())
