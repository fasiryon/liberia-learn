# Programme batch academic review

Original factory DRAFTs. No academic approval, official assessment, publication or student activation is claimed.

## STEM Design: compare two flashlight switches

4.0.0-schoolday-primary-engineering.2-draft.1 | GO-G04-P6-ENGINEERING-U1 | 202106a8bffa0afb8c05aa9338db458b5b913483f70a222c2bc1b8a579b7a7a1

```json

{
  "version": "program-academic-review/1.0.0",
  "state": "DRAFT",
  "authorship": "AI_AUTHORED_DETERMINISTIC_FACTORY_RECIPE",
  "humanSubjectExpertReview": "NOT_PERFORMED",
  "academicApproval": "PENDING_EXACT_VERSION_REVIEW",
  "programOrderId": "GO-G04-P6-ENGINEERING-U1",
  "courseId": "stem1-g4-engineering",
  "unit": 1,
  "sourceOrder": {
    "planId": "stem1-g4-day1",
    "slot": "P6",
    "grade": 4,
    "orderId": "GO-G04-P6-ENGINEERING-U1",
    "owner": "T2_CODEX",
    "kind": "LESSON",
    "batch": "BAND_3-5",
    "courseId": "stem1-g4-engineering",
    "unit": 1,
    "unitTitle": "Flashlight circuit",
    "performanceTask": "design and build a working flashlight with a switch",
    "family": "ENGINEERING",
    "pattern": [
      "DEFINE",
      "RESEARCH_CONSTRAINTS",
      "DESIGN",
      "BUILD_OR_MODEL",
      "TEST",
      "REFINE",
      "COMMUNICATE"
    ],
    "recordedSubject": "ENGINEERING_FOUNDATIONS",
    "developmental": {
      "band": "3-5",
      "approach": "Conceptual foundations, guided investigations and foundational computing",
      "maxSegmentMinutes": 15,
      "maxScreenMinutesPerPeriod": 25,
      "readAloudRequired": false,
      "independentWritingWords": [
        20,
        80
      ],
      "requiresMovementSegment": false
    },
    "competencies": {
      "medium": "DESIGN_CYCLE_WITH_MEASUREMENT",
      "learnerDoes": [
        "State criteria and constraints before building",
        "Make two designs",
        "Run a fair test and record measurements",
        "Improve the design using the data"
      ],
      "evidence": [
        "Criteria and constraints",
        "A measurement table",
        "A data-based improvement"
      ],
      "blocks": {
        "now": [
          "DATA_PLOT",
          "NUMERIC_RESPONSE",
          "WRITING_ORGANIZER",
          "SHAPE_MODEL"
        ],
        "needed": [
          "DESIGN_CYCLE",
          "MEASUREMENT_TABLE"
        ]
      }
    },
    "blocks": {
      "existing": [
        "SHAPE_MODEL",
        "DATA_PLOT"
      ],
      "proposed": [
        "DESIGN_CYCLE",
        "MEASUREMENT_TABLE"
      ]
    },
    "labs": [],
    "stemPractices": [
      "ENGINEERING_DESIGN",
      "MATHEMATICAL_REASONING",
      "SCIENTIFIC_EVIDENCE",
      "LIBERIAN_APPLICATION",
      "PRACTICE_CONTINUUM"
    ],
    "requirements": [
      "Two or three measurable objectives derived from the performance task; MOE mapping recorded as PROPOSED, never claimed",
      "At least two distinct, named misconceptions, each taught against and diagnosed by a block",
      "Hints in every guided scene; no hints or worked steps in independent scenes",
      "Choice items with three or more plausible options, or richer interactions",
      "No system, policy or answer-policy text in learner-visible fields; no generator prefixes; UTF-8 text with no mojibake",
      "Specific learner actions in every scene",
      "Guided practice, independent work, extension and reflection, in that order",
      "An authentic Liberian situation that needs the concept, not a name swap",
      "Formative only: no grade, mastery or assessment keys in the learner projection"
    ],
    "gates": [
      "G1",
      "G2",
      "G3",
      "G4",
      "G5",
      "G6",
      "G7",
      "G8"
    ],
    "status": "OPEN"
  },
  "objectives": [
    {
      "id": "g4-engineering-compare-flashlight-switches-o1",
      "statement": "Explain how a complete conducting path and an open switch affect a compatible battery and lamp circuit.",
      "moeReferences": []
    },
    {
      "id": "g4-engineering-compare-flashlight-switches-o2",
      "statement": "Plan a fair comparison of two contact designs, record honestly attributed observations and explain a controlled revision.",
      "moeReferences": []
    },
    {
      "id": "g4-engineering-compare-flashlight-switches-o3",
      "statement": "Draw a two-bar graph from available closed-switch counts and justify a design choice using both closed and open observations.",
      "moeReferences": []
    }
  ],
  "misconceptions": [
    {
      "id": "switch-creates-energy",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o1",
      "description": "The switch creates the energy that lights the lamp.",
      "response": "The battery supplies energy. Closing the switch completes a conducting path; the switch does not create energy."
    },
    {
      "id": "one-pass-proves-reliability",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o2",
      "description": "One successful test proves the switch always works.",
      "response": "Record every trial, including failures. Five trials support a limited comparison, not a guarantee."
    },
    {
      "id": "change-everything-is-fair",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o2",
      "description": "Changing several components establishes which single change caused an outcome.",
      "response": "Change one contact feature while keeping battery, bulb, wires and procedure fixed."
    },
    {
      "id": "tallest-bar-proves-best",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o3",
      "description": "The taller closed-switch bar proves the best design without checking open-switch control.",
      "response": "Use both closed-light and open-dark observations, and acknowledge the limits of the tests."
    }
  ],
  "answerGuidance": {
    "circuit": "A closed conducting path connects the battery and compatible lamp; opening the switch breaks the path. The switch does not create energy.",
    "fairTest": "Change one contact feature; keep battery, lamp, wires and procedure fixed. Distinguish an observation from a prediction. Record all actual outcomes, including failures.",
    "designComparison": "Use all five closed and five open trials per design. Accept unchanged or worse second-design results when interpreted honestly. Five trials do not prove unlimited reliability.",
    "graph": "Paper bars are labelled Design 1 and Design 2, with closed-light successes out of five, baseline zero and scale to five. Inspect open-dark counts separately before recommending.",
    "provenance": "Physical/group observations are MEASURED. Approved provided observations are SUPPLIED, not the learner's own tests. No dataset is present. SIMULATED remains unavailable pending scientific/model approval.",
    "access": "Without observed group trials or reviewed provided data, sketches and test plans are partial work. Never enter invented counts, zeros or a false claim of completed physical testing."
  },
  "teacherGuide": {
    "classification": "Grade 4 applied STEM learning component. Primary standard: Engineering Design. Formal classification is provisional until standards mapping is completed. No official Ministry subject claim.",
    "paperReasoning": "Sketch and explain the complete/open circuit. From Design 1 observations, propose one controlled change before seeing Design 2 observations. Analyze both rows, draw the graph, justify a choice and identify a further test.",
    "providedData": "Use a separate MEASUREMENT_TABLE with origin ILLUSTRATIVE and originNote: Provided by the lesson. These are not your measurements. Label SUPPLIED and record empirical adult/teacher source (who, when, kit) or constructed status, protocol and dataset hash. CoS independently reviews the dataset before use. No dataset is supplied by this input revision.",
    "virtualData": "Only CoS-approved scientific model/version and contract-permitted use. Label SIMULATED in scene text and originNote, identify model limits, and never call it physical contact-reliability evidence. Provided virtual results follow the separately reviewed SUPPLIED dataset route.",
    "routeHonesty": "Use the completion label analysed provided observations for the provided-data route; do not mark tested two designs fulfilled. A group observer says observed my group's test, not I built and measured. Both routes use the same reasoning rubric without penalizing access to equipment.",
    "noEvidence": "If neither reviewed data nor observed group trials are available, offer sketch and test-plan only. Keep counts missing and the comparison incomplete; never invent counts or substitute zero.",
    "sharedKits": "Use 3–5 learners per teacher-checked kit; rotate planner/explainer, supervised builder, observer/counter, recorder and evidence-checker. Combine roles for smaller groups and obtain each learner's reasoning. Adults make safety decisions.",
    "assessment": "Reasoning-only formative evidence; no official grades, records or persistent mastery. Separate governed assessment remains a release dependency.",
    "safety": "Teacher checks enclosed low-voltage batteries and a compatible bulb. No mains, loose button cells, damaged cells, direct shorts or hot wires. Stop if parts warm. Adults handle cutting and real safety decisions.",
    "criteria": [
      {
        "id": "closed-light",
        "comparison": "AT_LEAST",
        "target": 4,
        "unit": "trials"
      },
      {
        "id": "open-dark",
        "comparison": "AT_LEAST",
        "target": 5,
        "unit": "trials"
      }
    ],
    "fairTest": "Change one contact feature while holding battery, bulb, wires and test procedure fixed. State what you changed, why the first results motivated it and how the second test informs the decision.",
    "continuousActivity": "DESIGN_CYCLE and linked MEASUREMENT_TABLE remain in the same scene and ActivityScope for both attempts. Copy observations/source labels to paper before leaving. The graph is drawn on paper, not a GRAPH_BUILDER block.",
    "recording": "Use one row per design and track every closed/open trial separately on paper before recording counts. Record integers 0–5, with missing counts left missing. The design identifiers are fixed row headers, never measurements.",
    "graphTask": {
      "mode": "HAND_DRAWN_STRUCTURED_RESPONSE_NOT_GRAPH_BUILDER",
      "sourceTableId": "switch-trials",
      "sourceValueColumn": "closed-lit",
      "fixedLabels": [
        "Design 1",
        "Design 2"
      ],
      "valueLabel": "Successful closed-switch trials out of 5",
      "minimum": 0,
      "maximum": 5,
      "integerTicks": true,
      "instructions": "Draw two bars on paper or squared paper: Design 1 and Design 2 across the bottom; successful closed-switch trials from 0 to 5 up the side. Copy each height from the matching row, then compare both open-switch counts in the table before choosing.",
      "responseFields": [
        "evidence class and source reference",
        "Design 1 bar height from row 1",
        "Design 2 bar height from row 2",
        "CALCULATED difference between the two counts",
        "INFERRED comparison and choice, checking open-switch counts too"
      ],
      "teacherCheck": "Check both bar heights and fixed labels against the selected source table, a zero baseline and scale to 5. A missing observation is not zero; the comparison stays incomplete.",
      "provenance": "Label the graph MEASURED when based on actual learner/group observations; SUPPLIED when using reviewed provided data; SIMULATED when based on approved model trials. Graphing does not change the source class."
    },
    "review": "Check both attempts, the changed contact feature, controls, both table rows, graph heights, open-dark results and justified choice. Read the pupil's individual explanation, not merely a group answer.",
    "secondDesignFeedback": "Judge Design 2 on its own results; compare with Design 1. Do not presume that a revision improves performance. Do not grade equipment performance.",
    "completionLabels": {
      "physical": "performed two design tests",
      "group": "observed my group's test",
      "provided": "analysed provided observations",
      "noData": "sketch and test-plan only; comparison incomplete"
    },
    "providedDataStatus": "NONE_INCLUDED. Separate dataset/source/hash review and separately labelled ILLUSTRATIVE table required before use. Do not auto-fill the learner-measured table.",
    "simulatedRoute": "UNAVAILABLE until circuit-lab scientific validation and CoS model-version approval.",
    "duration": "45 minutes is a proposed allocation, not a measured classroom rehearsal. Use shared kits and teacher-managed turns; do not rush safety or fabricate missing results.",
    "retention": "After seven days retrieve the complete/open-path explanation and propose a controlled comparison without reopening worked support. No scheduler is activated.",
    "learnerPaperRecord": {
      "instructions": "Use these labels on your paper record. Record only available observations. Row 1 is Design 1; Row 2 is Design 2. Keep both original rows and your graph.",
      "evidence": "counted (MEASURED): actual counts you observed or your group observed; name the observer/group. given to us (SUPPLIED): independently reviewed provided observations; identify the source. Never call supplied observations your own measurements.",
      "design1": "Source label and reference: ____ . Closed-light successes out of five: ____ . Open-dark successes out of five: ____ .",
      "revision": "Contact feature changed: ____ . My reason from Design 1 observations: ____ . Kit and procedure kept fixed: ____ .",
      "design2": "Source label and reference: ____ . Closed-light successes out of five: ____ . Open-dark successes out of five: ____ .",
      "graph": "Draw the two bars from the closed-light counts. Label Design 1 and Design 2. Start the scale at zero and end at five. Check the open-dark counts before choosing.",
      "calculation": "worked out (CALCULATED): difference between the two bar heights: ____ . Show how you worked it out.",
      "inference": "my conclusion (INFERRED): my choice or next change: ____ . Numerical reason using both designs and both criteria: ____ . Limitation or further test: ____ ."
    }
  },
  "references": [
    {
      "title": "Original LiberiaLearn two-switch design task",
      "use": "Original activity and feedback. Revised six-field inputs independently authorized by CoS; exact candidate academic review remains pending.",
      "rights": "Internal draft; standards mapping and release review pending."
    }
  ],
  "assessment": {
    "governedFormSupplied": false,
    "protectedKeysIncluded": false,
    "officialRecordWrites": false,
    "teacherReviewRequired": true
  },
  "remainingGates": [
    "COS_G3_AND_INDEPENDENT_ACADEMIC_REVIEW",
    "LIBERIA_STANDARDS_MAPPING",
    "RIGHTS_REVIEW",
    "BROWSER_ACCESSIBILITY_AND_OFFLINE_QA",
    "TIMED_REHEARSAL",
    "EXACT_VERSION_AUTHORIZATION"
  ]
}


```

