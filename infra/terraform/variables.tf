variable "aws_region" {
  description = "Primary AWS region for S3, Firehose, and other regional resources."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment label."
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project identifier used in resource naming."
  type        = string
  default     = "liberialearn"
}

variable "static_bucket_name" {
  description = "Existing S3 bucket name serving exports/static content."
  type        = string
  default     = "liberialearn-exports-258048833400"
}

variable "cloudfront_distribution_id" {
  description = "Existing CloudFront distribution ID."
  type        = string
  default     = "E176M9UAMBHZJM"
}

variable "cloudfront_domain_name" {
  description = "Existing CloudFront domain name."
  type        = string
  default     = "d3s42kkog4ti6v.cloudfront.net"
}

variable "cloudfront_comment" {
  description = "Comment currently used on the CloudFront distribution."
  type        = string
  default     = "LiberiaLearn CloudFront Distribution"
}

variable "cloudfront_aliases" {
  description = "Optional alternate domain names for CloudFront."
  type        = list(string)
  default     = []
}

variable "cloudfront_origin_id" {
  description = "Origin identifier used by the live CloudFront distribution."
  type        = string
  default     = "S3Origin"
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_All"
}

variable "default_root_object" {
  description = "Default object served from the static bucket."
  type        = string
  default     = "index.html"
}

variable "origin_access_control_name" {
  description = "Existing Origin Access Control name."
  type        = string
  default     = "liberialearn-oac"
}

variable "origin_access_control_id" {
  description = "Existing Origin Access Control ID used for import documentation."
  type        = string
  default     = "E2NBSIZPE9COJO"
}

variable "web_acl_name" {
  description = "CloudFront Web ACL name."
  type        = string
  default     = "liberialearn-cloudfront-waf"
}

variable "web_acl_id" {
  description = "CloudFront Web ACL ID used for import and ARN construction."
  type        = string
  default     = "30607df0-fbc0-4b96-9469-f8f37fb50002"
}

variable "rate_limit" {
  description = "Requests per 5-minute window per source IP before WAF blocks."
  type        = number
  default     = 2000
}

variable "enable_cloudfront_standard_logging" {
  description = "When true, enable CloudFront standard logging to the dedicated edge log bucket."
  type        = bool
  default     = false
}

variable "enable_waf_logging" {
  description = "When true, enable WAF logging through Kinesis Data Firehose into the dedicated edge log bucket."
  type        = bool
  default     = false
}

variable "edge_log_bucket_name" {
  description = "Optional override for the dedicated edge log bucket. When null, Terraform derives project-account naming."
  type        = string
  default     = null
}

variable "cloudfront_log_prefix" {
  description = "S3 prefix used for CloudFront standard logs."
  type        = string
  default     = "cloudfront/"
}

variable "waf_log_prefix" {
  description = "S3 prefix used for WAF logs written by Firehose."
  type        = string
  default     = "waf/"
}

variable "log_retention_days" {
  description = "Retention period for CloudFront and WAF logs stored in S3."
  type        = number
  default     = 90
}

variable "tags" {
  description = "Additional tags applied to new Terraform-managed resources."
  type        = map(string)
  default = {
    Portfolio = "true"
    Owner     = "Farquema Siryon"
  }
}
