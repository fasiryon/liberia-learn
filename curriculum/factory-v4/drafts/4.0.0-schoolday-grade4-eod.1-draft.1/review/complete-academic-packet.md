# Programme batch academic review

Original factory DRAFTs. No academic approval, official assessment, publication or student activation is claimed.

## Connect the day with evidence

4.0.0-schoolday-grade4-eod.1-draft.1 | GO-G04-EOD | f99247e183ee0653787d97354202974d1d3ad26e92e09bf5a5898230e2ef7791

```json

{
  "version": "program-academic-review/1.0.0",
  "state": "DRAFT",
  "authorship": "AI_AUTHORED_DETERMINISTIC_FACTORY_RECIPE",
  "humanSubjectExpertReview": "NOT_PERFORMED",
  "academicApproval": "PENDING_EXACT_VERSION_REVIEW",
  "programOrderId": "GO-G04-EOD",
  "courseId": null,
  "unit": null,
  "sourceOrder": {
    "planId": "stem1-g4-day1",
    "slot": "END_OF_DAY",
    "grade": 4,
    "orderId": "GO-G04-EOD",
    "owner": "T2_CODEX",
    "kind": "END_OF_DAY_REFLECTION",
    "batch": "BAND_3-5",
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
    "requirements": [
      "A ten-minute reflection that connects the day's STEM periods",
      "A short written reflection and one question to carry to tomorrow",
      "Formative only"
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
      "id": "g4-eod-evidence-connections-o1",
      "statement": "Connect two activities actually attempted using specific evidence.",
      "moeReferences": []
    },
    {
      "id": "g4-eod-evidence-connections-o2",
      "statement": "Explain a justified revision or uncertainty without inventing completed work.",
      "moeReferences": []
    },
    {
      "id": "g4-eod-evidence-connections-o3",
      "statement": "Ask a useful next question and say how evidence could help answer it.",
      "moeReferences": []
    }
  ],
  "misconceptions": [
    {
      "id": "confidence-is-evidence",
      "objectiveId": "g4-eod-evidence-connections-o1",
      "description": "Feeling sure is used instead of evidence for a claim.",
      "response": "Name the actual calculation, observation or text detail and explain what it supports."
    },
    {
      "id": "revision-means-failure",
      "objectiveId": "g4-eod-evidence-connections-o2",
      "description": "A conflicting result is hidden to avoid revising an idea.",
      "response": "Keep the result and explain what it changes or leaves uncertain. A justified revision helps learning."
    }
  ],
  "answerGuidance": {
    "reflection": "Use actually attempted work, a specific piece of evidence, an explained cross-period connection and a useful next question. Honest uncertainty is valid. Confidence, effort or fluent writing is not mastery.",
    "fictionalExample": "The illustrative pupil matched the set instruction to the trace and then connected that evidence-checking habit to site claims. It is not an actual learner observation."
  },
  "teacherGuide": {
    "role": "END_OF_DAY_REFLECTION; ENGLISH is an allowed day-subject carrier, not a required full language lesson pattern.",
    "acceptedFoundations": [
      {
        "slot": "P1",
        "version": "4.0.0-schoolday-primary-math.2-draft.1",
        "key": "g4-math-three-digit-products",
        "packageHash": "df24c30a680e745006ef124f671a26cccb1bdf64a8ec9f79b3273e8ba4d98eb2",
        "candidateSha256": "4fe423deb164b80ee63f4144d15cd34fcf206b879c244f4631b2d136616fb2dc",
        "subject": "MATH",
        "directory": "curriculum/factory-v4/drafts/4.0.0-schoolday-primary-math.2-draft.1/g4-math-three-digit-products",
        "objectiveIds": [
          "g4-math-three-digit-products-o1",
          "g4-math-three-digit-products-o2"
        ],
        "reviewCommit": "a17bc28d5323ce392a1a83d2d699f0a65d47ccf6",
        "reviewPath": "curriculum/program/stem-v1/reviews/4.0.0-schoolday-primary-math.2-draft.1/g4-math-three-digit-products.json",
        "reviewSha256": "96694b2babb199754c7e8d77f64c6fb406d6e1a1d1e02d8a701fac18c0f16ffc"
      },
      {
        "slot": "P2",
        "version": "4.0.0-schoolday-primary-science.2-draft.1",
        "key": "g4-science-food-path-and-absorption",
        "packageHash": "6c9bb35aa616f76c316159159dcc2b96c22618e1a628f6e14a66b294ab2c607a",
        "candidateSha256": "b481157bde0e0a509c99220f2a80afd5ba65f97e6fa4efe23b04670d37e5c1d7",
        "subject": "SCIENCE",
        "directory": "curriculum/factory-v4/drafts/4.0.0-schoolday-primary-science.2-draft.1/g4-science-food-path-and-absorption",
        "objectiveIds": [
          "g4-science-food-path-and-absorption-o1",
          "g4-science-food-path-and-absorption-o2",
          "g4-science-food-path-and-absorption-o3"
        ],
        "reviewCommit": "a17bc28d5323ce392a1a83d2d699f0a65d47ccf6",
        "reviewPath": "curriculum/program/stem-v1/reviews/4.0.0-schoolday-primary-science.2-draft.1/g4-science-food-path-and-absorption.json",
        "reviewSha256": "6c90aa6e54fe7603e13e44524da7f4a88479eb178e536f94b21bc0cab5cc87e9"
      },
      {
        "slot": "P3",
        "version": "4.0.0-schoolday-primary-english.2-draft.1",
        "key": "g4-english-predict-question-summarize",
        "packageHash": "39c9cafb634914512bd4cf396cdb454b2770a9057e5bd93734a6787e8757f0e6",
        "candidateSha256": "c28b735becfc291cdd5da0e91a1452ff5abc156bbb776ec7d937ebd6d631fdd0",
        "subject": "ENGLISH",
        "directory": "curriculum/factory-v4/drafts/4.0.0-schoolday-primary-english.2-draft.1/g4-english-predict-question-summarize",
        "objectiveIds": [
          "g4-english-predict-question-summarize-o1",
          "g4-english-predict-question-summarize-o2",
          "g4-english-predict-question-summarize-o3"
        ],
        "reviewCommit": "a17bc28d5323ce392a1a83d2d699f0a65d47ccf6",
        "reviewPath": "curriculum/program/stem-v1/reviews/4.0.0-schoolday-primary-english.2-draft.1/g4-english-predict-question-summarize.json",
        "reviewSha256": "bc1ded25ff3aacf63721fc517720a5da366a0717aba907d0b77459a1461d12b1"
      },
      {
        "slot": "P4",
        "version": "4.0.0-schoolday-primary-social-studies.2-draft.1",
        "key": "g4-social-studies-coast-inland-evidence",
        "packageHash": "924e57dcc56e65c20eaedb5133c70d84a433f935c898349ac053df22b584cd04",
        "candidateSha256": "3808f2a1237d0087852f813547ef3f7f77cef549d308dd66d737b09d1a52e1bb",
        "subject": "SOCIAL_STUDIES",
        "directory": "curriculum/factory-v4/drafts/4.0.0-schoolday-primary-social-studies.2-draft.1/g4-social-studies-coast-inland-evidence",
        "objectiveIds": [
          "g4-social-studies-coast-inland-evidence-o1",
          "g4-social-studies-coast-inland-evidence-o2",
          "g4-social-studies-coast-inland-evidence-o3"
        ],
        "reviewCommit": "a17bc28d5323ce392a1a83d2d699f0a65d47ccf6",
        "reviewPath": "curriculum/program/stem-v1/reviews/4.0.0-schoolday-primary-social-studies.2-draft.1/g4-social-studies-coast-inland-evidence.json",
        "reviewSha256": "86929c3b76e785b3318a44c9082d8d0ad74190c8c2724133b1b2c594dd9d2962"
      },
      {
        "slot": "P5",
        "version": "4.0.0-schoolday-primary-computing.2-draft.1",
        "key": "g4-computing-keep-score-with-variables",
        "packageHash": "be00b57563b01f490e99768e2787fd46271e446bf97d8a6d8c790a7f4deaba43",
        "candidateSha256": "ec40eb4790a453ceccbccbdb32a8cfc88cd47a56808d7084e4bac2cd67db85f1",
        "subject": "COMPUTER_SCIENCE",
        "directory": "curriculum/factory-v4/drafts/4.0.0-schoolday-primary-computing.2-draft.1/g4-computing-keep-score-with-variables",
        "objectiveIds": [
          "g4-computing-keep-score-with-variables-o1",
          "g4-computing-keep-score-with-variables-o2",
          "g4-computing-keep-score-with-variables-o3"
        ],
        "reviewCommit": "a17bc28d5323ce392a1a83d2d699f0a65d47ccf6",
        "reviewPath": "curriculum/program/stem-v1/reviews/4.0.0-schoolday-primary-computing.2-draft.1/g4-computing-keep-score-with-variables.json",
        "reviewSha256": "87b064edaae94c957b8108ef1e598cf671d3a21ef6786f422b05bff42eb1bac4"
      },
      {
        "slot": "P6",
        "version": "4.0.0-schoolday-primary-engineering.2-draft.1",
        "key": "g4-engineering-compare-flashlight-switches",
        "packageHash": "202106a8bffa0afb8c05aa9338db458b5b913483f70a222c2bc1b8a579b7a7a1",
        "candidateSha256": "68529397f37a3f68b7b0d6ab985f95c947bc71bef42f557c05d340daca014229",
        "subject": "ENGINEERING_FOUNDATIONS",
        "directory": "curriculum/factory-v4/drafts/4.0.0-schoolday-primary-engineering.2-draft.1/g4-engineering-compare-flashlight-switches",
        "objectiveIds": [
          "g4-engineering-compare-flashlight-switches-o1",
          "g4-engineering-compare-flashlight-switches-o2",
          "g4-engineering-compare-flashlight-switches-o3"
        ],
        "reviewCommit": "a17bc28d5323ce392a1a83d2d699f0a65d47ccf6",
        "reviewPath": "curriculum/program/stem-v1/reviews/4.0.0-schoolday-primary-engineering.2-draft.1/g4-engineering-compare-flashlight-switches.json",
        "reviewSha256": "8947517fccb4b510ca5b43c7f00a8ba5d13eab33246c15bfea8523ac617e9bc7"
      }
    ],
    "response": "Short written reflection or pupil-directed oral/scribed response, with labelled sketches if useful.",
    "criteria": [
      "Specific work actually attempted",
      "Relevant evidence and honest source labels",
      "Meaningful connection across periods",
      "Justified revision, retained idea or uncertainty",
      "One answerable question and possible evidence"
    ],
    "timing": "10 minutes is proposed, not a measured rehearsal.",
    "boundaries": "No prefilled success, physical test or all-period completion claims; no official grade, mastery assignment or persistent intervention. A supplied example remains explicitly fictional."
  },
  "references": [
    {
      "title": "Six independently accepted Grade 4 lesson packages",
      "use": "Exact version/package/candidate/objective pins in acceptedFoundations.json. CoS independent acceptance snapshots are preserved. No other package is an academic foundation.",
      "rights": "Internal approved-for-review curriculum; publication/delivery remains unauthorized."
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
  "title": "Connect the day with evidence",
  "instruction": {
    "standard": "liberialearn-v4-instruction/1.1.0",
    "retention": {
      "delayDays": 7,
      "prompts": [
        "Without the worked example, explain: Connect two activities actually attempted using specific evidence.",
        "Without the worked example, explain: Explain a justified revision or uncertainty without inventing completed work."
      ]
    }
  },
  "estimatedMinutes": 10,
  "ageBand": "UPPER_PRIMARY",
  "pedagogy": {
    "primaryStrategy": "GUIDED_TO_INDEPENDENT",
    "rationale": "Read an explicitly fictional reflection, distinguish evidence from confidence, then construct and revise a short reflection grounded in the accepted day."
  },
  "prerequisiteAssumptions": [
    "Choose work you actually attempted.",
    "A labelled sketch or pupil-directed oral/scribed response is acceptable."
  ],
  "misconceptions": [
    {
      "id": "confidence-is-evidence",
      "objectiveId": "g4-eod-evidence-connections-o1",
      "description": "Feeling sure is used instead of evidence for a claim.",
      "response": "Name the actual calculation, observation or text detail and explain what it supports."
    },
    {
      "id": "revision-means-failure",
      "objectiveId": "g4-eod-evidence-connections-o2",
      "description": "A conflicting result is hidden to avoid revising an idea.",
      "response": "Keep the result and explain what it changes or leaves uncertain. A justified revision helps learning."
    }
  ],
  "scenes": [
    {
      "id": "read-reflection",
      "type": "EXPLANATION",
      "title": "Read a reflection with a reason",
      "purpose": "EXPLAIN_CONCEPT",
      "objectiveIds": [
        "g4-eod-evidence-connections-o1",
        "g4-eod-evidence-connections-o2",
        "g4-eod-evidence-connections-o3"
      ],
      "learnerAction": "Identify the evidence and the change in the fictional reflection.",
      "content": {
        "body": "This short reflection is fictional. It shows how a learner uses evidence, not just confidence. Your reflection should describe your own work."
      },
      "interaction": {
        "kind": "NONE"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "This short reflection is fictional. It shows how a learner uses evidence, not just confidence. Your reflection should describe your own work. An illustrative reflection. I first added when the score instruction said set. I checked my trace against the instruction. Set replaced the previous score, so I revised that step. It reminded me to match each site claim to the right observation in Social Studies. Tomorrow I want to test another event order.",
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
        "scaffoldLevel": "NONE"
      },
      "teaching": {
        "phase": "READ",
        "blocks": [
          {
            "type": "READING_PASSAGE",
            "id": "reflection-example",
            "title": "An illustrative reflection",
            "paragraphs": [
              "I first added when the score instruction said set. I checked my trace against the instruction. Set replaced the previous score, so I revised that step. It reminded me to match each site claim to the right observation in Social Studies. Tomorrow I want to test another event order."
            ],
            "glossary": [
              {
                "term": "reflection",
                "meaning": "An explanation of learning, evidence and a next question."
              }
            ],
            "origin": {
              "kind": "ORIGINAL_FOR_LIBERIALEARN",
              "license": "Original fictional example; review-only.",
              "attribution": "LiberiaLearn"
            }
          }
        ]
      }
    },
    {
      "id": "understand-evidence",
      "type": "PRACTICE",
      "title": "Evidence supports an explanation",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-eod-evidence-connections-o1",
        "g4-eod-evidence-connections-o2",
        "g4-eod-evidence-connections-o3"
      ],
      "learnerAction": "Choose the evidence-based interpretation and explain it.",
      "content": {
        "body": "A useful reflection points to a real detail and explains its meaning. A changed idea is not a failure. Sometimes the evidence supports keeping an idea, or leaves a question open."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "understand-evidence-response-0",
            "prompt": "Explain how one detail supports a change in thinking.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Look for a specific instruction or detail.",
        "Keep a result that challenges the first idea."
      ],
      "misconceptionIds": [
        "confidence-is-evidence",
        "revision-means-failure"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "A useful reflection points to a real detail and explains its meaning. A changed idea is not a failure. Sometimes the evidence supports keeping an idea, or leaves a question open. What supports the pupil's revision? Options: Greater confidence is enough to establish the answer without checking.; The set instruction and the trace show which step needed changing.; Feeling certain proves the original step was right.. What should a learner do with a valid result that challenges an idea? Options: Hide it so the original idea still appears correct.; Remove the conflicting result before sharing the reflection.; Keep it and explain what it changes or leaves uncertain.. Explain how one detail supports a change in thinking.",
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
        "phase": "UNDERSTAND",
        "blocks": [
          {
            "type": "CHECK",
            "id": "reflection-evidence",
            "items": [
              {
                "id": "reflection-evidence-item",
                "prompt": "What supports the pupil's revision?",
                "options": [
                  {
                    "id": "opt-690d7ede3864",
                    "text": "Greater confidence is enough to establish the answer without checking.",
                    "feedback": "Confidence does not identify what the trace showed.",
                    "misconceptionId": "confidence-is-evidence"
                  },
                  {
                    "id": "opt-26a6d67c786b",
                    "text": "The set instruction and the trace show which step needed changing.",
                    "feedback": "This response explains the relevant evidence and what it supports."
                  },
                  {
                    "id": "opt-8ab364e3ec83",
                    "text": "Feeling certain proves the original step was right.",
                    "feedback": "Feeling certain cannot replace checking the instruction.",
                    "misconceptionId": "confidence-is-evidence"
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-26a6d67c786b"
                },
                "misconceptionId": "confidence-is-evidence"
              }
            ]
          },
          {
            "type": "CHECK",
            "id": "reflection-revision",
            "items": [
              {
                "id": "reflection-revision-item",
                "prompt": "What should a learner do with a valid result that challenges an idea?",
                "options": [
                  {
                    "id": "opt-7923047fb431",
                    "text": "Hide it so the original idea still appears correct.",
                    "feedback": "Hiding evidence prevents an honest explanation of the revision.",
                    "misconceptionId": "revision-means-failure"
                  },
                  {
                    "id": "opt-2b8502706f04",
                    "text": "Remove the conflicting result before sharing the reflection.",
                    "feedback": "The conflicting result is useful evidence; explain it rather than removing it.",
                    "misconceptionId": "revision-means-failure"
                  },
                  {
                    "id": "opt-13f2713471fa",
                    "text": "Keep it and explain what it changes or leaves uncertain.",
                    "feedback": "This response explains the relevant evidence and what it supports."
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-13f2713471fa"
                },
                "misconceptionId": "revision-means-failure"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "connect-day",
      "type": "PRACTICE",
      "title": "Reflect on work you actually attempted",
      "purpose": "INDEPENDENT_PRACTICE",
      "objectiveIds": [
        "g4-eod-evidence-connections-o1",
        "g4-eod-evidence-connections-o2",
        "g4-eod-evidence-connections-o3"
      ],
      "learnerAction": "Explain one connection across periods using specific evidence.",
      "content": {
        "body": "Choose two activities you actually tried today. Use a sentence, calculation, trace, sketch or recorded observation. Label counted observations, given information, worked-out calculations and your conclusion honestly. Unfinished work may be discussed as unfinished."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "connect-day-response-0",
            "prompt": "Name the two tasks and a specific piece of evidence. Explain one similarity and one difference in the reasoning.",
            "minLength": 20
          },
          {
            "id": "connect-day-response-1",
            "prompt": "Explain a revision, a supported original idea or an uncertainty. Distinguish given information from your own observation.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Choose two activities you actually tried today. Use a sentence, calculation, trace, sketch or recorded observation. Label counted observations, given information, worked-out calculations and your conclusion honestly. Unfinished work may be discussed as unfinished. Name the two tasks and a specific piece of evidence. Explain one similarity and one difference in the reasoning. Explain a revision, a supported original idea or an uncertainty. Distinguish given information from your own observation.",
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
        "phase": "CONSTRUCT",
        "blocks": []
      }
    },
    {
      "id": "next-question",
      "type": "PRACTICE",
      "title": "Make the reflection useful for tomorrow",
      "purpose": "EXPLAIN_CONCEPT",
      "objectiveIds": [
        "g4-eod-evidence-connections-o1",
        "g4-eod-evidence-connections-o2",
        "g4-eod-evidence-connections-o3"
      ],
      "learnerAction": "Improve one sentence and ask a useful next question.",
      "content": {
        "body": "Read your reflection or have it read aloud. Replace a vague statement with a specific reason. End with one question you could investigate. You do not need to claim that every task was completed or that every question is solved."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "next-question-response-0",
            "prompt": "Show the sentence you improved and explain why it is clearer.",
            "minLength": 20
          },
          {
            "id": "next-question-response-1",
            "prompt": "Ask one question for tomorrow and describe what evidence could help answer it.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Read your reflection or have it read aloud. Replace a vague statement with a specific reason. End with one question you could investigate. You do not need to claim that every task was completed or that every question is solved. Show the sentence you improved and explain why it is clearer. Ask one question for tomorrow and describe what evidence could help answer it.",
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
        "phase": "REVISE",
        "blocks": []
      }
    },
    {
      "id": "independent-explanation",
      "type": "MASTERY_CHECK",
      "title": "Share your reflection",
      "purpose": "ASSESS_MASTERY",
      "objectiveIds": [
        "g4-eod-evidence-connections-o1",
        "g4-eod-evidence-connections-o2",
        "g4-eod-evidence-connections-o3"
      ],
      "learnerAction": "Discuss your evidence, connection and next question with your teacher.",
      "content": {
        "body": "Keep your reflection and tomorrow's question. Explain one connection using work you actually attempted."
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
            "objectiveId": "g4-eod-evidence-connections-o1",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          },
          {
            "responseKey": "future-1",
            "objectiveId": "g4-eod-evidence-connections-o2",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          },
          {
            "responseKey": "future-2",
            "objectiveId": "g4-eod-evidence-connections-o3",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          }
        ]
      },
      "accessibility": {
        "textAlternative": "Keep your reflection and tomorrow's question. Explain one connection using work you actually attempted.",
        "keyboardPath": "Use the independently supplied assessment controls when available.",
        "reducedMotion": "NOT_APPLICABLE"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "Keep your reflection and tomorrow's question. Explain one connection using work you actually attempted."
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
        "g4-eod-evidence-connections-o1",
        "g4-eod-evidence-connections-o2",
        "g4-eod-evidence-connections-o3"
      ],
      "interaction": "FREE_RESPONSE",
      "evidenceType": "QUIZ",
      "difficulty": "CORE",
      "misconceptionIds": [
        "confidence-is-evidence",
        "revision-means-failure"
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

Connect the day with evidence

Read a reflection with a reason

This short reflection is fictional. It shows how a learner uses evidence, not just confidence. Your reflection should describe your own work. An illustrative reflection. I first added when the score instruction said set. I checked my trace against the instruction. Set replaced the previous score, so I revised that step. It reminded me to match each site claim to the right observation in Social Studies. Tomorrow I want to test another event order.

Evidence supports an explanation

A useful reflection points to a real detail and explains its meaning. A changed idea is not a failure. Sometimes the evidence supports keeping an idea, or leaves a question open. What supports the pupil's revision? Options: Greater confidence is enough to establish the answer without checking.; The set instruction and the trace show which step needed changing.; Feeling certain proves the original step was right.. What should a learner do with a valid result that challenges an idea? Options: Hide it so the original idea still appears correct.; Remove the conflicting result before sharing the reflection.; Keep it and explain what it changes or leaves uncertain.. Explain how one detail supports a change in thinking.

Look for a specific instruction or detail.

Keep a result that challenges the first idea.

Explain how one detail supports a change in thinking.
Response: __________________________

Reflect on work you actually attempted

Choose two activities you actually tried today. Use a sentence, calculation, trace, sketch or recorded observation. Label counted observations, given information, worked-out calculations and your conclusion honestly. Unfinished work may be discussed as unfinished. Name the two tasks and a specific piece of evidence. Explain one similarity and one difference in the reasoning. Explain a revision, a supported original idea or an uncertainty. Distinguish given information from your own observation.

Name the two tasks and a specific piece of evidence. Explain one similarity and one difference in the reasoning.
Response: __________________________

Explain a revision, a supported original idea or an uncertainty. Distinguish given information from your own observation.
Response: __________________________

Make the reflection useful for tomorrow

Read your reflection or have it read aloud. Replace a vague statement with a specific reason. End with one question you could investigate. You do not need to claim that every task was completed or that every question is solved. Show the sentence you improved and explain why it is clearer. Ask one question for tomorrow and describe what evidence could help answer it.

Show the sentence you improved and explain why it is clearer.
Response: __________________________

Ask one question for tomorrow and describe what evidence could help answer it.
Response: __________________________

Share your reflection

Keep your reflection and tomorrow's question. Explain one connection using work you actually attempted.