```json

{
  "contractVersion": "candidate-lesson-v2/1.1.0",
  "title": "STEM Design: compare two flashlight switches",
  "instruction": {
    "standard": "liberialearn-v4-instruction/1.1.0",
    "retention": {
      "delayDays": 7,
      "prompts": [
        "Without the worked example, explain: Explain how a complete conducting path and an open switch affect a compatible battery and lamp circuit.",
        "Without the worked example, explain: Plan a fair comparison of two contact designs, record honestly attributed observations and explain a controlled revision."
      ]
    }
  },
  "estimatedMinutes": 45,
  "ageBand": "UPPER_PRIMARY",
  "pedagogy": {
    "primaryStrategy": "GUIDED_TO_INDEPENDENT",
    "rationale": "Explain the circuit, plan two designs, observe honestly, revise one contact feature and make a numerical comparison. Reasoning and evidence are assessed; physical success is not a grade."
  },
  "prerequisiteAssumptions": [
    "Count whole numbers from zero to five and compare two counts.",
    "Use labelled sketches and explain an idea orally or with a scribe."
  ],
  "misconceptions": [
    {
      "id": "switch-creates-energy",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o1",
      "description": "The switch creates the energy that lights the lamp.",
      "response": "The battery supplies energy. Closing the switch completes a conducting path; the switch does not create energy."
    },
    {
      "id": "one-pass-proves-reliability",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o2",
      "description": "One successful test proves the switch always works.",
      "response": "Record every trial, including failures. Five trials support a limited comparison, not a guarantee."
    },
    {
      "id": "change-everything-is-fair",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o2",
      "description": "Changing several components establishes which single change caused an outcome.",
      "response": "Change one contact feature while keeping battery, bulb, wires and procedure fixed."
    },
    {
      "id": "tallest-bar-proves-best",
      "objectiveId": "g4-engineering-compare-flashlight-switches-o3",
      "description": "The taller closed-switch bar proves the best design without checking open-switch control.",
      "response": "Use both closed-light and open-dark observations, and acknowledge the limits of the tests."
    }
  ],
  "scenes": [
    {
      "id": "define",
      "type": "PRACTICE",
      "title": "A light we can control",
      "purpose": "EXPLAIN_CONCEPT",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "Sketch a complete path and explain how opening the switch changes it.",
      "content": {
        "body": "Our design challenge is a small flashlight switch. The battery, compatible lamp and conducting wires must form a complete path for the lamp to light. An open switch breaks that path. The battery supplies energy; the switch controls the connection. Engineering Design here is a LiberiaLearn STEM activity, not an official Ministry subject claim."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "define-response-0",
            "prompt": "Draw or describe where the path is broken when the switch is open.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Our design challenge is a small flashlight switch. The battery, compatible lamp and conducting wires must form a complete path for the lamp to light. An open switch breaks that path. The battery supplies energy; the switch controls the connection. Engineering Design here is a LiberiaLearn STEM activity, not an official Ministry subject claim. Draw or describe where the path is broken when the switch is open.",
        "keyboardPath": "Tab to labelled controls and response fields. Use Enter to check an attempt. An oral response may be dictated or scribed.",
        "reducedMotion": "STATIC_EQUIVALENT"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Use the printed text, diagrams and questions with paper and pencil. Responses can be spoken and scribed."
      },
      "completion": "ALL_RESPONSES_WRITTEN",
      "pedagogy": {
        "strategy": "GUIDED_TO_INDEPENDENT",
        "representation": "MIXED",
        "scaffoldLevel": "NONE"
      },
      "teaching": {
        "phase": "DEFINE",
        "blocks": []
      }
    },
    {
      "id": "constraints",
      "type": "PRACTICE",
      "title": "Understand the circuit and the limits",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "Explain the source of energy and why every trial matters.",
      "content": {
        "body": "Use only a teacher-checked, enclosed low-voltage kit. Never use mains electricity or loose button cells. Do not short the battery. Stop if parts warm; adults handle cutting. A design should light on at least four of five closures and stay dark on all five openings. These are design criteria, not your grade."
      },
      "interaction": {
        "kind": "NONE"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Trace the path from one battery terminal through the lamp and back.",
        "Separate a recorded result from a prediction about a future test."
      ],
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Use only a teacher-checked, enclosed low-voltage kit. Never use mains electricity or loose button cells. Do not short the battery. Stop if parts warm; adults handle cutting. A design should light on at least four of five closures and stay dark on all five openings. These are design criteria, not your grade. Why can closing the switch light a working circuit? Options: The lamp gets its energy from the switch instead of the battery.; It completes the path so energy from the battery can be transferred.; The switch makes new energy each time it closes.. What can one successful closure establish? Options: The lamp lit on that trial; we still need the other observations.; It proves every future closure will work.; One success can stand for all five trials without testing them..",
        "keyboardPath": "Tab to labelled controls and response fields. Use Enter to check an attempt. An oral response may be dictated or scribed.",
        "reducedMotion": "STATIC_EQUIVALENT"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Use the printed text, diagrams and questions with paper and pencil. Responses can be spoken and scribed."
      },
      "completion": "VIEWED",
      "pedagogy": {
        "strategy": "GUIDED_TO_INDEPENDENT",
        "representation": "MIXED",
        "scaffoldLevel": "PARTIAL"
      },
      "teaching": {
        "phase": "RESEARCH_CONSTRAINTS",
        "blocks": [
          {
            "type": "CHECK",
            "id": "battery-and-switch",
            "items": [
              {
                "id": "battery-and-switch-item",
                "prompt": "Why can closing the switch light a working circuit?",
                "options": [
                  {
                    "id": "opt-2f6754b19fc8",
                    "text": "The lamp gets its energy from the switch instead of the battery.",
                    "feedback": "The battery is the source; the switch controls the connection.",
                    "misconceptionId": "switch-creates-energy"
                  },
                  {
                    "id": "opt-628a0fd93095",
                    "text": "It completes the path so energy from the battery can be transferred.",
                    "feedback": "This explanation uses the stated circuit or evidence."
                  },
                  {
                    "id": "opt-cdf62be07251",
                    "text": "The switch makes new energy each time it closes.",
                    "feedback": "Closing changes the path, not the source of energy.",
                    "misconceptionId": "switch-creates-energy"
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-628a0fd93095"
                },
                "misconceptionId": "switch-creates-energy"
              }
            ]
          },
          {
            "type": "CHECK",
            "id": "honest-trials",
            "items": [
              {
                "id": "honest-trials-item",
                "prompt": "What can one successful closure establish?",
                "options": [
                  {
                    "id": "opt-e7ac32ad5836",
                    "text": "The lamp lit on that trial; we still need the other observations.",
                    "feedback": "This explanation uses the stated circuit or evidence."
                  },
                  {
                    "id": "opt-5b82957645b8",
                    "text": "It proves every future closure will work.",
                    "feedback": "One result does not guarantee future performance.",
                    "misconceptionId": "one-pass-proves-reliability"
                  },
                  {
                    "id": "opt-e53ffc2ec8f8",
                    "text": "One success can stand for all five trials without testing them.",
                    "feedback": "Missing trials stay missing. Never copy one success into unobserved trials.",
                    "misconceptionId": "one-pass-proves-reliability"
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-e7ac32ad5836"
                },
                "misconceptionId": "one-pass-proves-reliability"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "design",
      "type": "PRACTICE",
      "title": "Plan before changing the contacts",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "State what changes, what stays fixed and why the comparison is useful.",
      "content": {
        "body": "Sketch two contact arrangements. Predict how changing one contact feature could affect the light. Keep the same battery, lamp, wires and procedure. Work in groups of three to five with rotating jobs: planner, supervised builder, observer, recorder and evidence-checker. Combine jobs in smaller groups. Everyone should explain a decision."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "design-response-0",
            "prompt": "Describe both contact arrangements. Identify one changed feature and the controls.",
            "minLength": 20
          },
          {
            "id": "design-response-1",
            "prompt": "Predict an effect and explain why it might occur.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Change a contact feature, not several components at once.",
        "Your prediction needs a reason that could be checked."
      ],
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Sketch two contact arrangements. Predict how changing one contact feature could affect the light. Keep the same battery, lamp, wires and procedure. Work in groups of three to five with rotating jobs: planner, supervised builder, observer, recorder and evidence-checker. Combine jobs in smaller groups. Everyone should explain a decision. Describe both contact arrangements. Identify one changed feature and the controls. Predict an effect and explain why it might occur.",
        "keyboardPath": "Tab to labelled controls and response fields. Use Enter to check an attempt. An oral response may be dictated or scribed.",
        "reducedMotion": "STATIC_EQUIVALENT"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Use the printed text, diagrams and questions with paper and pencil. Responses can be spoken and scribed."
      },
      "completion": "ALL_RESPONSES_WRITTEN",
      "pedagogy": {
        "strategy": "GUIDED_TO_INDEPENDENT",
        "representation": "MIXED",
        "scaffoldLevel": "PARTIAL"
      },
      "teaching": {
        "phase": "DESIGN",
        "blocks": [
          {
            "type": "CHECK",
            "id": "plan-one-change",
            "items": [
              {
                "id": "plan-one-change-item",
                "prompt": "Which plan lets us compare one contact change fairly?",
                "options": [
                  {
                    "id": "one-contact",
                    "text": "Widen one contact. Keep the same battery, lamp, wires and procedure.",
                    "feedback": "One contact feature changes. The other parts and procedure stay fixed, so the comparison investigates that change."
                  },
                  {
                    "id": "change-bulb",
                    "text": "Widen one contact and use a brighter lamp for Design 2.",
                    "feedback": "Both the contact and the lamp change. You could not tell which change affected the result. Keep the lamp fixed.",
                    "misconceptionId": "change-everything-is-fair"
                  },
                  {
                    "id": "change-kit",
                    "text": "Change the contact, battery and wires together for Design 2.",
                    "feedback": "Several parts change together. A different result would not identify the effect of the contact. Change one feature and keep the kit fixed.",
                    "misconceptionId": "change-everything-is-fair"
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "one-contact"
                },
                "misconceptionId": "change-everything-is-fair"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "build",
      "type": "PRACTICE",
      "title": "Prepare the investigation honestly",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "Choose the honest evidence route and explain the planned fair test.",
      "content": {
        "body": "With adult oversight, prepare the first design and explain the plan for the second. If you observe your group, say that. If you have no kit, use a labelled sketch and test plan. Only use a provided observation set after your teacher confirms its review. Do not enter pretend measurements to make a screen continue. The virtual-lab route is unavailable until approved."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "build-response-0",
            "prompt": "State whether you will perform tests, observe your group, analyze reviewed provided observations, or complete a sketch/test-plan only.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Read the source label before you use any observation.",
        "A taller bar answers one question; inspect the other criterion too."
      ],
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "With adult oversight, prepare the first design and explain the plan for the second. If you observe your group, say that. If you have no kit, use a labelled sketch and test plan. Only use a provided observation set after your teacher confirms its review. Do not enter pretend measurements to make a screen continue. The virtual-lab route is unavailable until approved. Which comparison helps investigate the contact change? Options: Change the contact feature while keeping the kit and trial procedure fixed.; Change battery, bulb and contacts together, then credit the contact.; Use a brighter bulb only for the second design and credit the contact.. What must a final design choice consider? Options: Both designs' closed-light and open-dark counts, plus the test limits.; The tallest closed-light bar is enough; ignore open-switch results.; Only closed-switch light counts matter, even if the lamp stays on when open.. State whether you will perform tests, observe your group, analyze reviewed provided observations, or complete a sketch/test-plan only.",
        "keyboardPath": "Tab to labelled controls and response fields. Use Enter to check an attempt. An oral response may be dictated or scribed.",
        "reducedMotion": "STATIC_EQUIVALENT"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Use the printed text, diagrams and questions with paper and pencil. Responses can be spoken and scribed."
      },
      "completion": "ALL_RESPONSES_WRITTEN",
      "pedagogy": {
        "strategy": "GUIDED_TO_INDEPENDENT",
        "representation": "MIXED",
        "scaffoldLevel": "PARTIAL"
      },
      "teaching": {
        "phase": "BUILD_OR_MODEL",
        "blocks": [
          {
            "type": "CHECK",
            "id": "fair-comparison",
            "items": [
              {
                "id": "fair-comparison-item",
                "prompt": "Which comparison helps investigate the contact change?",
                "options": [
                  {
                    "id": "opt-ba26a50fe136",
                    "text": "Change the contact feature while keeping the kit and trial procedure fixed.",
                    "feedback": "This explanation uses the stated circuit or evidence."
                  },
                  {
                    "id": "opt-cf1e4dd06907",
                    "text": "Change battery, bulb and contacts together, then credit the contact.",
                    "feedback": "Several changes leave the effect of the contact uncertain.",
                    "misconceptionId": "change-everything-is-fair"
                  },
                  {
                    "id": "opt-c62086a7055b",
                    "text": "Use a brighter bulb only for the second design and credit the contact.",
                    "feedback": "A different bulb is another changed factor.",
                    "misconceptionId": "change-everything-is-fair"
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-ba26a50fe136"
                },
                "misconceptionId": "change-everything-is-fair"
              }
            ]
          },
          {
            "type": "CHECK",
            "id": "compare-both-criteria",
            "items": [
              {
                "id": "compare-both-criteria-item",
                "prompt": "What must a final design choice consider?",
                "options": [
                  {
                    "id": "opt-fe077b01cbc0",
                    "text": "Both designs' closed-light and open-dark counts, plus the test limits.",
                    "feedback": "This explanation uses the stated circuit or evidence."
                  },
                  {
                    "id": "opt-7836f789aea1",
                    "text": "The tallest closed-light bar is enough; ignore open-switch results.",
                    "feedback": "The open-switch criterion is not shown by that bar.",
                    "misconceptionId": "tallest-bar-proves-best"
                  },
                  {
                    "id": "opt-5c52f67f22de",
                    "text": "Only closed-switch light counts matter, even if the lamp stays on when open.",
                    "feedback": "A controllable light should also be dark when the switch is open.",
                    "misconceptionId": "tallest-bar-proves-best"
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-fe077b01cbc0"
                },
                "misconceptionId": "tallest-bar-proves-best"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "investigation",
      "type": "PRACTICE",
      "title": "Test, compare and draw your graph",
      "purpose": "INDEPENDENT_PRACTICE",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "Complete both available observation records, source labels and the hand-drawn graph before leaving this activity.",
      "content": {
        "body": "Keep this activity open while completing both designs. Record five closed and five open observations for each design. Record all outcomes honestly. After Design 1, state one contact change and why its evidence suggests that change; then test Design 2. On paper copy both rows, draw two labelled bars from the closed-light counts with a zero baseline and scale to five, and check the open-dark counts too."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "investigation-response-0",
            "prompt": "Label evidence as counted (MEASURED) for your or your group's observations, or given to us (SUPPLIED) for reviewed provided observations. Do not invent missing counts. Record your evidence source, both design rows and both bar heights. Missing evidence stays missing.",
            "minLength": 20
          },
          {
            "id": "investigation-response-1",
            "prompt": "Label a numerical difference worked out (CALCULATED). Label what you think the evidence supports my conclusion (INFERRED). Explain your revision rationale, the numerical comparison and the open-switch results.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Keep this activity open while completing both designs. Record five closed and five open observations for each design. Record all outcomes honestly. After Design 1, state one contact change and why its evidence suggests that change; then test Design 2. On paper copy both rows, draw two labelled bars from the closed-light counts with a zero baseline and scale to five, and check the open-dark counts too. Build and compare two low-voltage flashlight-switch designs. Use repeated tests to choose or improve a design. Light when closed: Closed-switch light successes, at least 4 trials. Dark when open: Open-switch dark successes, at least 5 trials. Change one contact feature; keep battery, lamp, wires and procedure fixed. Teacher checks enclosed low-voltage batteries and a compatible bulb. No mains, loose button cells, damaged cells, direct shorts or hot wires. Stop if parts warm. Adults handle cutting and real safety decisions. Observe five closed-switch trials and record every outcome. Observe five open-switch trials and record every outcome. Explain one contact change from Design 1 evidence; test Design 2 under the same conditions. Record only observations actually available. Compare both designs. MEASURED: switch trial observations Row 1 is Design 1. Row 2 is Design 2. Record your own counts out of 5. MEASURED: identify whether you performed the test or observed your group's test. Closed-switch light successes (trials), 0 to 5. Open-switch dark successes (trials), 0 to 5. Row 1 is Design 1. Row 2 is Design 2. Missing observations are not zero.",
        "keyboardPath": "Tab to labelled controls and response fields. Use Enter to check an attempt. An oral response may be dictated or scribed.",
        "reducedMotion": "STATIC_EQUIVALENT"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Use the printed text, diagrams and questions with paper and pencil. Responses can be spoken and scribed."
      },
      "completion": "ALL_RESPONSES_WRITTEN",
      "pedagogy": {
        "strategy": "GUIDED_TO_INDEPENDENT",
        "representation": "MIXED",
        "scaffoldLevel": "NONE"
      },
      "teaching": {
        "phase": "TEST",
        "blocks": [
          {
            "type": "DESIGN_CYCLE",
            "id": "switch-designs",
            "brief": "Build and compare two low-voltage flashlight-switch designs. Use repeated tests to choose or improve a design.",
            "criteria": [
              {
                "id": "closed-light",
                "description": "Light when closed",
                "measure": "Closed-switch light successes",
                "unit": "trials",
                "comparison": "AT_LEAST",
                "target": 4
              },
              {
                "id": "open-dark",
                "description": "Dark when open",
                "measure": "Open-switch dark successes",
                "unit": "trials",
                "comparison": "AT_LEAST",
                "target": 5
              }
            ],
            "constraints": [
              "Change one contact feature; keep battery, lamp, wires and procedure fixed."
            ],
            "safety": [
              "Teacher checks enclosed low-voltage batteries and a compatible bulb. No mains, loose button cells, damaged cells, direct shorts or hot wires. Stop if parts warm. Adults handle cutting and real safety decisions."
            ],
            "testPlan": [
              "Observe five closed-switch trials and record every outcome.",
              "Observe five open-switch trials and record every outcome.",
              "Explain one contact change from Design 1 evidence; test Design 2 under the same conditions."
            ],
            "maxIterations": 2,
            "measurement": {
              "tableId": "switch-trials",
              "criterionColumns": [
                {
                  "criterionId": "closed-light",
                  "columnId": "closed-lit"
                },
                {
                  "criterionId": "open-dark",
                  "columnId": "open-dark"
                }
              ]
            }
          },
          {
            "type": "MEASUREMENT_TABLE",
            "id": "switch-trials",
            "title": "MEASURED: switch trial observations",
            "origin": "MEASURED_BY_LEARNER",
            "originNote": "Row 1 is Design 1. Row 2 is Design 2. Record your own counts out of 5. MEASURED: identify whether you performed the test or observed your group's test.",
            "columns": [
              {
                "id": "closed-lit",
                "label": "Closed-switch light successes",
                "unit": "trials",
                "precision": 0,
                "minimum": 0,
                "maximum": 5
              },
              {
                "id": "open-dark",
                "label": "Open-switch dark successes",
                "unit": "trials",
                "precision": 0,
                "minimum": 0,
                "maximum": 5
              }
            ],
            "trials": [
              {
                "closed-lit": null,
                "open-dark": null
              },
              {
                "closed-lit": null,
                "open-dark": null
              }
            ],
            "derived": []
          }
        ]
      }
    },
    {
      "id": "refine",
      "type": "PRACTICE",
      "title": "A revision can work better, equally or worse",
      "purpose": "INDEPENDENT_PRACTICE",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "Compare the evidence honestly and identify a useful next test.",
      "content": {
        "body": "Use your paper record to compare the two designs. A second design can perform worse even when the first met every criterion. Keep that result. A fair test helps you reason about a change, but five trials do not prove a cause or guarantee future reliability. Without observed or reviewed provided results, keep the comparison incomplete and explain your proposed test instead."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "refine-response-0",
            "prompt": "Label evidence as counted (MEASURED) for your or your group's observations, or given to us (SUPPLIED) for reviewed provided observations. Do not invent missing counts. What changed in the counts? Explain whether the evidence supports your prediction or leaves it uncertain.",
            "minLength": 20
          },
          {
            "id": "refine-response-1",
            "prompt": "Label a numerical difference worked out (CALCULATED). Label what you think the evidence supports my conclusion (INFERRED). What further controlled test would help? Explain what it could reveal.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Use your paper record to compare the two designs. A second design can perform worse even when the first met every criterion. Keep that result. A fair test helps you reason about a change, but five trials do not prove a cause or guarantee future reliability. Without observed or reviewed provided results, keep the comparison incomplete and explain your proposed test instead. What changed in the counts? Explain whether the evidence supports your prediction or leaves it uncertain. What further controlled test would help? Explain what it could reveal.",
        "keyboardPath": "Tab to labelled controls and response fields. Use Enter to check an attempt. An oral response may be dictated or scribed.",
        "reducedMotion": "STATIC_EQUIVALENT"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Use the printed text, diagrams and questions with paper and pencil. Responses can be spoken and scribed."
      },
      "completion": "ALL_RESPONSES_WRITTEN",
      "pedagogy": {
        "strategy": "GUIDED_TO_INDEPENDENT",
        "representation": "MIXED",
        "scaffoldLevel": "NONE"
      },
      "teaching": {
        "phase": "REFINE",
        "blocks": []
      }
    },
    {
      "id": "communicate",
      "type": "PRACTICE",
      "title": "Recommend with evidence, not just a taller bar",
      "purpose": "EXPLAIN_CONCEPT",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "Present your evidence-supported recommendation and transfer the fair-test idea to a new problem.",
      "content": {
        "body": "Use your sketches, source labels, table and graph. Choose a design or propose a further improvement. Give a numerical reason from both rows and consider both criteria. Say what you actually did: performed tests, observed a group, or analyzed provided observations. A paper plan without data is useful preparation, not a completed test comparison."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "communicate-response-0",
            "prompt": "Label evidence as counted (MEASURED) for your or your group's observations, or given to us (SUPPLIED) for reviewed provided observations. Do not invent missing counts. Justify your choice with both closed and open observations and one limitation.",
            "minLength": 20
          },
          {
            "id": "communicate-response-1",
            "prompt": "Label a numerical difference worked out (CALCULATED). Label what you think the evidence supports my conclusion (INFERRED). How could you compare two paper clips for holding pages fairly? State one change, the controls and the evidence needed.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Use your sketches, source labels, table and graph. Choose a design or propose a further improvement. Give a numerical reason from both rows and consider both criteria. Say what you actually did: performed tests, observed a group, or analyzed provided observations. A paper plan without data is useful preparation, not a completed test comparison. Justify your choice with both closed and open observations and one limitation. How could you compare two paper clips for holding pages fairly? State one change, the controls and the evidence needed.",
        "keyboardPath": "Tab to labelled controls and response fields. Use Enter to check an attempt. An oral response may be dictated or scribed.",
        "reducedMotion": "STATIC_EQUIVALENT"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Use the printed text, diagrams and questions with paper and pencil. Responses can be spoken and scribed."
      },
      "completion": "ALL_RESPONSES_WRITTEN",
      "pedagogy": {
        "strategy": "GUIDED_TO_INDEPENDENT",
        "representation": "MIXED",
        "scaffoldLevel": "NONE"
      },
      "teaching": {
        "phase": "COMMUNICATE",
        "blocks": []
      }
    },
    {
      "id": "independent-explanation",
      "type": "MASTERY_CHECK",
      "title": "Explain your design evidence",
      "purpose": "ASSESS_MASTERY",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "learnerAction": "Use your own reasoning to explain which evidence supports your choice and what remains uncertain.",
      "content": {
        "body": "Keep your sketches, source labels, trial records and graph. Explain a fair comparison and a justified choice."
      },
      "interaction": {
        "kind": "ASSESSMENT_HANDOFF",
        "assessmentRequestId": "future-independent-explanation"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [],
      "evidence": {
        "kind": "MASTERY_RESPONSE",
        "evidenceType": "QUIZ",
        "responses": [
          {
            "responseKey": "future-0",
            "objectiveId": "g4-engineering-compare-flashlight-switches-o1",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          },
          {
            "responseKey": "future-1",
            "objectiveId": "g4-engineering-compare-flashlight-switches-o2",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          },
          {
            "responseKey": "future-2",
            "objectiveId": "g4-engineering-compare-flashlight-switches-o3",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          }
        ]
      },
      "accessibility": {
        "textAlternative": "Keep your sketches, source labels, trial records and graph. Explain a fair comparison and a justified choice.",
        "keyboardPath": "Use the independently supplied assessment controls when available.",
        "reducedMotion": "NOT_APPLICABLE"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Keep your sketches, source labels, trial records and graph. Explain a fair comparison and a justified choice."
      },
      "completion": "ALL_ANSWERED",
      "teaching": {
        "phase": "ASSESS",
        "blocks": []
      }
    }
  ],
  "assessmentRequests": [
    {
      "id": "future-independent-explanation",
      "objectiveIds": [
        "g4-engineering-compare-flashlight-switches-o1",
        "g4-engineering-compare-flashlight-switches-o2",
        "g4-engineering-compare-flashlight-switches-o3"
      ],
      "interaction": "FREE_RESPONSE",
      "evidenceType": "QUIZ",
      "difficulty": "CORE",
      "misconceptionIds": [
        "switch-creates-energy",
        "one-pass-proves-reliability",
        "change-everything-is-fair",
        "tallest-bar-proves-best"
      ],
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "offline": "FULL_OFFLINE"
    }
  ],
  "labProposals": []
}


```

