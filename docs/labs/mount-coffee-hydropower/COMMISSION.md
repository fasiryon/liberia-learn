# Commission: Mount Coffee hydropower lab (hero fixture)

Commissioned by LAB-BUILDER on 2026-09-28 as the Production Team's end-to-end acceptance lab (V1.1 section H).

- **Lab id:** `mount-coffee-hydropower`
- **Status:** FIXTURE. It is not curriculum content: `DRAFT`, no release binding, and every check is RAW_OBSERVATION until governed curriculum review adds authority. It is not student-reachable.
- **Tier:** HERO (the pedagogy director confirms or overrides this with a reason).
- **Subject area:** science, energy transformation and electricity generation. Candidate grades 7–9. The pedagogy director proposes the grade.
- **Experience arc requested:** river/headpond level → water flow → turbine → generator → grid → Monrovia lights. Scenarios: dry season, overload, repair.
- **Learners:** Liberian students, often first-time 3D users on an entry Android phone (TARGET_LOW_DEVICE: Tecno Spark Go 2024), often with no school lab, sometimes offline.

## Verified facts (cite these; do not invent others)

| Fact | Source |
| --- | --- |
| Run-of-river plant on the Saint Paul River, about 30 km northeast of Monrovia. There is no large storage reservoir. | [Wikipedia](https://en.wikipedia.org/wiki/Mount_Coffee_Hydropower_Project), [MHI](https://www.mhi.ca/news-events/news/78) |
| 88 MW maximum, from four 22 MW turbine-generator units, completed 2018 | [MCC](https://www.mcc.gov/blog/entry/blog-072318-success-of-mount-coffee-hydropower-plant-helps-liberia/), [AERA](https://www.aera-group.fr/portfolio/portfolio/mount-coffee-hydropower-plant) |
| Four vertical-shaft Francis turbines. 23.1 m head. Synchronous generators at 142.86 rpm, 108 MVA total. | [Voith](https://www.voith.com/corp-en/about-us/markets-locations/africa/voith-hydro-in-africa/mount-coffee-liberia.html) |
| Dependable dry-season output is only about 10 MW, set by the river's dry-season flow | [Wikipedia](https://en.wikipedia.org/wiki/Mount_Coffee_Hydropower_Project) |
| First commissioned 1966–67 (30–34 MW), expanded to 64 MW by 1973. Destroyed in the civil war and dormant until rehabilitation began in 2012. | Wikipedia, AERA |
| Rainy season is roughly April–October | Voith |
| Still struggles to meet demand in the dry season; expansion planned | [AERA](https://www.aera-group.fr/portfolio/portfolio/mount-coffee-hydropower-plant), [Hydropower & Dams](https://www.hydropower-dams.com/news/hydro-electrical-and-mechanical-contractor-sought-for-mt-coffee-hydropower-plant-extension/) |

Physics that may be used: hydraulic power P = ρ·g·Q·H·η (ρ = 1000 kg/m³, g = 9.81 m/s²). At H = 23.1 m and η ≈ 0.9, 88 MW needs Q ≈ 430 m³/s in total, and 10 MW needs Q ≈ 49 m³/s. Any efficiency or flow figure beyond these must be marked as a model assumption.

## Runtime available

Interactive Lab Runtime V2 plus the high-fidelity layer (`docs/architecture/HIGH_FIDELITY_INTERACTIVE_LABS.md`):

- **Geometry:** procedural sphere, cylinder, cone, box, panel, cube and prism.
- **Structure:** assemblies, exploded views, cutaways (clip plane) and layers.
- **Motion:** variable-driven pose transitions, which interpolate a component's transform with a variable.
- **Behaviour:** bounded variables and a pure `SimulationModel`. Its outputs are quantities, flow active/rate/direction, and component intensity/status.
- **Flows:** `FlowDefinition`, with particles and learner tracing.
- **Camera and guidance:** camera presets and constraints, and guided steps with highlights.
- **Assessment:** direct-manipulation checks: reach-target, trace-path, assemble and identify-component.
- **Profiles:** HIGH, STANDARD, LOW, FALLBACK_2D (SVG) and an offline manifest.

Not available today: continuous motion driven by a simulation quantity (for example, a turbine spinning at a model-set rpm). A need like this goes through a RUNTIME EXTENSION PROPOSAL.
