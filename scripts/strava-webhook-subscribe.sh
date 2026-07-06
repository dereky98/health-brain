#!/usr/bin/env bash
# One-time Strava webhook subscription bootstrap (one subscription per app).
#
# Usage:
#   STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=... STRAVA_VERIFY_TOKEN=... \
#     ./scripts/strava-webhook-subscribe.sh https://<ref>.supabase.co/functions/v1/webhooks/strava
#
# Strava will immediately GET the callback URL with a hub.challenge — the
# webhooks function must already be deployed with the same STRAVA_VERIFY_TOKEN.
# On success this prints {"id": <subscription_id>}: set that as the
# STRAVA_SUBSCRIPTION_ID function secret so events are validated against it.
set -euo pipefail

CALLBACK_URL="${1:?usage: strava-webhook-subscribe.sh <callback-url>}"

curl -sf -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id="${STRAVA_CLIENT_ID:?}" \
  -F client_secret="${STRAVA_CLIENT_SECRET:?}" \
  -F callback_url="$CALLBACK_URL" \
  -F verify_token="${STRAVA_VERIFY_TOKEN:?}"
echo
