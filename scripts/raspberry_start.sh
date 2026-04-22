#!/usr/bin/env bash
set -euo pipefail

echo "This MVP is started by Coolify, not by a standalone systemd service."
echo
echo "Use Coolify to deploy this project with:"
echo "  Build: Dockerfile"
echo "  Port: 3000"
echo "  Volume: /data"
echo "  Health: /api/health"
echo
echo "See COOLIFY_MVP_RUNBOOK.md for the full deployment checklist."
