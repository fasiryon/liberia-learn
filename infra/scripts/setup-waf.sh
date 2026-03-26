#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
WEB_ACL_NAME="${WAF_WEB_ACL_NAME:-liberialearn-cloudfront-waf}"
DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E176M9UAMBHZJM}"
TEMPLATE_FILE="${WAF_TEMPLATE_FILE:-infra/waf/web-acl-template.json}"
OUTPUT_DIR="infra/outputs"
OUTPUT_FILE="${OUTPUT_DIR}/waf-arn.txt"

mkdir -p "$OUTPUT_DIR"

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "WAF template not found: $TEMPLATE_FILE" >&2
  exit 1
fi

WEB_ACL_ARN="$(aws wafv2 list-web-acls \
  --scope CLOUDFRONT \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEB_ACL_NAME}'].ARN | [0]" \
  --output text)"

if [ -z "$WEB_ACL_ARN" ] || [ "$WEB_ACL_ARN" = "None" ]; then
  WEB_ACL_ARN="$(aws wafv2 create-web-acl \
    --region "$AWS_REGION" \
    --cli-input-json "file://${TEMPLATE_FILE}" \
    --query 'Summary.ARN' \
    --output text)"
  echo "Created WAF Web ACL: $WEB_ACL_NAME"
else
  echo "WAF Web ACL exists: $WEB_ACL_NAME"
fi

if [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  ETAG="$(aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --query 'ETag' --output text)"
  CONFIG_FILE="$(mktemp)"
  aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --query 'DistributionConfig' > "$CONFIG_FILE"
  python - "$CONFIG_FILE" "$WEB_ACL_ARN" <<'PY'
import json
import sys

config_path = sys.argv[1]
web_acl_arn = sys.argv[2]
with open(config_path, "r", encoding="utf-8") as handle:
    config = json.load(handle)
config["WebACLId"] = web_acl_arn
with open(config_path, "w", encoding="utf-8") as handle:
    json.dump(config, handle)
PY

  aws cloudfront update-distribution \
    --id "$DISTRIBUTION_ID" \
    --if-match "$ETAG" \
    --distribution-config "file://${CONFIG_FILE}" >/dev/null
  rm -f "$CONFIG_FILE"
  echo "Associated WAF with CloudFront distribution: $DISTRIBUTION_ID"
else
  echo "CloudFront distribution not found; skipped WAF association."
fi

printf '%s\n' "$WEB_ACL_ARN" > "$OUTPUT_FILE"
echo "Saved WAF ARN to $OUTPUT_FILE"
