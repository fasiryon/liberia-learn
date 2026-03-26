data "aws_cloudfront_log_delivery_canonical_user_id" "this" {}

resource "aws_s3_bucket" "edge_logs" {
  count  = local.logging_resources_enabled ? 1 : 0
  bucket = local.edge_log_bucket_name

  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }

  tags = merge(
    local.common_tags,
    {
      Name    = local.edge_log_bucket_name
      Purpose = "CloudFront and WAF edge logs"
    }
  )
}

resource "aws_s3_bucket_server_side_encryption_configuration" "edge_logs" {
  count  = local.logging_resources_enabled ? 1 : 0
  bucket = aws_s3_bucket.edge_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "edge_logs" {
  count  = local.logging_resources_enabled ? 1 : 0
  bucket = aws_s3_bucket.edge_logs[0].id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "edge_logs" {
  count  = local.logging_resources_enabled ? 1 : 0
  bucket = aws_s3_bucket.edge_logs[0].id

  rule {
    # CloudFront standard logging still depends on S3 ACLs.
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "edge_logs" {
  count  = local.logging_resources_enabled ? 1 : 0
  bucket = aws_s3_bucket.edge_logs[0].id

  depends_on = [
    aws_s3_bucket_ownership_controls.edge_logs,
    aws_s3_bucket_public_access_block.edge_logs,
  ]

  access_control_policy {
    owner {
      id = data.aws_canonical_user_id.current.id
    }

    grant {
      permission = "FULL_CONTROL"

      grantee {
        id   = data.aws_canonical_user_id.current.id
        type = "CanonicalUser"
      }
    }

    grant {
      permission = "FULL_CONTROL"

      grantee {
        id   = data.aws_cloudfront_log_delivery_canonical_user_id.this.id
        type = "CanonicalUser"
      }
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "edge_logs" {
  count  = local.logging_resources_enabled ? 1 : 0
  bucket = aws_s3_bucket.edge_logs[0].id

  rule {
    id     = "expire-cloudfront-logs"
    status = "Enabled"

    filter {
      prefix = var.cloudfront_log_prefix
    }

    expiration {
      days = var.log_retention_days
    }
  }

  rule {
    id     = "expire-waf-logs"
    status = "Enabled"

    filter {
      prefix = var.waf_log_prefix
    }

    expiration {
      days = var.log_retention_days
    }
  }
}

resource "aws_iam_role" "waf_log_delivery" {
  count = var.enable_waf_logging ? 1 : 0
  name  = "${var.project_name}-waf-log-delivery-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name    = "${var.project_name}-waf-log-delivery-role"
      Purpose = "Write WAF logs to S3 through Firehose"
    }
  )
}

resource "aws_iam_role_policy" "waf_log_delivery" {
  count = var.enable_waf_logging ? 1 : 0
  name  = "${var.project_name}-waf-log-delivery-policy"
  role  = aws_iam_role.waf_log_delivery[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLogBucketWrites"
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.edge_logs[0].arn,
          "${aws_s3_bucket.edge_logs[0].arn}/*"
        ]
      }
    ]
  })
}

resource "aws_kinesis_firehose_delivery_stream" "waf_logs" {
  count       = var.enable_waf_logging ? 1 : 0
  provider    = aws.us_east_1
  name        = local.firehose_stream_name
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn            = aws_iam_role.waf_log_delivery[0].arn
    bucket_arn          = aws_s3_bucket.edge_logs[0].arn
    prefix              = "${var.waf_log_prefix}!{timestamp:yyyy/MM/dd}/"
    error_output_prefix = "${var.waf_log_prefix}errors/!{firehose:error-output-type}/!{timestamp:yyyy/MM/dd}/"
    buffering_interval  = 300
    buffering_size      = 5
    compression_format  = "GZIP"
  }

  tags = merge(
    local.common_tags,
    {
      Name    = local.firehose_stream_name
      Purpose = "WAF log delivery stream"
    }
  )
}

resource "aws_wafv2_web_acl_logging_configuration" "cloudfront" {
  count    = var.enable_waf_logging ? 1 : 0
  provider = aws.us_east_1

  resource_arn            = aws_wafv2_web_acl.cloudfront.arn
  log_destination_configs = [aws_kinesis_firehose_delivery_stream.waf_logs[0].arn]

  depends_on = [
    aws_kinesis_firehose_delivery_stream.waf_logs,
  ]
}
