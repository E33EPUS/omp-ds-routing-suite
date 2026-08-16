#!/bin/bash
# E3 extension: resident comparison n=2 -> n=4 (adds res5..8).
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

run bench-res5 off
run bench-res6 off
run bench-res7 on
run bench-res8 on
echo "E3 EXT DONE"
