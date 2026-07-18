output "static_bucket_name" {
  description = "S3 bucket used for exports and static hosting."
  value       = aws_s3_bucket.static_exports.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.static_site.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN."
  value       = aws_cloudfront_distribution.static_site.arn
}

output "cloudfront_domain_name" {
  description = "Public CloudFront domain."
  value       = aws_cloudfront_distribution.static_site.domain_name
}

output "origin_access_control_id" {
  description = "Origin Access Control ID."
  value       = aws_cloudfront_origin_access_control.static_bucket.id
}

output "waf_web_acl_arn" {
  description = "AWS WAF Web ACL ARN attached to CloudFront."
  value       = aws_wafv2_web_acl.cloudfront.arn
}

output "waf_rate_limit" {
  description = "Configured WAF requests-per-5-minutes threshold."
  value       = var.rate_limit
}

output "edge_log_bucket_name" {
  description = "Dedicated bucket for CloudFront and WAF edge logs."
  value       = try(aws_s3_bucket.edge_logs[0].bucket, null)
}

output "cloudfront_standard_logging_enabled" {
  description = "Whether CloudFront standard logging is enabled by Terraform inputs."
  value       = var.enable_cloudfront_standard_logging
}

output "cloudfront_standard_logging_prefix" {
  description = "Prefix used for CloudFront standard logs when enabled."
  value       = var.enable_cloudfront_standard_logging ? var.cloudfront_log_prefix : null
}

output "waf_logging_destination" {
  description = "Kinesis Data Firehose destination used for WAF logging when enabled."
  value       = try(aws_kinesis_firehose_delivery_stream.waf_logs[0].arn, null)
}
