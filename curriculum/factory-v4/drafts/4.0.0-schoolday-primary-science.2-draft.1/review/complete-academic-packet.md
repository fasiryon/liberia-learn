# Programme batch academic review

Original factory DRAFTs. No academic approval, official assessment, publication or student activation is claimed.

## Model food's path and explain absorption

4.0.0-schoolday-primary-science.2-draft.1 | GO-G04-P2-SCIENCE-U1 | 6c9bb35aa616f76c316159159dcc2b96c22618e1a628f6e14a66b294ab2c607a

```json

{
  "version": "program-academic-review/1.0.0",
  "state": "DRAFT",
  "authorship": "AI_AUTHORED_DETERMINISTIC_FACTORY_RECIPE",
  "humanSubjectExpertReview": "NOT_PERFORMED",
  "academicApproval": "PENDING_EXACT_VERSION_REVIEW",
  "programOrderId": "GO-G04-P2-SCIENCE-U1",
  "courseId": "stem1-g4-science",
  "unit": 1,
  "sourceOrder": {
    "planId": "stem1-g4-day1",
    "slot": "P2",
    "grade": 4,
    "orderId": "GO-G04-P2-SCIENCE-U1",
    "owner": "T2_CODEX",
    "kind": "LESSON",
    "batch": "BAND_3-5",
    "courseId": "stem1-g4-science",
    "unit": 1,
    "unitTitle": "Digestion and the human body",
    "performanceTask": "model the path of food and the job of each organ",
    "family": "SCIENCE",
    "pattern": [
      "PREDICT",
      "EXPERIMENT",
      "OBSERVE",
      "EXPLAIN",
      "APPLY"
    ],
    "recordedSubject": "SCIENCE",
    "developmental": {
      "band": "3-5",
      "maxSentenceWords": 16,
      "maxSceneBodyWords": 90,
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
    "competencies": null,
    "blocks": {
      "existing": [
        "PREDICT_OBSERVE",
        "PROCESS_CYCLE",
        "DATA_PLOT",
        "SORT",
        "CHECK"
      ],
      "proposed": [
        "MEASUREMENT_TABLE",
        "FAIR_TEST_PLANNER"
      ]
    },
    "labs": [
      "electric-circuit"
    ],
    "stemPractices": [
      "SCIENTIFIC_EVIDENCE",
      "CONCEPT_BEFORE_PROCEDURE",
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
      "id": "g4-science-food-path-and-absorption-o1",
      "statement": "Arrange the main stages of the digestive tract and distinguish that path from organs supplying digestive juices.",
      "moeReferences": []
    },
    {
      "id": "g4-science-food-path-and-absorption-o2",
      "statement": "Explain absorption as digested nutrients crossing the small-intestine wall, using a counted paper model.",
      "moeReferences": []
    },
    {
      "id": "g4-science-food-path-and-absorption-o3",
      "statement": "Use a model to explain an organ's job and identify something the model cannot show.",
      "moeReferences": []
    }
  ],
  "misconceptions": [
    {
      "id": "food-through-support-organs",
      "objectiveId": "g4-science-food-path-and-absorption-o1",
      "description": "The swallowed food route is drawn through the liver or pancreas instead of distinguishing the juices they supply.",
      "response": "Keep the continuous food route separate from the liver and pancreas, which supply digestive juices."
    },
    {
      "id": "stomach-absorbs-everything",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "The stomach is treated as the place where all nutrients enter the body.",
      "response": "Most digested nutrients are absorbed through the small-intestine wall."
    },
    {
      "id": "absorbed-nutrients-disappear",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "Nutrients that cross the wall are treated as disappearing from the model total.",
      "response": "Keep transferred tokens visible in the body region. Count both regions to conserve the total."
    },
    {
      "id": "starting-vs-remaining",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "The starting count is reported as still inside after tokens have crossed the wall.",
      "response": "The starting count describes both regions together. Subtract transferred tokens to find what remains inside."
    },
    {
      "id": "transferred-vs-remaining",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "The number transferred during a round is confused with the number remaining inside.",
      "response": "Transferred and remaining name different groups. Track the inside count after every transfer."
    }
  ],
  "answerGuidance": {
    "route": "Mouth, esophagus, stomach, small intestine, large intestine, rectum, anus. This is a simplified route, not an exhaustive anatomical drawing; the rectum is part of the large intestine. Liver and pancreas supply digestive juices, rather than lying on the swallowed-food route.",
    "guided": "Five of fourteen tokens remain inside and nine are in the body region; together there are still fourteen. Crossing represents absorption of already-digested nutrients, not destruction or a whole mouthful entering another organ.",
    "independent": "After transferring five of sixteen, eleven remain. After eight more cross, three remain. Thirteen are now in the body region. Model rounds are actions with invented counts, not a measured human rate or a two-minute digestion claim.",
    "explanation": "Select boundary crossing, and reject the claim that every pupil absorbs a meal in exactly two minutes. The model illustrates a mechanism; it does not empirically establish real physiology.",
    "transfer": "Accept an accurate connected route excluding liver/pancreas as through-stops and an explanation that most nutrients are absorbed through the small-intestine wall. A valid limitation includes absent living tissue, digestive chemistry, scale or real timing. Require a reasoned correction of both poster errors, not just a list of organ names. Accept oral/scribed explanations. An advanced model should distinguish breakdown from crossing and include a way to check whether someone else interprets the representation correctly."
  },
  "teacherGuide": {
    "proposedMinutes": 45,
    "timingEvidence": "NOT_MEASURED",
    "proposedScreenMinutes": 25,
    "proposedPaperMovementMinutes": 20,
    "segments": [
      {
        "minutes": 5,
        "activity": "Record an initial route and prediction on paper"
      },
      {
        "minutes": 8,
        "activity": "Arrange the route digitally or with cards and sort support organs"
      },
      {
        "minutes": 7,
        "activity": "Model a counted boundary crossing and read the illustrative graph"
      },
      {
        "minutes": 8,
        "activity": "Operate the fourteen-token model with a partner; count both regions"
      },
      {
        "minutes": 6,
        "activity": "Interpret the fresh sixteen-token model independently"
      },
      {
        "minutes": 6,
        "activity": "Explain the represented process and its limits"
      },
      {
        "minutes": 5,
        "activity": "Revise the community poster and compare the initial route"
      }
    ],
    "safety": "Use large paper marks or cards. Keep every object away from mouths. No food handling, tasting, heating, liquids, body samples or medical self-reporting. A pupil may direct a partner or use drawn marks instead of manipulating counters.",
    "support": "Read organ labels aloud, provide two large labelled regions, and let pupils point or dictate. Keep a visible inside/body count record in guided work. Do not reveal the independent counts before an attempt.",
    "extension": "Add separate symbols for whole food, smaller digested particles and particles crossing the wall. Ask a partner what each symbol means, revise one ambiguous symbol and identify biological features still omitted.",
    "offline": "Print organ cards, route/sort choices, graph and questions. Pupils reorder cards and mark both regions on paper. The model uses no external audio or network asset. A teacher can read every prompt aloud.",
    "block90Proposal": "After the 45-minute core, compare two physical model designs for 20 minutes, exchange and test their interpretations for 15 minutes, then revise and defend the poster for 10 minutes. Timing is proposed, not observed.",
    "assessment": "No governed assessment, scoring event or official academic record is supplied. The closing handoff is explicitly unavailable.",
    "retention": "Request a new route-and-function explanation after at least seven days. No delayed event is scheduled or claimed."
  },
  "references": [
    {
      "title": "NIDDK: Your Digestive System and How It Works",
      "url": "https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works",
      "use": "Fact-checking of the main tract route, organ jobs and absorption. Original child-level explanations; no copied prose, images or logo.",
      "rights": "Reference link only; no external media reproduced. Exact-version source/rights review remains required."
    },
    {
      "title": "OpenStax Anatomy and Physiology 2e, 23.1",
      "url": "https://openstax.org/books/anatomy-and-physiology-2e/pages/23-1-overview-of-the-digestive-system",
      "use": "Cross-check of tract/accessory-organ distinction and nutrient absorption. Original sequence, sort, token model and questions; no copied figure or textbook exercise.",
      "rights": "Reference link only; no textbook prose or media reproduced."
    },
    {
      "title": "Original LiberiaLearn paper absorption model",
      "use": "All counts, graph points, school poster and activities are invented instructional representations. They are not empirical pupil observations or human measurements.",
      "rights": "Original educational DRAFT; academic and distribution-rights review pending."
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
  "title": "Model food's path and explain absorption",
  "instruction": {
    "standard": "liberialearn-v4-instruction/1.0.0",
    "retention": {
      "delayDays": 7,
      "prompts": [
        "Without the worked example, explain: Arrange the main stages of the digestive tract and distinguish that path from organs supplying digestive juices.",
        "Without the worked example, explain: Explain absorption as digested nutrients crossing the small-intestine wall, using a counted paper model."
      ]
    }
  },
  "estimatedMinutes": 45,
  "ageBand": "UPPER_PRIMARY",
  "pedagogy": {
    "primaryStrategy": "GUIDED_TO_INDEPENDENT",
    "rationale": "Record an initial model, build and revise a route, track tokens crossing a model wall, then independently explain a new model and correct a community poster."
  },
  "prerequisiteAssumptions": [
    "Count and subtract whole numbers to twenty, follow an ordered route and explain a simple model orally or in writing."
  ],
  "misconceptions": [
    {
      "id": "food-through-support-organs",
      "objectiveId": "g4-science-food-path-and-absorption-o1",
      "description": "The swallowed food route is drawn through the liver or pancreas instead of distinguishing the juices they supply.",
      "response": "Keep the continuous food route separate from the liver and pancreas, which supply digestive juices."
    },
    {
      "id": "stomach-absorbs-everything",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "The stomach is treated as the place where all nutrients enter the body.",
      "response": "Most digested nutrients are absorbed through the small-intestine wall."
    },
    {
      "id": "absorbed-nutrients-disappear",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "Nutrients that cross the wall are treated as disappearing from the model total.",
      "response": "Keep transferred tokens visible in the body region. Count both regions to conserve the total."
    },
    {
      "id": "starting-vs-remaining",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "The starting count is reported as still inside after tokens have crossed the wall.",
      "response": "The starting count describes both regions together. Subtract transferred tokens to find what remains inside."
    },
    {
      "id": "transferred-vs-remaining",
      "objectiveId": "g4-science-food-path-and-absorption-o2",
      "description": "The number transferred during a round is confused with the number remaining inside.",
      "response": "Transferred and remaining name different groups. Track the inside count after every transfer."
    }
  ],
  "scenes": [
    {
      "id": "predict-path",
      "type": "PRACTICE",
      "title": "Where does a mouthful go?",
      "purpose": "EXPLAIN_CONCEPT",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o1",
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Draw or describe a possible route and predict where useful parts of food might enter the rest of the body.",
      "content": {
        "body": "A fictional school group in Buchanan is preparing a poster about what happens after eating rice. Before using the poster, sketch your own idea of the route. Keep your first drawing so that you can later explain a change."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "predict-path-response-0",
            "prompt": "What route do you predict, and where might useful parts leave it? Label one uncertainty in your first model.",
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
        "food-through-support-organs",
        "stomach-absorbs-everything"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "A fictional school group in Buchanan is preparing a poster about what happens after eating rice. Before using the poster, sketch your own idea of the route. Keep your first drawing so that you can later explain a change. What route do you predict, and where might useful parts leave it? Label one uncertainty in your first model.",
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
        "phase": "PREDICT",
        "blocks": []
      }
    },
    {
      "id": "build-route",
      "type": "EXPLANATION",
      "title": "Build a connected food route",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o1",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Arrange the route, move the token through it and sort the organs into food-path or juice-supply groups. Never put model materials in your mouth.",
      "content": {
        "body": "Use large paper cards and a paper food token. Move the token from mouth to anus through the route you arrange. Chewing starts breakdown; the esophagus moves food; the stomach mixes it. Digestion continues in the small intestine, where most nutrients are absorbed. The large intestine absorbs water. Its rectum stores stool before it leaves through the anus. The liver and pancreas supply juices; swallowed food does not pass through them."
      },
      "interaction": {
        "kind": "NONE"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Follow the connected tube from the mouth through the stomach and intestines.",
        "An organ can supply a juice without being a place the swallowed food passes through."
      ],
      "misconceptionIds": [
        "food-through-support-organs",
        "stomach-absorbs-everything"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Use large paper cards and a paper food token. Move the token from mouth to anus through the route you arrange. Chewing starts breakdown; the esophagus moves food; the stomach mixes it. Digestion continues in the small intestine, where most nutrients are absorbed. The large intestine absorbs water. Its rectum stores stool before it leaves through the anus. The liver and pancreas supply juices; swallowed food does not pass through them. Order the simplified main stages. The rectum is the final part of the large intestine. organ: Mouth. organ: Esophagus. organ: Stomach. organ: Small intestine. organ: Large intestine. organ part: Rectum. opening: Anus. Separate the food route from organs supplying juices. Groups: Swallowed food passes through, Supplies juices to the route. Cards: Stomach, Small intestine, Liver, Pancreas.",
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
        "phase": "EXPERIMENT",
        "blocks": [
          {
            "type": "SEQUENCE",
            "id": "food-route",
            "prompt": "Order the simplified main stages. The rectum is the final part of the large intestine.",
            "events": [
              {
                "id": "mouth",
                "label": "Mouth",
                "marker": "organ",
                "detail": "Chewing and saliva start digestion."
              },
              {
                "id": "esophagus",
                "label": "Esophagus",
                "marker": "organ",
                "detail": "Moves swallowed food toward the stomach."
              },
              {
                "id": "stomach",
                "label": "Stomach",
                "marker": "organ",
                "detail": "Mixes food with digestive juices."
              },
              {
                "id": "small-intestine",
                "label": "Small intestine",
                "marker": "organ",
                "detail": "Digestion continues and most nutrient absorption occurs."
              },
              {
                "id": "large-intestine",
                "label": "Large intestine",
                "marker": "organ",
                "detail": "Absorbs water and forms stool."
              },
              {
                "id": "rectum",
                "label": "Rectum",
                "marker": "organ part",
                "detail": "The end of the large intestine stores stool."
              },
              {
                "id": "anus",
                "label": "Anus",
                "marker": "opening",
                "detail": "Stool leaves the tract here."
              }
            ]
          },
          {
            "type": "SORT",
            "id": "route-or-juices",
            "prompt": "Separate the food route from organs supplying juices.",
            "misconceptionId": "food-through-support-organs",
            "groups": [
              {
                "id": "path",
                "label": "Swallowed food passes through"
              },
              {
                "id": "supply",
                "label": "Supplies juices to the route"
              }
            ],
            "cards": [
              {
                "id": "route-stomach",
                "text": "Stomach",
                "group": "path",
                "why": "Food enters this part of the tube."
              },
              {
                "id": "route-small",
                "text": "Small intestine",
                "group": "path",
                "why": "Food moves here after the stomach."
              },
              {
                "id": "supply-liver",
                "text": "Liver",
                "group": "supply",
                "why": "Bile reaches the route; the swallowed mouthful does not travel through the liver."
              },
              {
                "id": "supply-pancreas",
                "text": "Pancreas",
                "group": "supply",
                "why": "Its digestive juices enter the small intestine."
              }
            ]
          }
        ]
      }
    },
    {
      "id": "model-transfer",
      "type": "GUIDED_EXAMPLE",
      "title": "Crossing a wall does not mean disappearing",
      "purpose": "MODEL_WORKED_EXAMPLE",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Follow the two transfers, compare the graph with the tokens, and account for all twelve tokens in both regions.",
      "content": {
        "body": "Draw two regions: inside the small intestine, and the rest of the body. Use twelve large paper tokens for already-digested nutrients. Move five across the boundary, then five more. Keep transferred tokens in the body region. This represents absorption, not whole food leaving the stomach. The counts are invented for the model; they are not a human absorption rate."
      },
      "interaction": {
        "kind": "NONE"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [],
      "misconceptionIds": [
        "stomach-absorbs-everything"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Draw two regions: inside the small intestine, and the rest of the body. Use twelve large paper tokens for already-digested nutrients. Move five across the boundary, then five more. Keep transferred tokens in the body region. This represents absorption, not whole food leaving the stomach. The counts are invented for the model; they are not a human absorption rate. Illustrative tokens left inside the model intestine. Transfer round 0 round: Tokens inside 12 tokens; Transfer round 1 round: Tokens inside 7 tokens; Transfer round 2 round: Tokens inside 2 tokens. The ten transferred tokens still exist in the model's body region. Rounds are model actions, not minutes. Where are all twelve model tokens after both transfers? Step 1: Ten tokens crossed to the body region; two remained inside the tube. 12 − 5 − 5 = 2 Step 2: Both regions still contain the original total together. 10 + 2 = 12",
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
        "phase": "ORIENT",
        "blocks": [
          {
            "type": "DATA_PLOT",
            "id": "model-token-count",
            "title": "Illustrative tokens left inside the model intestine",
            "x": {
              "label": "Transfer round",
              "unit": "round"
            },
            "y": {
              "label": "Tokens inside",
              "unit": "tokens"
            },
            "series": [
              {
                "x": 0,
                "y": 12
              },
              {
                "x": 1,
                "y": 7
              },
              {
                "x": 2,
                "y": 2
              }
            ],
            "data": {
              "kind": "ILLUSTRATIVE",
              "note": "Invented paper-model counts, not measurements of human digestion."
            },
            "caption": "The ten transferred tokens still exist in the model's body region. Rounds are model actions, not minutes."
          },
          {
            "type": "WORKED_SOLUTION",
            "id": "account-for-tokens",
            "problem": "Where are all twelve model tokens after both transfers?",
            "steps": [
              {
                "text": "Ten tokens crossed to the body region; two remained inside the tube.",
                "tex": "12-5-5=2"
              },
              {
                "text": "Both regions still contain the original total together.",
                "tex": "10+2=12"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "try-transfer",
      "type": "PRACTICE",
      "title": "Operate and check your own paper model",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Move the nine tokens, record both counts and explain what the boundary crossing represents.",
      "content": {
        "body": "Use fourteen large paper tokens, drawn marks or counters too large to swallow. Mark an inside region and a body region. Move nine tokens across the wall. Keep every token visible. A crossing changes its region, not whether it exists. Starting, transferred and remaining counts describe different groups. Count both regions before answering. A partner may move tokens while you direct. Keep objects away from mouths."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "try-transfer-response-0",
            "prompt": "Explain what one crossing models. Name one thing these paper tokens do not show about a real intestine.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "The starting count includes both regions. A transferred token is no longer inside.",
        "A token that crosses remains visible in the body region. Add both regions to check the total."
      ],
      "misconceptionIds": [
        "starting-vs-remaining",
        "absorbed-nutrients-disappear"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Use fourteen large paper tokens, drawn marks or counters too large to swallow. Mark an inside region and a body region. Move nine tokens across the wall. Keep every token visible. A crossing changes its region, not whether it exists. Starting, transferred and remaining counts describe different groups. Count both regions before answering. A partner may move tokens while you direct. Keep objects away from mouths. Account for the paper-model tokens. Tokens still inside after nine of fourteen cross: write your answer. Total tokens in both regions: write your answer. Explain what one crossing models. Name one thing these paper tokens do not show about a real intestine.",
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
        "phase": "EXPERIMENT",
        "blocks": [
          {
            "type": "NUMERIC_RESPONSE",
            "id": "guided-model-count",
            "mode": "GUIDED",
            "prompt": "Account for the paper-model tokens.",
            "parts": [
              {
                "id": "guided-model-count-0",
                "label": "Tokens still inside after nine of fourteen cross",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 5
                },
                "misconceptions": [
                  {
                    "value": 14,
                    "feedback": "The nine transferred tokens are in the body region. Count only the tokens still inside the tube.",
                    "misconceptionId": "starting-vs-remaining"
                  }
                ]
              },
              {
                "id": "guided-model-count-1",
                "label": "Total tokens in both regions",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 14
                },
                "misconceptions": [
                  {
                    "value": 5,
                    "feedback": "Five remain inside, but nine still exist in the other region. Include both regions in the total.",
                    "misconceptionId": "absorbed-nutrients-disappear"
                  }
                ]
              }
            ],
            "hints": [
              "Track both regions, then check that their counts add to the starting total."
            ],
            "afterAttempt": [
              "Tokens still inside after nine of fourteen cross: 5. The nine transferred tokens are in the body region. Count only the tokens still inside the tube.",
              "Total tokens in both regions: 14. Five remain inside, but nine still exist in the other region. Include both regions in the total."
            ]
          }
        ]
      }
    },
    {
      "id": "independent-model",
      "type": "PRACTICE",
      "title": "Interpret a new model independently",
      "purpose": "INDEPENDENT_PRACTICE",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Determine the tokens left inside after each round, then explain where the rest are and why the model total stays constant.",
      "content": {
        "body": "A different paper model starts with sixteen nutrient tokens inside. Five cross during the first round, then eight more cross during the second. Use a drawing or paper tokens independently. These specified movements describe a model, not observations of a real person's digestion."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "independent-model-response-0",
            "prompt": "Where are the tokens that crossed? Explain what the model can show about absorption and why it cannot tell you a real digestion time.",
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
        "transferred-vs-remaining",
        "absorbed-nutrients-disappear"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "A different paper model starts with sixteen nutrient tokens inside. Five cross during the first round, then eight more cross during the second. Use a drawing or paper tokens independently. These specified movements describe a model, not observations of a real person's digestion. Find the count still inside after each round. After the first round: write your answer. After the second round: write your answer. Where are the tokens that crossed? Explain what the model can show about absorption and why it cannot tell you a real digestion time.",
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
        "phase": "OBSERVE",
        "blocks": [
          {
            "type": "NUMERIC_RESPONSE",
            "id": "independent-model-count",
            "mode": "INDEPENDENT",
            "prompt": "Find the count still inside after each round.",
            "parts": [
              {
                "id": "independent-model-count-0",
                "label": "After the first round",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 11
                },
                "misconceptions": [
                  {
                    "value": 5,
                    "feedback": "Five is the count transferred. The question asks what remains inside.",
                    "misconceptionId": "transferred-vs-remaining"
                  }
                ]
              },
              {
                "id": "independent-model-count-1",
                "label": "After the second round",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 3
                },
                "misconceptions": [
                  {
                    "value": 8,
                    "feedback": "Eight is the second transferred group. Subtract both transferred groups from the starting count.",
                    "misconceptionId": "transferred-vs-remaining"
                  }
                ]
              }
            ],
            "hints": [],
            "afterAttempt": [
              "After the first round: 11. Five is the count transferred. The question asks what remains inside.",
              "After the second round: 3. Eight is the second transferred group. Subtract both transferred groups from the starting count."
            ]
          }
        ]
      }
    },
    {
      "id": "explain-model",
      "type": "PRACTICE",
      "title": "Separate a model from evidence about a body",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o1",
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Choose the statement that matches the model and identify a claim that would need different evidence.",
      "content": {
        "body": "Compare your first route with the organ model. Explain a change using the job of an organ. The token model helps show a transfer across a wall. It does not reproduce living tissue or measure how quickly a person's body absorbs a meal."
      },
      "interaction": {
        "kind": "NONE"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Separate a path through an organ from a juice entering that path.",
        "Counted paper tokens can represent a transfer but cannot measure living tissue."
      ],
      "misconceptionIds": [
        "food-through-support-organs",
        "stomach-absorbs-everything"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Compare your first route with the organ model. Explain a change using the job of an organ. The token model helps show a transfer across a wall. It does not reproduce living tissue or measure how quickly a person's body absorbs a meal. What does moving a nutrient token into the body region represent? Options: A digested nutrient crossing the small-intestine wall.; The nutrient ceasing to exist.; A whole mouthful passing directly from stomach to liver.. Which claim cannot be established with this paper model? Options: The original tokens can be counted across two regions.; The specified transfers leave three of sixteen tokens inside.; Every pupil absorbs a real meal in exactly two minutes..",
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
        "phase": "EXPLAIN",
        "blocks": [
          {
            "type": "CHECK",
            "id": "absorption-explanation",
            "items": [
              {
                "id": "absorption-explanation-item",
                "prompt": "What does moving a nutrient token into the body region represent?",
                "options": [
                  {
                    "id": "opt-7ccaeb16ea98",
                    "text": "A digested nutrient crossing the small-intestine wall.",
                    "feedback": "The boundary between the two regions represents the wall across which absorption occurs."
                  },
                  {
                    "id": "opt-d5c858d2dfb1",
                    "text": "The nutrient ceasing to exist.",
                    "feedback": "The token remains in the other region; the model does not destroy it."
                  },
                  {
                    "id": "opt-7a8ab4fe6517",
                    "text": "A whole mouthful passing directly from stomach to liver.",
                    "feedback": "This changes both the route and what the token represents."
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-7ccaeb16ea98"
                },
                "misconceptionId": "stomach-absorbs-everything"
              }
            ]
          },
          {
            "type": "CHECK",
            "id": "model-limit",
            "items": [
              {
                "id": "model-limit-item",
                "prompt": "Which claim cannot be established with this paper model?",
                "options": [
                  {
                    "id": "opt-53af30f68e5f",
                    "text": "The original tokens can be counted across two regions.",
                    "feedback": "The two regions and tokens are visible parts of the model."
                  },
                  {
                    "id": "opt-cf7daeb0f74e",
                    "text": "The specified transfers leave three of sixteen tokens inside.",
                    "feedback": "The model permits you to check this count directly."
                  },
                  {
                    "id": "opt-ade3022f7db3",
                    "text": "Every pupil absorbs a real meal in exactly two minutes.",
                    "feedback": "Model transfer rounds are not a measurement of anyone's digestion time."
                  }
                ],
                "formativeKey": {
                  "expectedOptionId": "opt-ade3022f7db3"
                },
                "misconceptionId": "stomach-absorbs-everything"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "poster-transfer",
      "type": "PRACTICE",
      "title": "Improve the Buchanan school group's poster",
      "purpose": "INDEPENDENT_PRACTICE",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o1",
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Write or dictate 30 to 60 words correcting both claims and explaining one limitation of your model.",
      "content": {
        "body": "The fictional poster says: Food passes through the liver before reaching the stomach. The stomach absorbs all nutrients. Use the route and transfer models to replace both claims. Explain the corrections so a younger reader could follow them, while keeping the diagram's limits clear."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "poster-transfer-response-0",
            "prompt": "Correct the two poster claims using the connected route and the job of the small intestine. State one limitation. For an advanced challenge, design a clearer model that distinguishes breaking food down from absorbing the resulting nutrients, and explain how you would check its clarity.",
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
        "food-through-support-organs",
        "stomach-absorbs-everything"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "The fictional poster says: Food passes through the liver before reaching the stomach. The stomach absorbs all nutrients. Use the route and transfer models to replace both claims. Explain the corrections so a younger reader could follow them, while keeping the diagram's limits clear. Correct the two poster claims using the connected route and the job of the small intestine. State one limitation. For an advanced challenge, design a clearer model that distinguishes breaking food down from absorbing the resulting nutrients, and explain how you would check its clarity.",
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
        "phase": "APPLY",
        "blocks": []
      }
    },
    {
      "id": "independent-explanation",
      "type": "MASTERY_CHECK",
      "title": "Independent assessment unavailable",
      "purpose": "ASSESS_MASTERY",
      "objectiveIds": [
        "g4-science-food-path-and-absorption-o1",
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "learnerAction": "Review your model explanation.",
      "content": {
        "body": "No independent assessment is available in this draft."
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
            "objectiveId": "g4-science-food-path-and-absorption-o1",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          },
          {
            "responseKey": "future-1",
            "objectiveId": "g4-science-food-path-and-absorption-o2",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          },
          {
            "responseKey": "future-2",
            "objectiveId": "g4-science-food-path-and-absorption-o3",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          }
        ]
      },
      "accessibility": {
        "textAlternative": "No independent assessment is available in this draft.",
        "keyboardPath": "Use the independently supplied assessment controls when available.",
        "reducedMotion": "NOT_APPLICABLE"
      },
      "offline": {
        "mode": "FULL_OFFLINE",
        "note": "No independent assessment is available in this draft."
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
        "g4-science-food-path-and-absorption-o1",
        "g4-science-food-path-and-absorption-o2",
        "g4-science-food-path-and-absorption-o3"
      ],
      "interaction": "FREE_RESPONSE",
      "evidenceType": "QUIZ",
      "difficulty": "CORE",
      "misconceptionIds": [
        "food-through-support-organs",
        "stomach-absorbs-everything",
        "absorbed-nutrients-disappear",
        "starting-vs-remaining",
        "transferred-vs-remaining"
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

Model food's path and explain absorption

Where does a mouthful go?

A fictional school group in Buchanan is preparing a poster about what happens after eating rice. Before using the poster, sketch your own idea of the route. Keep your first drawing so that you can later explain a change. What route do you predict, and where might useful parts leave it? Label one uncertainty in your first model.

What route do you predict, and where might useful parts leave it? Label one uncertainty in your first model.
Response: __________________________

Build a connected food route

Use large paper cards and a paper food token. Move the token from mouth to anus through the route you arrange. Chewing starts breakdown; the esophagus moves food; the stomach mixes it. Digestion continues in the small intestine, where most nutrients are absorbed. The large intestine absorbs water. Its rectum stores stool before it leaves through the anus. The liver and pancreas supply juices; swallowed food does not pass through them. Order the simplified main stages. The rectum is the final part of the large intestine. organ: Mouth. organ: Esophagus. organ: Stomach. organ: Small intestine. organ: Large intestine. organ part: Rectum. opening: Anus. Separate the food route from organs supplying juices. Groups: Swallowed food passes through, Supplies juices to the route. Cards: Stomach, Small intestine, Liver, Pancreas.

Follow the connected tube from the mouth through the stomach and intestines.

An organ can supply a juice without being a place the swallowed food passes through.

Crossing a wall does not mean disappearing

Draw two regions: inside the small intestine, and the rest of the body. Use twelve large paper tokens for already-digested nutrients. Move five across the boundary, then five more. Keep transferred tokens in the body region. This represents absorption, not whole food leaving the stomach. The counts are invented for the model; they are not a human absorption rate. Illustrative tokens left inside the model intestine. Transfer round 0 round: Tokens inside 12 tokens; Transfer round 1 round: Tokens inside 7 tokens; Transfer round 2 round: Tokens inside 2 tokens. The ten transferred tokens still exist in the model's body region. Rounds are model actions, not minutes. Where are all twelve model tokens after both transfers? Step 1: Ten tokens crossed to the body region; two remained inside the tube. 12 − 5 − 5 = 2 Step 2: Both regions still contain the original total together. 10 + 2 = 12

Operate and check your own paper model

Use fourteen large paper tokens, drawn marks or counters too large to swallow. Mark an inside region and a body region. Move nine tokens across the wall. Keep every token visible. A crossing changes its region, not whether it exists. Starting, transferred and remaining counts describe different groups. Count both regions before answering. A partner may move tokens while you direct. Keep objects away from mouths. Account for the paper-model tokens. Tokens still inside after nine of fourteen cross: write your answer. Total tokens in both regions: write your answer. Explain what one crossing models. Name one thing these paper tokens do not show about a real intestine.

The starting count includes both regions. A transferred token is no longer inside.

A token that crosses remains visible in the body region. Add both regions to check the total.

Explain what one crossing models. Name one thing these paper tokens do not show about a real intestine.
Response: __________________________

Interpret a new model independently

A different paper model starts with sixteen nutrient tokens inside. Five cross during the first round, then eight more cross during the second. Use a drawing or paper tokens independently. These specified movements describe a model, not observations of a real person's digestion. Find the count still inside after each round. After the first round: write your answer. After the second round: write your answer. Where are the tokens that crossed? Explain what the model can show about absorption and why it cannot tell you a real digestion time.

Where are the tokens that crossed? Explain what the model can show about absorption and why it cannot tell you a real digestion time.
Response: __________________________

Separate a model from evidence about a body

Compare your first route with the organ model. Explain a change using the job of an organ. The token model helps show a transfer across a wall. It does not reproduce living tissue or measure how quickly a person's body absorbs a meal. What does moving a nutrient token into the body region represent? Options: A digested nutrient crossing the small-intestine wall.; The nutrient ceasing to exist.; A whole mouthful passing directly from stomach to liver.. Which claim cannot be established with this paper model? Options: The original tokens can be counted across two regions.; The specified transfers leave three of sixteen tokens inside.; Every pupil absorbs a real meal in exactly two minutes..

Separate a path through an organ from a juice entering that path.

Counted paper tokens can represent a transfer but cannot measure living tissue.

Improve the Buchanan school group's poster

The fictional poster says: Food passes through the liver before reaching the stomach. The stomach absorbs all nutrients. Use the route and transfer models to replace both claims. Explain the corrections so a younger reader could follow them, while keeping the diagram's limits clear. Correct the two poster claims using the connected route and the job of the small intestine. State one limitation. For an advanced challenge, design a clearer model that distinguishes breaking food down from absorbing the resulting nutrients, and explain how you would check its clarity.

Correct the two poster claims using the connected route and the job of the small intestine. State one limitation. For an advanced challenge, design a clearer model that distinguishes breaking food down from absorbing the resulting nutrients, and explain how you would check its clarity.
Response: __________________________

Independent assessment unavailable

No independent assessment is available in this draft.