STEM Design: compare two flashlight switches

A light we can control

Our design challenge is a small flashlight switch. The battery, compatible lamp and conducting wires must form a complete path for the lamp to light. An open switch breaks that path. The battery supplies energy; the switch controls the connection. Engineering Design here is a LiberiaLearn STEM activity, not an official Ministry subject claim. Draw or describe where the path is broken when the switch is open.

Draw or describe where the path is broken when the switch is open.
Response: __________________________

Understand the circuit and the limits

Use only a teacher-checked, enclosed low-voltage kit. Never use mains electricity or loose button cells. Do not short the battery. Stop if parts warm; adults handle cutting. A design should light on at least four of five closures and stay dark on all five openings. These are design criteria, not your grade. Why can closing the switch light a working circuit? Options: The lamp gets its energy from the switch instead of the battery.; It completes the path so energy from the battery can be transferred.; The switch makes new energy each time it closes.. What can one successful closure establish? Options: The lamp lit on that trial; we still need the other observations.; It proves every future closure will work.; One success can stand for all five trials without testing them..

Trace the path from one battery terminal through the lamp and back.

Separate a recorded result from a prediction about a future test.

Plan before changing the contacts

Sketch two contact arrangements. Predict how changing one contact feature could affect the light. Keep the same battery, lamp, wires and procedure. Work in groups of three to five with rotating jobs: planner, supervised builder, observer, recorder and evidence-checker. Combine jobs in smaller groups. Everyone should explain a decision. Describe both contact arrangements. Identify one changed feature and the controls. Predict an effect and explain why it might occur.

