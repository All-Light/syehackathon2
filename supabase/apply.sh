#!/usr/bin/env bash
# Applies supabase/schema.sql via the Supabase Management API.
#
# Needs a personal access token (the secret sb_secret_… key cannot run DDL):
#   https://supabase.com/dashboard/account/tokens
# Put it in .env as SUPABASE_ACCESS_TOKEN=sbp_…  then run:  bash supabase/apply.sh
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; . ./.env; set +a
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN saknas i .env}"
REF="${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID saknas i .env}"

curl -sS -X POST "https://api.supabase.com/v1/projects/${REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$(python3 -c 'import json;print(json.dumps({"query":open("supabase/schema.sql").read()}))')"
echo
