#!/bin/bash
# Serves the prototype on localhost and opens it. Double-clicking index.html also works;
# this just gives the browser a normal origin so saved data and uploaded files persist reliably.
cd "$(dirname "$0")" || exit 1
PORT=4180
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  open "http://127.0.0.1:$PORT/"
  echo "Prototype is already serving at http://127.0.0.1:$PORT/ — opened it in your browser."
  echo "(To restart the server, run: kill $(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t | tr '\n' ' ') then open this again.)"
  exit 0
fi
open "http://127.0.0.1:$PORT/"
exec python3 -m http.server $PORT --bind 127.0.0.1
