# Geo Intelligence (Block 19)

## Overview
Geo Intelligence exposes national, county-level performance aggregates to support MOE planning.
The national view is strictly county aggregates only: no school names, IDs, teacher IDs, or student IDs.

## Endpoint
`GET /api/admin/national/geo-performance`

### Auth
Platform admin only (`requirePlatformAdmin`).

### Feature Flag
`ENABLE_GEO_INTELLIGENCE=true` (default OFF). When OFF, the endpoint returns `404`.

### Query Params
- `from=YYYY-MM` (required)
- `to=YYYY-MM` (required)

### Response Shape
```json
{
  "period": { "from": "ISO", "to": "ISO" },
  "counties": [
    {
      "county": "Montserrado",
      "hasData": true,
      "metrics": {
        "masteryAvg": 0.7,
        "growthAvg": 0.15,
        "atRiskPct": 0.5,
        "attendanceProxyAvg": 0.6667
      }
    }
  ],
  "notes": {
    "privacy": "County-level aggregates only. No school, teacher, or student identifiers are returned.",
    "methodology": "masteryAvg and growthAvg are derived from StudentMasteryProfile for the period; atRiskPct is the share of profiles in DECAYING masteryState; attendanceProxyAvg is PRESENT+LATE divided by total attendance records within the period."
  }
}
```

## Privacy Guarantees
- County aggregates only (no school or class breakdowns).
- No identifiers (school, teacher, student) are returned.
- Missing county data returns `null` metrics with `hasData: false`.

## Dashboard Usage
Use this endpoint to drive national heatmaps or MOE planning dashboards.
Do not infer or display school-level performance from this endpoint.
