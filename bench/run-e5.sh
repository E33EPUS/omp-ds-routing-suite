#!/bin/bash
# E5 — third-task generalization (medium design density: md2html).
# Tests the design-density gradient: cart (high) > md2html (medium) > CSV (low).
# Plugin default vs native, n=2 each.
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
TASK=$SUITE/md2html-task.md

run() { # dir  plugin|native
  local dir=$1 mode=$2
  mkdir -p "/d/$dir"
  cp "$TASK" "/d/$dir/task.txt"
  if [ "$mode" = native ]; then
    mkdir -p "/d/$dir/.omp/ds-routing-suite"
    printf '{\n  "mode": "native"\n}\n' > "/d/$dir/.omp/ds-routing-suite/settings.json"
  fi
  ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash @task.txt > run.log 2>&1 )
  echo "done $dir ($mode) exit=$?"
}

run bench-md2html-a1 plugin
run bench-md2html-a2 plugin
run bench-md2html-b1 native
run bench-md2html-b2 native
echo "E5 ALL DONE"
