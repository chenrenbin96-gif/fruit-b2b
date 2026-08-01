#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/fruit-order
source deploy/production-toolkit/lib.sh
load_env
# stop preserves containers and named database volumes; never uses down -v.
compose stop
