#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
WEB_ACL_NAME="${WAF_WEB_ACL_NAME:-liberialearn-waf}"
CLOUDFRONT_COMMENT="${CLOUDFRONT_COMMENT:-liberialearn-cloudfront}"
OUTPUT_DIR="infra/outputs"
OUTPUT_FILE="${OUTPUT_DIR}/waf.txt"

mkdir -p "$OUTPUT_DIR"

WEB_ACL_ARN="$(aws wafv2 list-web-acls \
  --scope CLOUDFRONT \
  --region "$AWS_REGION" \
  --query "WebACLs[?Name=='${WEB_ACL_NAME}'].ARN | [0]" \
  --output text)"

if [ -z "$WEB_ACL_ARN" ] || [ "$WEB_ACL_ARN" = "None" ]; then
  REQUEST_FILE="$(mktemp)"
  cat > "$REQUEST_FILE" <<'EOF'
{
  "Name": "liberialearn-waf",
  "Scope": "CLOUDFRONT",
  "DefaultAction": {
    "Allow": {}
  },
  "VisibilityConfig": {
    "SampledRequestsEnabled": true,
    "CloudWatchMetricsEnabled": true,
    "MetricName": "liberialearn-waf"
  },
  "Rules": [
    {
      "Name": "AWSManagedRulesCommonRuleSet",
      "Priority": 0,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "OverrideAction": {
        "None": {}
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "common-rule-set"
      }
    },
    {
      "Name": "AWSManagedRulesKnownBadInputsRuleSet",
      "Priority": 1,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesKnownBadInputsRuleSet"
        }
      },
      "OverrideAction": {
        "None": {}
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "known-bad-inputs"
      }
    },
    {
      "Name": "AWSManagedRulesBotControlRuleSet",
      "Priority": 2,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesBotControlRuleSet"
        }
      },
      "OverrideAction": {
        "Count": {}
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "bot-control-count"
      }
    },
    {
      "Name": "liberialearn-rate-limit",
      "Priority": 3,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 1000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {
        "Block": {}
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "rate-limit"
      }
    }
  ]
}
EOF

  WEB_ACL_ARN="$(aws wafv2 create-web-acl \
    --region "$AWS_REGION" \
    --cli-input-json "file://${REQUEST_FILE}" \
    --query 'Summary.ARN' \
    --output text)"
  rm -f "$REQUEST_FILE"
  echo "Created WAF Web ACL: $WEB_ACL_NAME"
else
  echo "WAF Web ACL exists: $WEB_ACL_NAME"
fi

DISTRIBUTION_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='${CLOUDFRONT_COMMENT}'].Id | [0]" \
  --output text)"

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
