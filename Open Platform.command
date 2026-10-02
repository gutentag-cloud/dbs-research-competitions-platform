#!/bin/bash
# Serves the prototype on localhost and opens it. Opening index.html directly also works;
# this just gives the browser a normal origin so saved data and uploaded files persist reliably.
cd "$(dirname "$0")"
PORT=4180
open "http://127.0.0.1:$PORT/"
exec python3 -m http.server $PORT --bind 127.0.0.1
