# Pedagogy brief: `mount-coffee-hydropower` (HERO fixture)

Author: `lab-pedagogy-director`, 2026-09-28. Recorded verbatim in substance by LAB-BUILDER. The builder verified the curriculum-source claims: `curriculum/sources/intermediate/GRADE-7-9.json` contains "ENERGY AND SIMPLE MACHINES", the energy-transformation flow-chart objective, and "Motor and Dynamo".

**Status:** FIXTURE, `DRAFT`, no release binding. The objective is **PROPOSED — NOT GOVERNED**. Every check stays RAW_OBSERVATION until governed curriculum review adds authority.

**Proposed grade:** Grade 8. Extension lines appear only from Grade 9 (`minGrade: 9`).

**Likely alignment (source text only, not governed):** `curriculum/sources/intermediate/GRADE-7-9.json`

- Grade 8, Semester 1, Period III, "Energy and Simple Machines": potential vs kinetic energy; forms of energy; "illustrate with flow charts ... energy transformations".
- Grade 9, Semester 2, Period V, "Magnetism and Electricity": "Motor and Dynamo"; fuses and circuit breakers.

## LEARNING GOAL
(`PROPOSED — NOT GOVERNED`, working id `fixture-hydro-energy-chain`.) The learner explains how Mount Coffee turns the energy of falling Saint Paul River water into light in Monrovia homes. They also explain why the river's flow, not a stored lake, limits how much electricity the plant can make.

## WHAT STUDENT SHOULD UNDERSTAND
The whole idea is one chain, driven by flow.

The dam holds the river up about 23.1 m. As the water falls, gravitational potential energy becomes kinetic energy. The moving water turns the turbine (rotational kinetic energy on the shared shaft). The generator changes that into electrical energy. Wires carry it to Monrovia, where bulbs turn it into light, and some heat.

- At each step some energy becomes heat and sound; none is destroyed.
- The water is not used up. It carries on down the river.
- Mount Coffee is **run-of-river**. There is no big lake saving water, so power follows how much water flows past each second.
  - In the rainy season (about April to October) the river can drive all four units, up to 88 MW.
  - In the dry season it gives only about 10 MW.
- A turbine the river cannot feed makes nothing.
- When the city asks for more than the river can supply, the grid cannot "stretch". Protection disconnects the supply, or operators switch some areas off so the rest stay on.

## WHY SIMULATION HELPS
A picture of a dam invites the false "big lake" model, and none of this can be tried at the real site. In the lab the learner can:

- change the season and see output fall to about 10 MW while the dam still looks full;
- turn on all four units in the dry season and get nothing extra;
- overload the grid and watch protection trip;
- repair a unit and see that capacity comes back only when the river can feed it.

These are cause-and-effect results that a picture, video or worked example cannot show. Testing a wrong prediction is the reason to build the lab.

## WHAT MUST REMAIN PHYSICAL/PRACTICAL
Nothing about the plant itself can be handled. The objective's practical parts are energy transformation and the dynamo idea, taught in this sequence:

1. **VIRTUAL PREPARATION:** this lab in guided mode.
2. **PHYSICAL PRACTICAL WHEN AVAILABLE:**
   - Pour water onto a bottle-and-caps water wheel. Use the same cup from a low height and from a high one, then a thin stream against a full stream.
   - Turn a bicycle dynamo by hand to light its lamp, and feel it get harder to turn as it lights.
   - Draw the energy flow chart.
3. **VIRTUAL REINFORCEMENT:** explore mode and the challenge.

The lab states its own limits on screen: "In class you would also pour the water yourself and feel the dynamo push back when the lamp lights. Never go near a real dam, spillway, intake or power line. The water and electricity there can kill."

## MISCONCEPTIONS (each with the scene state that exposes it)
1. **"A dam stores a big lake for the dry season."** In the dry season the headpond stays at its operating level, yet output is only about 10 MW. The explanation says the level is steady but little water arrives each second.
2. **"Adding turbines always gives more power."** In the dry season with all four units on, there is water for only about one unit. The other units are idle and show no water particles.
3. **"More water makes the turbine spin faster."** The units are synchronous at 142.86 rpm, so speed status is the same at any power. More flow shows as more **power**: the output meter and the particle rate on the lines.
4. **"The plant uses up the water."** The water trace continues through the tailrace back into the river.
5. **"Electricity is stored in the dam or the wires."** At zero flow the lines go dark at once.
6. **"More rain always means more power."** When peak rainy-season flow is above turbine capacity (about 430 m³/s), the extra water goes over the spillway and output stays capped at 88 MW.
7. **"On overload everyone just gets dimmer lights."** If demand exceeds supply and no load is shed, protection trips and the whole grid goes dark. It does not dim evenly.

