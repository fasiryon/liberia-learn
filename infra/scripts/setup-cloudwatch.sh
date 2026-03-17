#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
CLUSTER_NAME="${ECS_CLUSTER_NAME:-liberialearn}"
WEB_SERVICE_NAME="${ECS_WEB_SERVICE_NAME:-liberialearn-web}"
WORKER_SERVICE_NAME="${ECS_WORKER_SERVICE_NAME:-liberialearn-worker}"
QUEUE_NAME="${SQS_QUEUE_NAME:-liberialearn-jobs.fifo}"
DLQ_NAME="${SQS_DLQ_NAME:-liberialearn-jobs-dlq.fifo}"
ALB_DIMENSION="${ALB_DIMENSION:-app/liberialearn-placeholder/0000000000000000}"
DASHBOARD_NAME="${CLOUDWATCH_DASHBOARD_NAME:-liberialearn-ops}"
TOPIC_NAME="${SNS_ALERTS_TOPIC_NAME:-liberialearn-alerts}"
ALERT_EMAIL="${SNS_ALERT_EMAIL:-liberialearn52@gmail.com}"

TOPIC_ARN="$(aws sns create-topic --region "$AWS_REGION" --name "$TOPIC_NAME" --query 'TopicArn' --output text)"

SUBSCRIPTION_ARN="$(aws sns list-subscriptions-by-topic \
  --region "$AWS_REGION" \
  --topic-arn "$TOPIC_ARN" \
  --query "Subscriptions[?Endpoint=='${ALERT_EMAIL}'].SubscriptionArn | [0]" \
  --output text)"

if [ -z "$SUBSCRIPTION_ARN" ] || [ "$SUBSCRIPTION_ARN" = "None" ]; then
  aws sns subscribe \
    --region "$AWS_REGION" \
    --topic-arn "$TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$ALERT_EMAIL" >/dev/null
  echo "Created SNS email subscription for $ALERT_EMAIL"
else
  echo "SNS email subscription already exists for $ALERT_EMAIL"
fi

render_template() {
  local template_path="$1"
  local output_path="$2"
  python - "$template_path" "$output_path" <<'PY'
import os
import sys
from string import Template

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    rendered = Template(handle.read()).safe_substitute(os.environ)
with open(sys.argv[2], "w", encoding="utf-8") as handle:
    handle.write(rendered)
PY
}

export AWS_REGION CLUSTER_NAME WEB_SERVICE_NAME WORKER_SERVICE_NAME QUEUE_NAME DLQ_NAME ALB_DIMENSION SNS_TOPIC_ARN="$TOPIC_ARN"

DASHBOARD_RENDERED="$(mktemp)"
render_template "infra/cloudwatch/dashboard.json" "$DASHBOARD_RENDERED"
aws cloudwatch put-dashboard \
  --region "$AWS_REGION" \
  --dashboard-name "$DASHBOARD_NAME" \
  --dashboard-body "file://${DASHBOARD_RENDERED}" >/dev/null
rm -f "$DASHBOARD_RENDERED"
echo "Configured CloudWatch dashboard: $DASHBOARD_NAME"

ALARMS_RENDERED="$(mktemp)"
render_template "infra/cloudwatch/alarms.json" "$ALARMS_RENDERED"
python - "$ALARMS_RENDERED" <<'PY'
import json
import subprocess
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    alarms = json.load(handle)["alarms"]

for alarm in alarms:
    payload_path = f"{sys.argv[1]}.{alarm['AlarmName']}.json"
    with open(payload_path, "w", encoding="utf-8") as handle:
        json.dump(alarm, handle)
    subprocess.run(
        ["aws", "cloudwatch", "put-metric-alarm", "--cli-input-json", f"file://{payload_path}"],
        check=True,
    )
PY
rm -f "$ALARMS_RENDERED" "$ALARMS_RENDERED".*.json 2>/dev/null || true
echo "Configured CloudWatch alarms and SNS topic: $TOPIC_NAME"
