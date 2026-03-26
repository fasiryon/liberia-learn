# LiberiaLearn WAF

This folder contains AWS CLI-compatible assets for attaching an AWS WAFv2 Web ACL to the live CloudFront distribution `E176M9UAMBHZJM`.

## Rule set

- `AWSManagedRulesCommonRuleSet`: baseline protection for common web exploits and malformed requests.
- `AWSManagedRulesKnownBadInputsRuleSet`: blocks payload patterns typically associated with injection and probing.
- `AWSManagedRulesAmazonIpReputationList`: filters requests from AWS-tracked malicious IP sources.
- `liberialearn-rate-limit`: blocks unusually high request volume per source IP.

## Rate limit choice

The default rate limit is `2000` requests per 5-minute evaluation window per IP. This is a practical starting point for a public static/frontend distribution because:

- it is high enough to avoid penalizing normal browsing bursts, asset fetches, and moderate classroom/shared-network usage;
- it is low enough to blunt trivial scraping and noisy single-IP abuse at the CloudFront edge;
- it is easy to tune later in one place by changing the `Limit` value in [web-acl-template.json](/C:/Users/fasir/liberia-learn/infra/waf/web-acl-template.json).

If you later see legitimate traffic blocked from a school NAT or shared campus network, raise the threshold in controlled increments such as `3000` or `5000`.

## Notes

- CloudFront-scoped WAF must be created with AWS CLI region `us-east-1`.
- Association is handled by a dedicated script after the Web ACL exists.
- The scripts write deployment metadata into `infra/outputs/` for easy reuse.
