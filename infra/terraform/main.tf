data "aws_caller_identity" "current" {}

data "aws_canonical_user_id" "current" {}

locals {
  static_bucket_arn                = "arn:aws:s3:::${var.static_bucket_name}"
  static_bucket_origin_domain_name = "${var.static_bucket_name}.s3.amazonaws.com"
  cloudfront_distribution_arn      = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${var.cloudfront_distribution_id}"
  waf_web_acl_arn                  = "arn:aws:wafv2:us-east-1:${data.aws_caller_identity.current.account_id}:global/webacl/${var.web_acl_name}/${var.web_acl_id}"
  edge_log_bucket_name             = coalesce(var.edge_log_bucket_name, "${var.project_name}-edge-logs-${data.aws_caller_identity.current.account_id}")
  firehose_stream_name             = "aws-waf-logs-${var.project_name}-${var.environment}"
  logging_resources_enabled        = var.enable_cloudfront_standard_logging || var.enable_waf_logging
  common_tags = merge(
    {
      Name         = var.project_name
      Architecture = "S3 + CloudFront + OAC + WAF"
    },
    var.tags
  )
}

resource "aws_s3_bucket" "static_exports" {
  bucket = var.static_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "static_exports" {
  bucket = aws_s3_bucket.static_exports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_exports" {
  bucket = aws_s3_bucket.static_exports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_exports" {
  bucket = aws_s3_bucket.static_exports.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = aws_s3_bucket.static_exports.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipalReadOnly"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${local.static_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = local.cloudfront_distribution_arn
          }
        }
      }
    ]
  })
}

resource "aws_cloudfront_origin_access_control" "static_bucket" {
  name                              = var.origin_access_control_name
  description                       = "OAC for LiberiaLearn CloudFront to S3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_wafv2_web_acl" "cloudfront" {
  provider    = aws.us_east_1
  name        = var.web_acl_name
  description = "LiberiaLearn CloudFront WAF"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "liberialearn-cloudfront-waf"
    sampled_requests_enabled   = true
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 0

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "liberialearn-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "liberialearn-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAmazonIpReputationList"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "liberialearn-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "${var.project_name}-rate-limit"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = var.rate_limit
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "liberialearn-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudfront_distribution" "static_site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = var.cloudfront_comment
  default_root_object = var.default_root_object
  price_class         = var.price_class
  web_acl_id          = aws_wafv2_web_acl.cloudfront.arn
  aliases             = var.cloudfront_aliases
  http_version        = "http2"
  wait_for_deployment = true

  origin {
    domain_name              = local.static_bucket_origin_domain_name
    origin_id                = var.cloudfront_origin_id
    connection_attempts      = 3
    connection_timeout       = 10
    origin_access_control_id = aws_cloudfront_origin_access_control.static_bucket.id

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id       = var.cloudfront_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  dynamic "logging_config" {
    for_each = var.enable_cloudfront_standard_logging ? [1] : []

    content {
      bucket          = aws_s3_bucket.edge_logs[0].bucket_domain_name
      include_cookies = false
      prefix          = var.cloudfront_log_prefix
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1"
  }

  lifecycle {
    prevent_destroy = true
  }
}
