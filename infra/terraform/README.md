# LiberiaLearn Terraform

This Terraform package is structured for an import-first migration of the existing LiberiaLearn edge stack. The live S3 bucket, CloudFront distribution, Origin Access Control, and CloudFront WAF already exist in AWS, so running `terraform apply` before state import is unsafe because Terraform would attempt to create or replace infrastructure that is already serving production traffic.

## What Terraform manages

Existing live resources managed by import:

- `aws_s3_bucket.static_exports`
- `aws_s3_bucket_versioning.static_exports`
- `aws_s3_bucket_server_side_encryption_configuration.static_exports`
- `aws_s3_bucket_public_access_block.static_exports`
- `aws_s3_bucket_policy.cloudfront_access`
- `aws_cloudfront_origin_access_control.static_bucket`
- `aws_cloudfront_distribution.static_site`
- `aws_wafv2_web_acl.cloudfront`

New resources available for a second rollout phase:

- Dedicated edge log bucket for CloudFront and WAF logs
- CloudFront standard logging to S3
- WAF logging through Kinesis Data Firehose into S3

## Safety model

This configuration is intentionally split into two phases:

1. Import the existing live stack and confirm that Terraform can read it without proposing risky changes.
2. Enable edge logging through variables and review a second plan that creates the new logging resources and updates the imported distribution in place.

Key guardrails:

- `terraform apply` is not part of the initial import workflow.
- The existing S3 bucket, CloudFront distribution, OAC, and WAF use `prevent_destroy = true`.
- Logging is disabled by default so the first post-import plan can be reviewed as a pure reconciliation step.
- The existing exports bucket lifecycle is intentionally not managed yet because changing retention on a live content bucket is riskier than the current scope requires.

## Live values baked into the example inputs

- Static bucket: `liberialearn-exports-258048833400`
- CloudFront distribution ID: `E176M9UAMBHZJM`
- CloudFront domain: `d3s42kkog4ti6v.cloudfront.net`
- Origin Access Control ID: `E2NBSIZPE9COJO`
- WAF Web ACL name: `liberialearn-cloudfront-waf`
- WAF Web ACL ID: `30607df0-fbc0-4b96-9469-f8f37fb50002`

## PowerShell workflow

Run from the repository root:

```powershell
Copy-Item .\infra\terraform\terraform.tfvars.example .\infra\terraform\terraform.tfvars
.\infra\terraform\scripts\Terraform-Init.ps1
.\infra\terraform\scripts\Terraform-Import-Live.ps1
.\infra\terraform\scripts\Terraform-Plan.ps1 -RefreshOnly
.\infra\terraform\scripts\Terraform-Plan.ps1
```

### What each step does

- `Terraform-Init.ps1`: initializes the working directory with `terraform init -input=false`
- `Terraform-Import-Live.ps1`: imports the live S3, OAC, WAF, and CloudFront resources in a safe order
- `Terraform-Plan.ps1 -RefreshOnly`: verifies Terraform can reconcile imported state against live AWS without proposing changes
- `Terraform-Plan.ps1`: shows the full plan based on the current variables

## Exact manual import commands

If you prefer to run imports yourself from `infra/terraform`, these are the exact commands:

```powershell
terraform import -var-file=terraform.tfvars aws_s3_bucket.static_exports liberialearn-exports-258048833400
terraform import -var-file=terraform.tfvars aws_s3_bucket_versioning.static_exports liberialearn-exports-258048833400
terraform import -var-file=terraform.tfvars aws_s3_bucket_server_side_encryption_configuration.static_exports liberialearn-exports-258048833400
terraform import -var-file=terraform.tfvars aws_s3_bucket_public_access_block.static_exports liberialearn-exports-258048833400
terraform import -var-file=terraform.tfvars aws_s3_bucket_policy.cloudfront_access liberialearn-exports-258048833400
terraform import -var-file=terraform.tfvars aws_cloudfront_origin_access_control.static_bucket E2NBSIZPE9COJO
terraform import -var-file=terraform.tfvars aws_wafv2_web_acl.cloudfront 30607df0-fbc0-4b96-9469-f8f37fb50002/liberialearn-cloudfront-waf/CLOUDFRONT
terraform import -var-file=terraform.tfvars aws_cloudfront_distribution.static_site E176M9UAMBHZJM
```

## Why apply is unsafe before import

Before import, Terraform state is empty. The resource blocks in this directory describe real AWS objects that already exist. If you run `terraform apply` at that point, Terraform will treat those objects as missing from state and may attempt to create duplicates or push unreviewed changes into the live CloudFront distribution and WAF. The correct order is always `init -> import -> plan -> review -> apply`.

## What a safe plan should look like after import

With the example `terraform.tfvars` values unchanged and both logging flags still set to `false`:

- `Terraform-Plan.ps1 -RefreshOnly` should complete without proposing changes.
- `Terraform-Plan.ps1` should show either no changes or only drift you explicitly decide to reconcile after comparing Terraform to the live AWS configuration.
- It should not show `create` actions for the existing S3 bucket, CloudFront distribution, OAC, or WAF.

If it does, stop and compare the live AWS configuration before applying anything.

## Enabling logging after the import baseline is clean

Edit `infra/terraform/terraform.tfvars`:

```hcl
enable_cloudfront_standard_logging = true
enable_waf_logging                 = true
```

Then create and review a saved plan:

```powershell
.\infra\terraform\scripts\Terraform-Plan.ps1 -OutFile tfplan
terraform -chdir=.\infra\terraform show tfplan
```

If the plan looks correct, apply the reviewed plan file:

```powershell
.\infra\terraform\scripts\Terraform-Apply.ps1 -PlanFile tfplan
```

## Logging architecture

### CloudFront

- Uses a dedicated S3 bucket separate from the static exports bucket
- Writes standard logs under the `cloudfront/` prefix
- Keeps ACLs enabled only on the log bucket because CloudFront standard logging still requires them

### WAF

- Uses `aws_wafv2_web_acl_logging_configuration`
- Sends logs to a Kinesis Data Firehose delivery stream in `us-east-1`
- Firehose writes compressed objects to the same dedicated log bucket under the `waf/` prefix

This is the supported AWS delivery path for CloudFront-scoped WAF logging. The configuration does not fake direct S3 logging.

## Outputs

Relevant outputs after apply:

- `edge_log_bucket_name`
- `cloudfront_standard_logging_enabled`
- `cloudfront_standard_logging_prefix`
- `waf_logging_destination`

## Reviewer notes

- The Terraform intentionally models only the live resources that can be imported safely from the current evidence in the repository.
- Existing content-bucket lifecycle rules are excluded for now to avoid unintended retention changes on production assets.
- If `terraform plan -refresh-only` still shows drift on CloudFront after import, fetch the latest distribution config from AWS and reconcile any remaining fields before applying in place.
