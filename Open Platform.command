#!/bin/zsh
cd "${0:A:h}"
export PILOT_ORIGIN=http://localhost:4180
open http://localhost:4180
python3 server.py --port 4180
