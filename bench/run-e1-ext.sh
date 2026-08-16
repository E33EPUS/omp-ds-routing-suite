#!/bin/bash
# E1 extension: hesitation causality n=2 -> n=4 (adds hes-7..12).
# Same task (cart-task.md) and tail texts as run-experiments.sh E1 block.
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
CART=$SUITE/cart-task.md

INHIBIT='Do not second-guess yourself. Make decisions quickly and commit.'
ENCOURAGE='Explicitly list candidate approaches, weigh them, and reject the weaker ones before deciding.'

run() { # dir tailtext
  local dir=$1 tailtext=${2:-}
  mkdir -p "/d/$dir"
  cp "$CART" "/d/$dir/task.txt"
  if [ -n "$tailtext" ]; then printf '\n\n%s' "$tailtext" >> "/d/$dir/task.txt"; fi
  ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash @task.txt > run.log 2>&1 )
  echo "done $dir exit=$?"
}

run bench-hes-7 "$INHIBIT"
run bench-hes-8 "$ENCOURAGE"
run bench-hes-9 ""
run bench-hes-10 "$INHIBIT"
run bench-hes-11 "$ENCOURAGE"
run bench-hes-12 ""
echo "E1 EXT DONE"
