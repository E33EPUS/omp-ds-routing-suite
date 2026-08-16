#!/bin/bash
# run-experiments.sh — headless E1 (hesitation causality) + E2 (task generalization)
# via omp -p (non-interactive). Each run: empty dir + task file + optional tail text.
# Usage: sh bench/run-experiments.sh   (runs everything, logs to each dir/run.log)
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
CART=$SUITE/cart-task.md
PARSER=$SUITE/parser-task.md

INHIBIT='Do not second-guess yourself. Make decisions quickly and commit.'
ENCOURAGE='Explicitly list candidate approaches, weigh them, and reject the weaker ones before deciding.'

run() { # dir taskfile tailtext
  local dir=$1 task=$2 tailtext=${3:-}
  mkdir -p "/d/$dir"
  cp "$task" "/d/$dir/task.txt"
  if [ -n "$tailtext" ]; then printf '\n\n%s' "$tailtext" >> "/d/$dir/task.txt"; fi
  ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash @task.txt > run.log 2>&1 )
  echo "done $dir exit=$?"
}

# E1: hesitation causality (hes-1 already done as neutral #1)
run bench-hes-2 "$CART" "$INHIBIT"
run bench-hes-3 "$CART" "$ENCOURAGE"
run bench-hes-4 "$CART" ""
run bench-hes-5 "$CART" "$INHIBIT"
run bench-hes-6 "$CART" "$ENCOURAGE"

# E2: task generalization — plugin default (anchor on) vs native (settings)
for d in bench-parser-a1 bench-parser-a2; do
  run "$d" "$PARSER"
done
for d in bench-parser-b1 bench-parser-b2; do
  mkdir -p "/d/$d/.omp/ds-routing-suite"
  printf '{\n  "mode": "native"\n}\n' > "/d/$d/.omp/ds-routing-suite/settings.json"
  run "$d" "$PARSER"
done
echo "ALL DONE"