Change a contact feature, not several components at once.

Your prediction needs a reason that could be checked.

Describe both contact arrangements. Identify one changed feature and the controls.
Response: __________________________

Predict an effect and explain why it might occur.
Response: __________________________

Prepare the investigation honestly

With adult oversight, prepare the first design and explain the plan for the second. If you observe your group, say that. If you have no kit, use a labelled sketch and test plan. Only use a provided observation set after your teacher confirms its review. Do not enter pretend measurements to make a screen continue. The virtual-lab route is unavailable until approved. Which comparison helps investigate the contact change? Options: Change the contact feature while keeping the kit and trial procedure fixed.; Change battery, bulb and contacts together, then credit the contact.; Use a brighter bulb only for the second design and credit the contact.. What must a final design choice consider? Options: Both designs' closed-light and open-dark counts, plus the test limits.; The tallest closed-light bar is enough; ignore open-switch results.; Only closed-switch light counts matter, even if the lamp stays on when open.. State whether you will perform tests, observe your group, analyze reviewed provided observations, or complete a sketch/test-plan only.

Read the source label before you use any observation.

A taller bar answers one question; inspect the other criterion too.

State whether you will perform tests, observe your group, analyze reviewed provided observations, or complete a sketch/test-plan only.
Response: __________________________

Test, compare and draw your graph

