#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN is required."
  exit 1
fi

if [[ -z "${TELEGRAM_WEBHOOK_SECRET:-}" ]]; then
  echo "ERROR: TELEGRAM_WEBHOOK_SECRET is required."
  exit 1
fi

PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://diegodella.ar}"
API_PREFIX="${API_PREFIX:-}"
WEBHOOK_URL="${PUBLIC_BASE_URL%/}${API_PREFIX}/api/telegram"

echo "Registering Telegram webhook:"
echo "  ${WEBHOOK_URL}"

curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  --data "{\"url\":\"${WEBHOOK_URL}\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\"}"

echo
