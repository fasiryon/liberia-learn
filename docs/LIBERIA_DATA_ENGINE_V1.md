# Liberia Data Engine — v1 Discovery Document

## 1. What It Is

National infrastructure intelligence platform aggregating geospatial, workforce, cost, and
operational data across Liberia. Separate product from LiberiaLearn but shares the MOE
relationship as a distribution wedge. LiberiaLearn's school dataset becomes the anchor for
the first phase.

## 2. Architecture (decided)

- **Hybrid RAG**: batch/governance workflows (regular RAG) + live queries (streaming RAG)
- **Retrieve-first rule**: no generation without retrieval — every answer cites a source record
- **Stack**: Next.js, Prisma, pgvector, Supabase, AWS

## 3. Monetization Model

Three tiers:

| Tier | Customer | Pricing |
|------|----------|---------|
| Government | MOE, MOPW | Annual flat fee — national dashboard + API access |
| NGO / Donor | INGOs, UN agencies | Per-project data access + report generation |
| Private sector | Consulting firms, contractors | Infrastructure cost benchmarks, labor market data — usage-based |

**Anchor ask**: $18K–$36K/year MOE contract funds v1 operation and covers infrastructure costs.

## 4. Data Acquisition Commitment Plan

Priority datasets and acquisition strategy:

| Dataset | Source | Strategy |
|---------|--------|----------|
| School locations + enrollment | MOE | Existing relationship — LiberiaLearn pilot gives automatic access |
| Road network + condition | MOPW | MOE pilot as proof point for MOPW conversation |
| Clinic/hospital locations | MOH | Public GIS layer + MOH partnership |
| County-level employment data | Ministry of Labor | Public statistics + MOU |
| Infrastructure datasets | World Bank Liberia | Public — already downloadable |

**Sequencing**: School data first (free via MOE pilot). Use that live dashboard to demonstrate
value to MOPW. MOPW road data unlocks the private sector tier.

## 5. Pilot Strategy

| Phase | Timeline | Scope |
|-------|----------|-------|
| Phase 1 | Months 1–3 | MOE school infrastructure layer — 1,500 school locations, enrollment, teacher counts. Powered by LiberiaLearn's existing data. |
| Phase 2 | Months 4–6 | Add road network + clinic overlay. First NGO/donor pilot users. |
| Phase 3 | Months 7–12 | Full national dashboard. Donor reporting module. Private sector data products. |

## 6. Next Actions

- [ ] Confirm MOE data sharing MOU language during LiberiaLearn pilot onboarding
- [ ] Schedule MOPW introductory meeting (Q3 2026)
- [ ] Register `liberiadataengine.org` or `.com` domain
- [ ] Draft one-pager for World Bank Liberia country office
- [ ] Identify 2 NGO pilot partners from LiberiaLearn's existing network
