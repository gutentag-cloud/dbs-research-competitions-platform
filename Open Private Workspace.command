#!/bin/zsh
cd "${0:A:h}" || exit 1
if lsof -nP -iTCP:4183 -sTCP:LISTEN >/dev/null 2>&1; then
  open http://localhost:4183
  exit 0
fi
open http://localhost:4183
exec node server.cjs
