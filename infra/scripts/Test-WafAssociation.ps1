[CmdletBinding()]
param(
    [string]$DistributionId = "E176M9UAMBHZJM",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "Required command not found: aws"
}

$distribution = aws cloudfront get-distribution `
    --id $DistributionId `
    --query "Distribution.{Id:Id,DomainName:DomainName,Status:Status,WebACLId:DistributionConfig.WebACLId}" `
    --output json

if ($LASTEXITCODE -ne 0) {
    throw "Failed to inspect CloudFront distribution."
}

$distributionObject = $distribution | ConvertFrom-Json
$webAclArn = $distributionObject.WebACLId

Write-Host "Distribution ID: $($distributionObject.Id)"
Write-Host "CloudFront Domain: $($distributionObject.DomainName)"
Write-Host "Status: $($distributionObject.Status)"
Write-Host "Attached Web ACL ARN: $webAclArn"

if ([string]::IsNullOrWhiteSpace($webAclArn)) {
    throw "No Web ACL is attached to distribution $DistributionId."
}

$webAcl = aws wafv2 get-web-acl-for-resource `
    --region $Region `
    --resource-arn "arn:aws:cloudfront::$(aws sts get-caller-identity --query Account --output text):distribution/$DistributionId" `
    --output json

if ($LASTEXITCODE -ne 0) {
    throw "CloudFront distribution reports a Web ACL, but WAF lookup failed."
}

$webAcl | Write-Output
