[CmdletBinding()]
param(
    [string]$DistributionId = "E176M9UAMBHZJM"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "Required command not found: aws"
}

$distributionConfigResponse = aws cloudfront get-distribution-config `
    --id $DistributionId

if ($LASTEXITCODE -ne 0) {
    throw "Failed to fetch CloudFront distribution config for $DistributionId."
}

$distributionConfigObject = $distributionConfigResponse | ConvertFrom-Json
$etag = $distributionConfigObject.ETag
$distributionConfig = $distributionConfigObject.DistributionConfig

if ([string]::IsNullOrWhiteSpace($distributionConfig.WebACLId)) {
    Write-Host "No WAF association found on distribution $DistributionId."
    exit 0
}

$distributionConfig.WebACLId = ""
$configPath = Join-Path (Get-Location) "infra/outputs/cloudfront-without-waf.json"
New-Item -ItemType Directory -Force -Path "infra/outputs" | Out-Null
$distributionConfig | ConvertTo-Json -Depth 100 | Set-Content -Path $configPath -Encoding ascii

aws cloudfront update-distribution `
    --id $DistributionId `
    --if-match $etag `
    --distribution-config "file://$configPath" | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "Failed to remove WAF association from CloudFront."
}

Write-Host "Removed WAF association from distribution $DistributionId."
Write-Host "If you also want to delete the Web ACL, run:"
Write-Host 'aws wafv2 delete-web-acl --name "liberialearn-cloudfront-waf" --scope CLOUDFRONT --region us-east-1 --id "<web-acl-id>" --lock-token "<lock-token>"'
