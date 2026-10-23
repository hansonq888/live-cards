#!/usr/bin/env bash
# Build the image, push it to ACR and roll the Container App to it.
#   deploy/redeploy.sh v5
set -euo pipefail
TAG="${1:?usage: deploy/redeploy.sh <tag>}"
RG=rg-hansonq888-1273
ACR=livecardsacr72b7
APP=livecards
cd "$(dirname "$0")/.."
az acr login -n "$ACR" --only-show-errors >/dev/null
docker buildx build --platform linux/amd64 -t "$ACR.azurecr.io/livecards:$TAG" --push .
az containerapp update -n "$APP" -g "$RG" --image "$ACR.azurecr.io/livecards:$TAG" --only-show-errors -o none
URL="https://$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
for _ in $(seq 1 60); do
  if curl -fs -m 8 "$URL/api/status" >/dev/null; then curl -s "$URL/api/status"; echo; echo "live: $URL"; exit 0; fi
  sleep 5
done
echo "not healthy after 5 minutes: check 'az containerapp logs show -n $APP -g $RG'" >&2; exit 1
