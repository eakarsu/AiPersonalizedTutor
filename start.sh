#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
if [[ "${NODE_ENV:-}" == test && -n "${RUNTIME_PROJECT_SOURCE:-}" && -d "${RUNTIME_PROJECT_SOURCE:-}" ]]; then project_dir="$(cd "$RUNTIME_PROJECT_SOURCE" && pwd)"; fi
load_env_file(){
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# || "$line" =~ ^[[:space:]]*$ ]] && continue
    line="${line#export }"; key="${line%%=*}"; value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ -n "${!key+x}" ]] && continue
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then value="${value:1:${#value}-2}"; elif [[ "$value" == \'*\' && "$value" == *\' ]]; then value="${value:1:${#value}-2}"; fi
    export "$key=$value"
  done < "$project_dir/.env"
}
[[ -f "$project_dir/.env" ]] || { echo "Missing required file: $project_dir/.env" >&2; exit 1; }
load_env_file
: "${BACKEND_PORT:?BACKEND_PORT is required}"
: "${FRONTEND_PORT:?FRONTEND_PORT is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
[[ "$BACKEND_PORT" =~ ^[0-9]+$ ]] || { echo "BACKEND_PORT must be an integer" >&2; exit 1; }
[[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] || { echo "FRONTEND_PORT must be an integer" >&2; exit 1; }
[[ ${#JWT_SECRET} -ge 32 ]] || { echo "JWT_SECRET must be at least 32 characters" >&2; exit 1; }
if [[ "${NODE_ENV:-}" == test ]]; then CORS_ORIGINS="http://127.0.0.1:$FRONTEND_PORT"; else : "${CORS_ORIGINS:?CORS_ORIGINS is required outside test mode}"; fi
export CORS_ORIGINS
if [[ "${NODE_ENV:-development}" != production ]]; then export ENABLE_LEGACY_PROVIDER_ROUTES=true; fi
for dependency_dir in "$project_dir/backend/node_modules" "$project_dir/frontend/node_modules"; do [[ -d "$dependency_dir" ]] || { echo "Missing dependencies: $dependency_dir" >&2; exit 1; }; done
for assigned_port in "$BACKEND_PORT" "$FRONTEND_PORT"; do lsof -nP -iTCP:"$assigned_port" -sTCP:LISTEN >/dev/null 2>&1 && { echo "Assigned port $assigned_port is already occupied" >&2; exit 1; }; done
(cd "$project_dir/backend" && exec node scripts/runtime-migrate.js)
(cd "$project_dir/backend" && exec node scripts/create-admin.js)
(cd "$project_dir/backend" && exec env BACKEND_PORT="$BACKEND_PORT" CORS_ORIGINS="$CORS_ORIGINS" npm start) & backend_pid=$!
(cd "$project_dir/frontend" && exec env VITE_API_URL="http://127.0.0.1:$BACKEND_PORT/api" BROWSER=none npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) & frontend_pid=$!
cleanup(){ trap - EXIT INT TERM; kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; wait "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
