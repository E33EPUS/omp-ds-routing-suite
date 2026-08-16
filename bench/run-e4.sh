#!/bin/bash
# E4 — long-horizon related-task chain (paper P21 design, parser task).
# 8 sequential turns: write -> fix -> extend -> fix -> extend -> fix -> extend -> fix.
# Each turn is one message file; omp -p processes them in order within one
# session, so each turn sees the previous turns' artifacts (real long-horizon).
# Conditions: A = plugin default (weak+anchor+guide), B = native (settings).
# Usage: sh bench/run-e4.sh
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
BASE=/d/bench-e4
mkdir -p "$BASE"

# ---- turn messages (shared) ----
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

run_chain() { # dir  settings_mode(plugin|native)
  local dir=$1 mode=$2 i
  mkdir -p "/d/$dir"
  if [ "$mode" = native ]; then
    mkdir -p "/d/$dir/.omp/ds-routing-suite"
    printf '{\n  "mode": "native"\n}\n' > "/d/$dir/.omp/ds-routing-suite/settings.json"
  fi
  local files=()
  for i in 1 2 3 4 5 6 7 8; do
    cp "$BASE/t$i.txt" "/d/$dir/t$i.txt"
    files+=("@t$i.txt")
  done
  ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash "${files[@]}" > run.log 2>&1 )
  echo "done $dir ($mode) exit=$?"
}

run_chain bench-e4-a1 plugin
run_chain bench-e4-a2 plugin
run_chain bench-e4-b1 native
run_chain bench-e4-b2 native
echo "E4 ALL DONE"
