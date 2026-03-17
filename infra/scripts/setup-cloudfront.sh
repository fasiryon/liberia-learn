#!/usr/bin/env bash
set -euo pipefail

ORIGIN_DOMAIN="${CLOUDFRONT_VERCEL_ORIGIN:-liberia-learn.vercel.app}"
DISTRIBUTION_COMMENT="${CLOUDFRONT_COMMENT:-liberialearn-cloudfront}"
OUTPUT_DIR="infra/outputs"
OUTPUT_FILE="${OUTPUT_DIR}/cloudfront.txt"

mkdir -p "$OUTPUT_DIR"

EXISTING_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='${DISTRIBUTION_COMMENT}'].Id | [0]" \
  --output text)"

if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "None" ]; then
  DOMAIN_NAME="$(aws cloudfront get-distribution --id "$EXISTING_ID" --query 'Distribution.DomainName' --output text)"
  printf '%s\n' "$DOMAIN_NAME" > "$OUTPUT_FILE"
  echo "CloudFront distribution exists: $EXISTING_ID ($DOMAIN_NAME)"
  exit 0
fi

CONFIG_FILE="$(mktemp)"
cat > "$CONFIG_FILE" <<EOF
{
  "CallerReference": "${DISTRIBUTION_COMMENT}-$(date +%s)",
  "Comment": "${DISTRIBUTION_COMMENT}",
  "Enabled": true,
  "PriceClass": "PriceClass_100",
  "HttpVersion": "http2",
  "IsIPV6Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "vercel-origin",
        "DomainName": "${ORIGIN_DOMAIN}",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSSLProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
          }
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "vercel-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
      "CachedMethods": {
        "Quantity": 3,
        "Items": ["GET", "HEAD", "OPTIONS"]
      }
    },
    "ForwardedValues": {
      "QueryString": true,
      "Headers": {
        "Quantity": 1,
        "Items": ["Authorization"]
      },
      "Cookies": {
        "Forward": "all"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 0,
    "MaxTTL": 0
  },
  "CacheBehaviors": {
    "Quantity": 3,
    "Items": [
      {
        "PathPattern": "/_next/static/*",
        "TargetOriginId": "vercel-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "AllowedMethods": {
          "Quantity": 3,
          "Items": ["GET", "HEAD", "OPTIONS"],
          "CachedMethods": {
            "Quantity": 3,
            "Items": ["GET", "HEAD", "OPTIONS"]
          }
        },
        "ForwardedValues": {
          "QueryString": false,
          "Cookies": {
            "Forward": "none"
          },
          "Headers": {
            "Quantity": 0
          }
        },
        "MinTTL": 31536000,
        "DefaultTTL": 31536000,
        "MaxTTL": 31536000
      },
      {
        "PathPattern": "/public/*",
        "TargetOriginId": "vercel-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "AllowedMethods": {
          "Quantity": 3,
          "Items": ["GET", "HEAD", "OPTIONS"],
          "CachedMethods": {
            "Quantity": 3,
            "Items": ["GET", "HEAD", "OPTIONS"]
          }
        },
        "ForwardedValues": {
          "QueryString": false,
          "Cookies": {
            "Forward": "none"
          },
          "Headers": {
            "Quantity": 0
          }
        },
        "MinTTL": 0,
        "DefaultTTL": 604800,
        "MaxTTL": 604800
      },
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "vercel-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": true,
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
          "CachedMethods": {
            "Quantity": 3,
            "Items": ["GET", "HEAD", "OPTIONS"]
          }
        },
        "ForwardedValues": {
          "QueryString": true,
          "Headers": {
            "Quantity": 1,
            "Items": ["Authorization"]
          },
          "Cookies": {
            "Forward": "all"
          }
        },
        "MinTTL": 0,
        "DefaultTTL": 0,
        "MaxTTL": 0
      }
    ]
  },
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "Restrictions": {
    "GeoRestriction": {
      "RestrictionType": "none",
      "Quantity": 0
    }
  }
}
EOF

DOMAIN_NAME="$(aws cloudfront create-distribution \
  --distribution-config "file://${CONFIG_FILE}" \
  --query 'Distribution.DomainName' \
  --output text)"

rm -f "$CONFIG_FILE"

printf '%s\n' "$DOMAIN_NAME" > "$OUTPUT_FILE"
echo "Created CloudFront distribution: $DOMAIN_NAME"
