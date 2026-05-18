# Liberia Data Engine — Project Overview

**Type:** National infrastructure intelligence platform
**Status:** Identified opportunity — not yet started
**Score:** 9.1/10 strategic fit assessment

## What It Is

The Liberia Data Engine is a national-scale data intelligence platform that sits above LiberiaLearn
and potentially other data sources to provide macro-level insights about Liberia's education system.

Think: national curriculum health trends, district-level performance gaps, predictive models for
resource allocation, and evidence-based policy recommendations — all built on the data LiberiaLearn
is already generating.

## Why It's Strategic

- LiberiaLearn is generating a unique dataset: AI curriculum generation quality, student mastery
  trajectories, delivery compliance, intervention effectiveness — across the entire public school system
- No other platform in Liberia is capturing this data at this level
- The MOE oversight portal is the seed of this product (5 national routes already exist)
- Natural extension of the government SaaS relationship

## Open Questions Before Building

1. **Monetization model:** Is this a separate product or included in the LiberiaLearn contract?
2. **Data acquisition:** What data sources beyond LiberiaLearn? MOE census data? District reports?
3. **GTM:** Who are the pilot users — MOE central, UNICEF, World Bank, bilateral donors?
4. **Privacy:** Can national aggregate data be shared with third parties? Under what framework?
5. **Timeline:** Should this wait until LiberiaLearn has 1+ year of production data?

## What Already Exists (from LiberiaLearn)

- `GET /api/moe/dashboard` — national summary aggregate
- `GET /api/moe/standards-coverage` — coverage by subject
- `GET /api/moe/delivery-compliance` — compliance by district
- `GET /api/moe/curriculum-health` — alignment health
- `GET /api/moe/intervention-impact` — outcome delta by district
- `app/api/admin/national/*` — geo-performance, insights, curriculum-signals
- `LearningEvent` model — immutable append-only canonical event stream
- `MetricEvent` / `SloEvent` models — platform health data

## Next Action
[User to populate — what is the decision gate? What research is needed first?]
Drop a RESEARCH file in QUEUE/ to investigate the GTM landscape.
