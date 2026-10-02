#!/usr/bin/env bash
set -euo pipefail

node preparar-local.mjs
exec node scripts/run-framework.mjs dev --hostname 0.0.0.0
