#!/usr/bin/env bash
set -euo pipefail

# Local demo credential bridge (managed by tools/fix_demo_autofill.mjs)
demo_credentials_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -f "$demo_credentials_project_dir/.env" ]; then
  while IFS= read -r demo_credentials_line || [ -n "$demo_credentials_line" ]; do
    case "$demo_credentials_line" in ''|'#'*) continue ;; esac
    demo_credentials_line="${demo_credentials_line#export }"
    demo_credentials_key="${demo_credentials_line%%=*}"
    demo_credentials_value="${demo_credentials_line#*=}"
    case "$demo_credentials_key" in
      NODE_ENV|ENABLE_DEMO_CREDENTIAL_AUTOFILL|DEMO_EMAIL|DEMO_PASSWORD|SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD|ADMIN_EMAIL|ADMIN_PASSWORD|DEFAULT_EMAIL|DEFAULT_PASSWORD) ;;
      *) continue ;;
    esac
    [ -n "${!demo_credentials_key+x}" ] && continue
    demo_credentials_first="${demo_credentials_value:0:1}"
    demo_credentials_last="${demo_credentials_value: -1}"
    if { [ "$demo_credentials_first" = '"' ] && [ "$demo_credentials_last" = '"' ]; } || { [ "$demo_credentials_first" = "'" ] && [ "$demo_credentials_last" = "'" ]; }; then
      demo_credentials_value="${demo_credentials_value:1:${#demo_credentials_value}-2}"
    fi
    export "$demo_credentials_key=$demo_credentials_value"
  done < "$demo_credentials_project_dir/.env"
fi
demo_credentials_email=""
demo_credentials_password=""
if [ -n "${DEMO_EMAIL:-}" ] && [ -n "${DEMO_PASSWORD:-}" ]; then
  demo_credentials_email="$DEMO_EMAIL"
  demo_credentials_password="$DEMO_PASSWORD"
elif [ -n "${SEED_ADMIN_EMAIL:-}" ] && [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$SEED_ADMIN_EMAIL"
  demo_credentials_password="$SEED_ADMIN_PASSWORD"
elif [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  demo_credentials_email="$ADMIN_EMAIL"
  demo_credentials_password="$ADMIN_PASSWORD"
elif [ -n "${DEFAULT_EMAIL:-}" ] && [ -n "${DEFAULT_PASSWORD:-}" ]; then
  demo_credentials_email="$DEFAULT_EMAIL"
  demo_credentials_password="$DEFAULT_PASSWORD"
fi
if [ "${NODE_ENV:-development}" != production ] && [ "${ENABLE_DEMO_CREDENTIAL_AUTOFILL:-true}" = true ] && [ -n "$demo_credentials_email" ] && [ -n "$demo_credentials_password" ]; then
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export VITE_DEMO_EMAIL="$demo_credentials_email"
  export VITE_DEMO_PASSWORD="$demo_credentials_password"
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export REACT_APP_DEMO_EMAIL="$demo_credentials_email"
  export REACT_APP_DEMO_PASSWORD="$demo_credentials_password"
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=true
  export NEXT_PUBLIC_DEMO_EMAIL="$demo_credentials_email"
  export NEXT_PUBLIC_DEMO_PASSWORD="$demo_credentials_password"
else
  export VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  export NEXT_PUBLIC_ENABLE_DEMO_CREDENTIAL_AUTOFILL=false
  unset VITE_DEMO_EMAIL VITE_DEMO_PASSWORD REACT_APP_DEMO_EMAIL REACT_APP_DEMO_PASSWORD NEXT_PUBLIC_DEMO_EMAIL NEXT_PUBLIC_DEMO_PASSWORD
fi
unset demo_credentials_email demo_credentials_password demo_credentials_project_dir demo_credentials_line demo_credentials_key demo_credentials_value demo_credentials_first demo_credentials_last

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
