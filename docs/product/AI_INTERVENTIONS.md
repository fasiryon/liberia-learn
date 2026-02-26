# AI Interventions

## Purpose
AI Interventions generate advisory-only recommendations to help administrators prioritize academic support. Outputs are aggregate-only and never include PII.

## Priority Score (0-100)
The intervention priority score is a composite of mastery, risk, training adoption, and evidence submission:

```
score = (1 - avgMasteryScore) * 40
      + riskWeight(growthRiskFlag) * 30
      + (1 - trainingAdoptionRate) * 20
      + (1 - evidenceSubmissionRate) * 10
```

`riskWeight`:
- none = 0
- low = 0.25
- medium = 0.5
- high = 0.75
- critical = 1.0

Score is clamped to 0-100.

## Deterministic Rules (Phase 1)
| Rule | Outcome |
| --- | --- |
| masteryTrend declining 2+ consecutive months | `growthRiskFlag = "medium"` |
| masteryTrend declining 3+ consecutive months | `growthRiskFlag = "high"` |
| avgMasteryScore < 0.4 | `growthRiskFlag = "critical"` |
| avgMasteryScore < 0.6 | at minimum `growthRiskFlag = "low"` |
| evidenceVelocityTrend declining | add curriculum recommendation |
| trainingAdoptionRate < 0.3 | add training recommendation |
| impactData present + statisticallyMeaningful=false + confidenceLabel="low" | dataConfidence = "low" |

## AI Enhancement (Optional)
When `AI_INTERVENTIONS_AI_ENHANCED=true`, the engine can augment deterministic recommendations using OpenAI. The AI receives aggregated metrics only (no names, IDs, or PII). If any AI call fails, the system silently falls back to deterministic output.

## Advisory-Only Policy
Recommendations are guidance only. They never auto-apply, modify, or mutate data. All decisions remain with human administrators.

## Outcome Tracking
Each recommendation can be logged as an `InterventionLog` record with:
- priority score
- risk flag
- action count
- timestamp
- optional outcome tracking fields

Outcome tracking is fire-and-forget and never blocks the request path.

