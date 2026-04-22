#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CHAT_ID="${TELEGRAM_CHAT_ID:-123}"
TOPIC="${TOPIC:-bitcoin etf record inflows}"

echo "[1/4] Health check"
curl -fsS "${BASE_URL%/}/api/health"
echo

echo "[2/4] Create landing through Telegram webhook fallback"
curl -fsS -X POST "${BASE_URL%/}/api/telegram" \
  -H "Content-Type: application/json" \
  --data "{\"message\":{\"message_id\":1,\"chat\":{\"id\":\"${CHAT_ID}\"},\"text\":\"/start_live ${TOPIC}\"}}"
echo

SLUG="$(printf '%s' "${TOPIC}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"

echo "[3/4] Verify public landing"
curl -fsSI "${BASE_URL%/}/landings/${SLUG}" | head -n 1

echo "[4/4] Trigger live cycle"
curl -fsS -X POST "${BASE_URL%/}/api/internal/live-cycle"
echo