Keep this activity open while completing both designs. Record five closed and five open observations for each design. Record all outcomes honestly. After Design 1, state one contact change and why its evidence suggests that change; then test Design 2. On paper copy both rows, draw two labelled bars from the closed-light counts with a zero baseline and scale to five, and check the open-dark counts too. Build and compare two low-voltage flashlight-switch designs. Use repeated tests to choose or improve a design. Light when closed: Closed-switch light successes, at least 4 trials. Dark when open: Open-switch dark successes, at least 5 trials. Change one contact feature; keep battery, lamp, wires and procedure fixed. Teacher checks enclosed low-voltage batteries and a compatible bulb. No mains, loose button cells, damaged cells, direct shorts or hot wires. Stop if parts warm. Adults handle cutting and real safety decisions. Observe five closed-switch trials and record every outcome. Observe five open-switch trials and record every outcome. Explain one contact change from Design 1 evidence; test Design 2 under the same conditions. Record only observations actually available. Compare both designs. MEASURED: switch trial observations Row 1 is Design 1. Row 2 is Design 2. Record your own counts out of 5. MEASURED: identify whether you performed the test or observed your group's test. Closed-switch light successes (trials), 0 to 5. Open-switch dark successes (trials), 0 to 5. Row 1 is Design 1. Row 2 is Design 2. Missing observations are not zero.

