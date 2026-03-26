provider "aws" {
  region = var.aws_region
}

# CloudFront-scoped WAF resources and WAF log delivery must be managed through us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