## GUIDED EXPERIENCE
1. **Meet the plant.** Overview of river, dam, spillway, powerhouse, lines and city. The learner sees that this is a real Liberian plant about 30 km from Monrovia.
2. **Trace the water.** Headpond → intake → penstock → turbine → tailrace → river. The water passes through; it is not used up.
3. **Cut away the powerhouse.** Runner, shaft and generator sit on one vertical shaft. Falling water turns the runner, and the same shaft turns the generator.
4. **Rainy season.** Four units on, output 88 MW, city lit. Plenty of flow gives full power.
5. **Dry season.** Output falls to about 10 MW while the headpond looks the same. The limit is flow, not a stored lake.
6. **Overload.** Keep demand high and protection trips. Shed feeders and reclose. Supply must match demand.
7. **Name the chain.** Ordered explanation lines: potential → kinetic → rotation → electrical → light.

## EXPLORE EXPERIENCE
Free controls: river flow (season steps), units online (0–4), city demand (feeders on/off), cutaway, exploded unit, water and power traces, and camera presets.

Explore is for testing predictions ("what if I turn on all four in March?"), not for touring scenery. Camera presets stay constrained, with no free fly-through.

## CHALLENGE
**"Dry season, evening peak."** Flow is locked at the dry-season value and demand exceeds supply.

- **Goal:** a stable grid (not tripped) with the priority feeder lit. The priority feeder is a hospital, a generic fictional label.
- **Intuitive moves that fail:** all units on, or waiting for the dam to "fill". Only shedding non-priority feeders until demand ≤ supply works.
- **Model support:** a composite quantity (e.g. `gridStableWithPriority`) lets a single `reach-target` test it.
- **Round 2 must verify** that blind toggling cannot pass it faster than reasoning.

## DIRECT-MANIPULATION ASSESSMENT
1. **`trace-path` water-path** (headpond → tailrace/river). Nodes are listed alphabetically. Proves the learner knows the water passes through and returns to the river.
2. **`identify-component` generator**, reachable only through the cutaway. Proves the learner can tell turbine from generator in the chain.
3. **`reach-target` dry-season-output**, about 10 MW (band 8–12). Proves the learner links flow to power.
4. **`reach-target` dry-season-peak** (the challenge). Proves the learner understands supply against demand and load shedding.
5. **`assemble` repair-unit.** Rebuild the faulted unit in order: runner below, shaft, rotor above. Output returns only if the flow can feed it. Proves the learner understands how the unit is coupled: repair adds capacity, not water.

## EVIDENCE BOUNDARY
All five checks produce governed-evidence envelopes, but they stay **RAW_OBSERVATION**: there is no release binding and no authority mapping.

- After governed review, checks 1–3 are candidates for the Grade 8 energy-transformation objective.
- Checks 4–5 are candidates for the Grade 9 circuit-breaker and dynamo content.
- Sliders, season changes, cutaways, traces outside a check and camera moves are observation or ignored, never evidence.

## TIER
**HERO (confirmed):**

- It is the team's end-to-end acceptance lab.
- It is the first Liberia-specific, place-based lab and the pattern for later energy labs.
- It has several scenarios and a high risk of teaching a false model.

## REJECTED IDEAS
- **A "reservoir level" slider as the main control.** It teaches the storage-lake model. The headpond is shown steady, and flow is the input. This overrides the commission's "reservoir level" framing.
- **Turbine speed that follows flow.** This is false for synchronous units. Speed is shown as on/stopped only. Any spinning cue must be constant speed, via a RUNTIME EXTENSION PROPOSAL.
- **Realistic fluid simulation or photoreal terrain.** It costs budget on low-end phones and teaches nothing new.
- **Even dimming of the city on overload.** This is misconception 7.
- **A civil-war destruction sequence.** It is sensitive and off-objective, so the history gets one factual context line.
- **Economics, or placing your own dam.** Off-objective.
- **Multiple-choice quiz beside the model.** It does not count as assessment under this standard.
- **Real Monrovia demand figures or named districts and utilities.** These are unverified. Demand, feeders, the ~107 m³/s per unit and the band edges are all labelled as model assumptions.

**Grade-language notes:** use short sentences. "Current is off" is everyday usage; bridge from it to "electricity supply", and have a local reviewer confirm. Show P = ρ·g·Q·H·η only from `minGrade: 9`. At Grade 8, say "more water each second, or a higher drop, gives more power".