Label evidence as counted (MEASURED) for your or your group's observations, or given to us (SUPPLIED) for reviewed provided observations. Do not invent missing counts. Record your evidence source, both design rows and both bar heights. Missing evidence stays missing.
Response: __________________________

Label a numerical difference worked out (CALCULATED). Label what you think the evidence supports my conclusion (INFERRED). Explain your revision rationale, the numerical comparison and the open-switch results.
Response: __________________________

A revision can work better, equally or worse

Use your paper record to compare the two designs. A second design can perform worse even when the first met every criterion. Keep that result. A fair test helps you reason about a change, but five trials do not prove a cause or guarantee future reliability. Without observed or reviewed provided results, keep the comparison incomplete and explain your proposed test instead. What changed in the counts? Explain whether the evidence supports your prediction or leaves it uncertain. What further controlled test would help? Explain what it could reveal.

Label evidence as counted (MEASURED) for your or your group's observations, or given to us (SUPPLIED) for reviewed provided observations. Do not invent missing counts. What changed in the counts? Explain whether the evidence supports your prediction or leaves it uncertain.
Response: __________________________

Label a numerical difference worked out (CALCULATED). Label what you think the evidence supports my conclusion (INFERRED). What further controlled test would help? Explain what it could reveal.
Response: __________________________

Recommend with evidence, not just a taller bar

Use your sketches, source labels, table and graph. Choose a design or propose a further improvement. Give a numerical reason from both rows and consider both criteria. Say what you actually did: performed tests, observed a group, or analyzed provided observations. A paper plan without data is useful preparation, not a completed test comparison. Justify your choice with both closed and open observations and one limitation. How could you compare two paper clips for holding pages fairly? State one change, the controls and the evidence needed.

Label evidence as counted (MEASURED) for your or your group's observations, or given to us (SUPPLIED) for reviewed provided observations. Do not invent missing counts. Justify your choice with both closed and open observations and one limitation.
Response: __________________________

Label a numerical difference worked out (CALCULATED). Label what you think the evidence supports my conclusion (INFERRED). How could you compare two paper clips for holding pages fairly? State one change, the controls and the evidence needed.
Response: __________________________

Explain your design evidence

Keep your sketches, source labels, trial records and graph. Explain a fair comparison and a justified choice.
