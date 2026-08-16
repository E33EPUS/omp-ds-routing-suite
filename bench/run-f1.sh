#!/bin/bash
# F1 — J-Space protocol vs our plugin, cart task.
#   A (control, existing data): plugin default, no protocol
#   B: native + J-Space SKILL.md protocol (workspace copy, model cats modules on demand)
#   C: plugin default + J-Space protocol (stacking test)
# Metrics: depth, hesitation (does the dense track replace it?), we/I forms
# (does the protocol's I/we-need instruction change trajectory form?), assertions.
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
CART=$SUITE/cart-task.md
JSPACE=/d/Claude_ds/J-Space-Cognition-Suite-V3.6/j-space

PROTO='Before this task, read j-space/SKILL.md in this workspace and follow its protocol for this task. You may read any module under j-space/ it routes you to.'

run() { # dir  plugin|native
  local dir=$1 mode=$2
  mkdir -p "/d/$dir"
  cp -r "$JSPACE" "/d/$dir/j-space"
  cp "$CART" "/d/$dir/task.txt"
  { printf '%s\n\n' "$PROTO"; cat "$CART"; } > "/d/$dir/msg.txt"
  if [ "$mode" = native ]; then
    mkdir -p "/d/$dir/.omp/ds-routing-suite"
    printf '{\n  "mode": "native"\n}\n' > "/d/$dir/.omp/ds-routing-suite/settings.json"
  fi
  ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash @msg.txt > run.log 2>&1 )
  echo "done $dir ($mode) exit=$?"
}

run bench-jspace-b1 native
run bench-jspace-b2 native
run bench-jspace-c1 plugin
run bench-jspace-c2 plugin
echo "F1 ALL DONE"
