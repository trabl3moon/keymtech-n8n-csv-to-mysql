#!/usr/bin/env bash
# Spin up MySQL + n8n, import the workflow and a local MySQL credential, publish it, and run both sample files.
# Requires Docker. Uses only the throwaway passwords defined in docker-compose.yml.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: don't rewrite container paths
cd "$(dirname "$0")/.."

docker compose up -d
cat > /tmp/n8n-cred.json <<'JSON'
[{"id":"mysqlLocal","name":"MySQL account","type":"mySql","data":{"host":"mysql","port":3306,"database":"imports","user":"n8n","password":"n8npass","ssl":false}}]
JSON
docker compose cp /tmp/n8n-cred.json n8n:/tmp/cred.json
docker compose cp workflow/csv-to-mysql.workflow.json n8n:/tmp/wf.json
docker compose exec -T n8n n8n import:credentials --input=/tmp/cred.json
docker compose exec -T n8n n8n import:workflow --input=/tmp/wf.json
docker compose exec -T n8n n8n publish:workflow --id=csvToMysqlDemo01
docker compose restart n8n
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5678/form/csv-import)" = 200 ]; do sleep 2; done

for f in samples/customers_good.csv samples/customers_mixed.csv; do
  echo "== $f"
  curl -s -F "field-0=@$f;type=text/csv" http://localhost:5678/form/csv-import; echo
done
sleep 3
docker compose exec -T mysql mysql -un8n -pn8npass imports -e "SELECT external_id, name, email, signup_date, credit_limit FROM customers ORDER BY external_id"
echo "Open http://localhost:5678/form/csv-import to try it in the browser."
