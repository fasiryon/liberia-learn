[CmdletBinding()]
param(
    [string]$WebAclName = "liberialearn-cloudfront-waf",
    [string]$DistributionId = "E176M9UAMBHZJM",
    [string]$Region = "us-east-1",
    [string]$TemplatePath = "infra/waf/web-acl-template.json",
    [string]$OutputDirectory = "infra/outputs"
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

Require-Command -Name "aws"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$templateAbsolutePath = Join-Path (Get-Location) $TemplatePath
if (-not (Test-Path $templateAbsolutePath)) {
    throw "WAF template not found: $templateAbsolutePath"
}

$existingArn = aws wafv2 list-web-acls `
    --scope CLOUDFRONT `
    --region $Region `
    --query "WebACLs[?Name=='$WebAclName'].ARN | [0]" `
    --output text

if ($LASTEXITCODE -ne 0) {
    throw "Failed to list existing Web ACLs."
}

$webAclArn = $existingArn.Trim()

if ([string]::IsNullOrWhiteSpace($webAclArn) -or $webAclArn -eq "None") {
    Write-Host "Creating Web ACL $WebAclName in $Region..."
    $webAclArn = aws wafv2 create-web-acl `
        --region $Region `
        --cli-input-json "file://$templateAbsolutePath" `
        --query "Summary.ARN" `
        --output text

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create Web ACL."
    }

    $webAclArn = $webAclArn.Trim()
}
else {
    Write-Host "Web ACL already exists: $webAclArn"
}

$distributionConfigResponse = aws cloudfront get-distribution-config `
    --id $DistributionId

if ($LASTEXITCODE -ne 0) {
    throw "Failed to fetch CloudFront distribution config for $DistributionId."
}

$distributionConfigObject = $distributionConfigResponse | ConvertFrom-Json
$etag = $distributionConfigObject.ETag
$distributionConfig = $distributionConfigObject.DistributionConfig

if ($distributionConfig.WebACLId -eq $webAclArn) {
    Write-Host "Web ACL is already associated with distribution $DistributionId."
}
else {
    $distributionConfig.WebACLId = $webAclArn
    $configPath = Join-Path (Get-Location) "infra/outputs/cloudfront-with-waf.json"
    $distributionConfig | ConvertTo-Json -Depth 100 | Set-Content -Path $configPath -Encoding ascii

    Write-Host "Associating Web ACL with CloudFront distribution $DistributionId..."
    aws cloudfront update-distribution `
        --id $DistributionId `
        --if-match $etag `
        --distribution-config "file://$configPath" | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to associate Web ACL with distribution."
    }
}

$webAclArn | Set-Content -Path (Join-Path $OutputDirectory "waf-arn.txt") -Encoding ascii
$DistributionId | Set-Content -Path (Join-Path $OutputDirectory "cloudfront-distribution-id.txt") -Encoding ascii

Write-Host "WAF deployment complete."
Write-Host "Web ACL ARN: $webAclArn"
Write-Host "Distribution ID: $DistributionId"
