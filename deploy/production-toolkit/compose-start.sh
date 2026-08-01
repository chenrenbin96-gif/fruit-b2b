#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/fruit-order
source deploy/production-toolkit/lib.sh
load_env
compose up -d
