#!/bin/bash
# E3 — resident catalog comparison (anchored-standard post-promotion
# regression guard). Cart task, plugin default (weak+anchor+guide);
# variable: promoted catalog = full native set vs resident narrow set.
# resident on = settings.json {"resident": true} — no GUI restart needed,
# each omp -p process loads the extension fresh.
# Usage: sh bench/run-e3.sh
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
CART=$SUITE/cart-task.md

run() { # dir resident(on|off)
  local dir=$1 mode=$2
  mkdir -p "/d/$dir"
  cp "$CART" "/d/$dir/task.txt"
  if [ "$mode" = on ]; then
    mkdir -p "/d/$dir/.omp/ds-routing-suite"
    printf '{\n  "resident": true\n}\n' > "/d/$dir/.omp/ds-routing-suite/settings.json"
  fi
  ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash @task.txt > run.log 2>&1 )
  echo "done $dir (resident=$mode) exit=$?"
}

run bench-res1 off
run bench-res2 off
run bench-res3 on
run bench-res4 on
echo "E3 ALL DONE"
