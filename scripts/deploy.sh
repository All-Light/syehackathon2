#!/usr/bin/env bash
# Link the Vercel project, push the runtime secrets, deploy to production.
# Run `vercel login` first.
set -euo pipefail
cd "$(dirname "$0")/.."

# Named explicitly, never defaulted. A wrong name here re-links the directory
# and deploys over whatever already lives at that project's domain.
PROJEKT="${VERCEL_PROJECT:?set VERCEL_PROJECT to the target Vercel project}"

# Only what the running app needs. SUPABASE_ACCESS_TOKEN is a personal admin
# token that can run DDL on every project in the account — it belongs on this
# machine, never in a deployment. SUPABASE_SLUG is unused.
RUNTIME=(
  FIRECRAWL_API_KEY
  EXA_API_KEY
  OPENCODE_API_KEY
  SUPABASE_URL
  SUPABASE_API_KEY
  SUPABASE_PROJECT_ID
  SUPABASE_ANON_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  ELEVENLABS_API_KEY
  ANTHROPIC_API_KEY
  NEXT_PUBLIC_KOP_AKTIV
)

vercel link --yes --project "$PROJEKT"

set -a; . ./.env; set +a

for namn in "${RUNTIME[@]}"; do
  varde="${!namn:-}"
  if [ -z "$varde" ]; then
    echo "  skip $namn (not set locally)"
    continue
  fi
  # Replace rather than duplicate: re-running this script is normal.
  vercel env rm "$namn" production --yes >/dev/null 2>&1 || true
  printf '%s' "$varde" | vercel env add "$namn" production >/dev/null
  echo "  set  $namn"
done

vercel --prod
