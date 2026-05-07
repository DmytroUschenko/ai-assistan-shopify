
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./ask-question.sh "Your question here"

# Configurable via environment variables; falls back to existing values
BASE_URL=${LOKTE_API_BASE_URL:-"https://lokte.vaimo.network"}
TOKEN=${LOKTE_API_TOKEN:-"on_8gUE_pWEWfKyXmFbpONXnGGtW8zNaf1hhLZ07CPm3GVN5zJQSMOUKZ863eoTZszOiT6udr46C-7BvWHFydXLDB1wiK1sxvh07ZW-IXtIrTl31NP6nU5TQBwEfHOFv8ggGVPNrK2Yr_yC3UUzUEZ192i-2PTEJrxz2d8Asz33JboDtHtGTXXP7DZ_oA6VS7sNlDGrnJUONk7xoJ_1sV375OFBTKzAv1xtg5hNIdMTnL1QVr9Y3BLomsqOWfzQFaZm"}
PERSONA_ID=${LOKTE_PERSONA_ID:-"238"}

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 \"Your question here\""
  exit 1
fi

# Combine all arguments as the question
QUESTION="$*"

# JSON-escape the question using Python (pass as arg to avoid stdin conflicts)
QUESTION_JSON=$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$QUESTION")

echo "Creating chat session..." >&2
create_resp=$(curl -sS -X POST "$BASE_URL/api/chat/create-chat-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"persona_id\": \"$PERSONA_ID\"}")

# Try to parse session id using jq if available; otherwise use Python
if command -v jq >/dev/null 2>&1; then
  session_id=$(printf "%s" "$create_resp" | jq -r '.id // .chat_session_id // empty')
else
  session_id=$(printf "%s" "$create_resp" | python3 - << 'PY'
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get("id") or d.get("chat_session_id") or "")
except Exception:
    print("")
PY
)
fi

if [ -z "${session_id:-}" ]; then
  echo "Failed to retrieve chat session id. Response was:" >&2
  echo "$create_resp" >&2
  exit 1
fi

echo "Session: $session_id" >&2

# Build payload; embed already JSON-escaped question
read -r -d '' payload <<EOF || true
{
  "chat_session_id": "$session_id",
  "parent_message_id": null,
  "message": $QUESTION_JSON,
  "file_descriptors": [],
  "prompt_id": 0,
  "search_doc_ids": null,
  "retrieval_options": {
    "run_search": "auto",
    "real_time": true,
    "filters": {
      "source_type": null,
      "document_set": null,
      "time_cutoff": null,
      "tags": []
    }
  },
  "query_override": null
}
EOF

echo "Sending message..." >&2
curl -sS -X POST "$BASE_URL/api/chat/send-message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$payload"
