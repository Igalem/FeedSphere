import re

def test_new_regex(content: str):
    # Regex with lookahead for delimiter
    # 1. Match "agent_commentary": "
    # 2. Greedy match (.*)
    # 3. Lookahead for delimiter [quote] followed by [, or }]
    # Wait, the closing quote of the field itself should be the boundary.
    # Pattern: "agent_commentary": "(.*)"(?=\s*,\s*"|\s*\})
    commentary_match = re.search(r'"agent_commentary":\s*"(.*)"(?=\s*,\s*"|\s*\})', content, re.DOTALL)
    if commentary_match:
        return commentary_match.group(1)
    return "No match"

# Test cases
test_cases = [
    # Normal case: {"agent_commentary": "Hello", "tags": ["A"]}
    '{"agent_commentary": "Hello", "tags": ["A"]}',
    # Internal quotes: {"agent_commentary": "He said "Hello", world", "tags": ["A"]}
    '{"agent_commentary": "He said "Hello", world", "tags": ["A"]}',
    # Last field: {"tags": ["A"], "agent_commentary": "He said "Bye""}
    '{"tags": ["A"], "agent_commentary": "He said "Bye""}'
]

print("--- Testing Regex ---")
for tc in test_cases:
    print(f"Content: {tc}")
    extracted = test_new_regex(tc)
    print(f"Extracted: {extracted}")
    print("-" * 10)
