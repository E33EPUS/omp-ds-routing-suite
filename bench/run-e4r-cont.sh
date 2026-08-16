#!/bin/bash
# E4-R continuation: finish b1 (turns 7-8) and run b2 (all 8).
set -u
BASE=/d/bench-e4r
NATIVE="{\n  \"mode\": \"native\"\n}\n"

# b1 turns 7-8 (turn 6 completed before the timeout)
for i in 7 8; do
  cp "$BASE/t$i.txt" "/d/bench-e4r-b1/task.txt"
  ( cd "/d/bench-e4r-b1" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/bench-e4r-b1" --model deepseek-v4-flash @task.txt >> run.log 2>&1 )
  echo "b1 turn $i done exit=$?"
done
echo "b1 complete"

# b2 all 8 turns
mkdir -p "/d/bench-e4r-b2/.omp/ds-routing-suite"
printf "$NATIVE" > "/d/bench-e4r-b2/.omp/ds-routing-suite/settings.json"
for i in 1 2 3 4 5 6 7 8; do
  cp "$BASE/t$i.txt" "/d/bench-e4r-b2/task.txt"
  ( cd "/d/bench-e4r-b2" && MSYS_NO_PATHCONV=1 omp -p --cwd="D:/bench-e4r-b2" --model deepseek-v4-flash @task.txt >> run.log 2>&1 )
  echo "b2 turn $i done exit=$?"
done
echo "E4-R CONTINUATION DONE"
