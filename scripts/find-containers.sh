#!/usr/bin/env bash
set -euo pipefail
rg -n --glob '!node_modules' \
  -e 'max-w-7xl.*mx-auto.*px-4.*sm:px-6.*lg:px-8' \
  -e 'mx-auto.*(px-4|px-6|px-8).*(max-w-(screen|7xl))' \
  app components

