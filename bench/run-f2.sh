#!/bin/bash
# F2 — long-horizon chain + J-Space loop protocol stacking.
# E4-R's 8-turn parser chain, plugin default + J-Space protocol (workspace
# copy + ledger controller available to the model). Per-turn isolated
# processes, same as E4-R. Comparison: E4-R a1/a2 (plugin, no protocol).
set -u
SUITE=/d/Claude_ds/omp-ds-routing-suite/bench
JSPACE=/d/Claude_ds/J-Space-Cognition-Suite-V3.6/j-space
BASE=/d/bench-jspace-f
mkdir -p "$BASE"

cat > "$BASE/t1.txt" << 'EOF'
Implement parser.js from bench/parser-task.md in this workspace (CSV parser:
parse with quoted-field rules, toCSV serialization, ParseError on unclosed
quotes). Also write test.js with >=10 node:assert assertions. node test.js must
pass. Use the j-space protocol: read j-space/SKILL.md first, follow its gate
and registers, and use j-space/scripts/jspace.py for the ledger if it routes
you to loop mode.
EOF
cat > "$BASE/t2.txt" << 'EOF'
Bug: parse() fails when a field contains escaped quotes ("" inside quotes).
Fix it, add a test case, and keep node test.js green. Follow the j-space
protocol (j-space/SKILL.md in this workspace; continue the ledger).
EOF
cat > "$BASE/t3.txt" << 'EOF'
Extend: add toCSV(rows) round-trip support — parse(toCSV(rows)) must equal rows
for rows containing commas and quotes. Add tests. Continue the j-space
protocol and ledger.
EOF
cat > "$BASE/t4.txt" << 'EOF'
Bug: empty lines inside quoted fields are dropped. Fix parse() so quoted
newlines are preserved. Add a test, keep node test.js green. Continue the
j-space protocol and ledger.
EOF
cat > "$BASE/t5.txt" << 'EOF'
Extend: errors must report the line number (ParseError with .line). Update
tests to assert the line number on unclosed-quote errors. Continue the
j-space protocol and ledger.
EOF
cat > "$BASE/t6.txt" << 'EOF'
Bug: a trailing newline at the end of input creates a spurious empty record.
Fix it. Add a test, keep node test.js green. Continue the j-space protocol
and ledger.
EOF
cat > "$BASE/t7.txt" << 'EOF'
Extend: support semicolon as an alternative delimiter (parse(text, {delimiter:
';'})). toCSV must default to comma. Add tests. Continue the j-space protocol
and ledger.
EOF
cat > "$BASE/t8.txt" << 'EOF'
Bug: toCSV is quadratic on large inputs (repeated string concatenation).
Optimize it, keep all tests green, and verify with a 10k-row input. Continue
the j-space protocol and ledger.
EOF

run_chain() { # dir
  local dir=$1 i
  mkdir -p "/d/$dir"
  cp -r "$JSPACE" "/d/$dir/j-space"
  for i in 1 2 3 4 5 6 7 8; do
    cp "$BASE/t$i.txt" "/d/$dir/task.txt"
    ( cd "/d/$dir" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/$dir" --model deepseek-v4-flash @task.txt >> run.log 2>&1 )
    echo "  $dir turn $i done exit=$?"
  done
  echo "done $dir"
}

run_chain bench-jspace-f1
run_chain bench-jspace-f2
echo "F2 ALL DONE"
