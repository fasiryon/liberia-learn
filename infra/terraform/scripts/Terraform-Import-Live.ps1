[CmdletBinding()]
param(
    [string]$VarFile = "terraform.tfvars",
    [string]$StaticBucketName = "liberialearn-exports-258048833400",
    [string]$OriginAccessControlId = "E2NBSIZPE9COJO",
    [string]$CloudFrontDistributionId = "E176M9UAMBHZJM",
    [string]$WebAclId = "30607df0-fbc0-4b96-9469-f8f37fb50002",
    [string]$WebAclName = "liberialearn-cloudfront-waf"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$terraformDir = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
    throw "Required command not found: terraform"
}

function Test-StateAddress {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Address
    )

    & terraform state show $Address *> $null
    return $LASTEXITCODE -eq 0
}

function Invoke-TerraformImport {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Address,
        [Parameter(Mandatory = $true)]
        [string]$ImportId
    )

    if (Test-StateAddress -Address $Address) {
        Write-Host "Skipping $Address because it is already present in Terraform state."
        return
    }

    Write-Host "Importing $Address"
    & terraform import "-var-file=$VarFile" $Address $ImportId
    if ($LASTEXITCODE -ne 0) {
        throw "terraform import failed for $Address"
    }
}

Push-Location $terraformDir
try {
    $webAclImportId = "$WebAclId/$WebAclName/CLOUDFRONT"

    Invoke-TerraformImport -Address "aws_s3_bucket.static_exports" -ImportId $StaticBucketName
    Invoke-TerraformImport -Address "aws_s3_bucket_versioning.static_exports" -ImportId $StaticBucketName
    Invoke-TerraformImport -Address "aws_s3_bucket_server_side_encryption_configuration.static_exports" -ImportId $StaticBucketName
    Invoke-TerraformImport -Address "aws_s3_bucket_public_access_block.static_exports" -ImportId $StaticBucketName
    Invoke-TerraformImport -Address "aws_s3_bucket_policy.cloudfront_access" -ImportId $StaticBucketName
    Invoke-TerraformImport -Address "aws_cloudfront_origin_access_control.static_bucket" -ImportId $OriginAccessControlId
    Invoke-TerraformImport -Address "aws_wafv2_web_acl.cloudfront" -ImportId $webAclImportId
    Invoke-TerraformImport -Address "aws_cloudfront_distribution.static_site" -ImportId $CloudFrontDistributionId
}
finally {
    Pop-Location
}
