#!/bin/bash
# E4-R — long-horizon chain RERUN, per-turn isolated processes.
# Fixes the batch confound of E4: there, omp -p merged all 8 message files
# into one request, so the model saw future instructions and past code in
# context (read-less-but-more-complete was not interpretable). Here each
# turn is a fresh omp -p process in the same cwd: the model must read the
# on-disk state every turn (real read behavior, no session-memory shortcut).
# Conditions: plugin default vs native, n=2 each.
# Usage: sh bench/run-e4-rerun.sh
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
BASE=/d/bench-e4r
mkdir -p "$BASE"

cat > "$BASE/t1.txt" << 'EOF'
Implement parser.js from bench/parser-task.md in this directory (CSV parser:
parse with quoted-field rules, toCSV serialization, ParseError on unclosed
quotes). Also write test.js with >=10 node:assert assertions. node test.js must
pass.
EOF
cat > "$BASE/t2.txt" << 'EOF'
Bug: parse() fails when a field contains escaped quotes ("" inside quotes).
Fix it, add a test case, and keep node test.js green.
EOF
cat > "$BASE/t3.txt" << 'EOF'
Extend: add toCSV(rows) round-trip support — parse(toCSV(rows)) must equal rows
for rows containing commas and quotes. Add tests.
EOF
cat > "$BASE/t4.txt" << 'EOF'
Bug: empty lines inside quoted fields are dropped. Fix parse() so quoted
newlines are preserved. Add a test, keep node test.js green.
EOF
cat > "$BASE/t5.txt" << 'EOF'
Extend: errors must report the line number (ParseError with .line). Update
tests to assert the line number on unclosed-quote errors.
EOF
cat > "$BASE/t6.txt" << 'EOF'
Bug: a trailing newline at the end of input creates a spurious empty record.
Fix it. Add a test, keep node test.js green.
EOF
cat > "$BASE/t7.txt" << 'EOF'
Extend: support semicolon as an alternative delimiter (parse(text, {delimiter:
';'})). toCSV must default to comma. Add tests.
EOF
cat > "$BASE/t8.txt" << 'EOF'
Bug: toCSV is quadratic on large inputs (repeated string concatenation).
Optimize it, keep all tests green, and verify with a 10k-row input.
EOF

run_chain() { # dir  plugin|native
  local dir=$1 mode=$2 i
  mkdir -p "/d/$dir"
  if [ "$mode" = native ]; then
    mkdir -p "/d/$dir/.omp/ds-routing-suite"
    printf '{\n  "mode": "native"\n}\n' > "/d/$dir/.omp/ds-routing-suite/settings.json"
  fi
  for i in 1 2 3 4 5 6 7 8; do
    cp "$BASE/t$i.txt" "/d/$dir/task.txt"
    ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash @task.txt >> run.log 2>&1 )
    echo "  $dir turn $i done exit=$?"
  done
  echo "done $dir ($mode)"
}

run_chain bench-e4r-a1 plugin
run_chain bench-e4r-a2 plugin
run_chain bench-e4r-b1 native
run_chain bench-e4r-b2 native
echo "E4-R ALL DONE"
