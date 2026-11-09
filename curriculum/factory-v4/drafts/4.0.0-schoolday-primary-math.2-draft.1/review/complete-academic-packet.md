# Programme batch academic review

Original factory DRAFTs. No academic approval, official assessment, publication or student activation is claimed.

## Multiply hundreds, tens and ones

4.0.0-schoolday-primary-math.2-draft.1 | GO-G04-P1-MATH-U1 | df24c30a680e745006ef124f671a26cccb1bdf64a8ec9f79b3273e8ba4d98eb2

```json

{
  "version": "program-academic-review/1.0.0",
  "state": "DRAFT",
  "authorship": "AI_AUTHORED_DETERMINISTIC_FACTORY_RECIPE",
  "humanSubjectExpertReview": "NOT_PERFORMED",
  "academicApproval": "PENDING_EXACT_VERSION_REVIEW",
  "programOrderId": "GO-G04-P1-MATH-U1",
  "courseId": "stem1-g4-math",
  "unit": 1,
  "sourceOrder": {
    "planId": "stem1-g4-day1",
    "slot": "P1",
    "grade": 4,
    "orderId": "GO-G04-P1-MATH-U1",
    "owner": "T2_CODEX",
    "kind": "LESSON",
    "batch": "BAND_3-5",
    "courseId": "stem1-g4-math",
    "unit": 1,
    "unitTitle": "Multi-digit multiplication",
    "performanceTask": "multiply a 3-digit by a 1-digit number with the area model and an algorithm",
    "family": "MATHEMATICS",
    "pattern": [
      "VISUALIZE",
      "DEMONSTRATE",
      "SOLVE_WITH_SUPPORT",
      "PRACTICE_INDEPENDENTLY",
      "ANALYZE_MISTAKE",
      "APPLY"
    ],
    "recordedSubject": "MATH",
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
    "competencies": null,
    "blocks": {
      "existing": [
        "ARRAY_MODEL",
        "AREA_MODEL",
        "FRACTION_MODEL",
        "FRACTION_NUMBER_LINE",
        "PLACE_VALUE_CHART",
        "WORKED_SOLUTION",
        "NUMERIC_RESPONSE",
        "MISTAKE_ANALYSIS"
      ],
      "proposed": [
        "GRAPH_BUILDER"
      ]
    },
    "labs": [],
    "stemPractices": [
      "CONCEPT_BEFORE_PROCEDURE",
      "MATHEMATICAL_REASONING",
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
      "id": "g4-math-three-digit-products-o1",
      "statement": "Multiply a three-digit whole number by one digit using a partitioned area model and a written calculation.",
      "moeReferences": []
    },
    {
      "id": "g4-math-three-digit-products-o2",
      "statement": "Explain regrouping as preserving place value, including a zero digit in a product or factor.",
      "moeReferences": []
    }
  ],
  "misconceptions": [
    {
      "id": "digits-without-place-value",
      "objectiveId": "g4-math-three-digit-products-o1",
      "description": "The digits of a factor are multiplied as single units and their products are added.",
      "response": "Name the full place values before multiplying: 2 hundreds is 200, not 2."
    },
    {
      "id": "discard-regrouped-value",
      "objectiveId": "g4-math-three-digit-products-o2",
      "description": "Tens or hundreds formed by a partial product are discarded when writing the final digits.",
      "response": "Keep the value of every partial product and regroup it into the correct place rather than deleting it."
    }
  ],
  "answerGuidance": {
    "worked": "For the fictional Nimba County school, 214×3=600+30+12=642. Twelve ones regroup as one ten and two ones; no value is discarded. In column multiplication, write 2 ones and carry 1 ten; the tens column is 1 times 3 plus 1 carried ten, or 4 tens. The hundreds column is 2 times 3, or 6 hundreds.",
    "guided": "The column algorithm for 143 times 3 gives 9 ones, 12 tens regrouped into 2 tens and 1 hundred, then 4 hundreds. Therefore 143×3=429; 208×4=832. Eight ones multiplied by four form 32 ones, or three tens and two ones.",
    "independent": "125×4=500 and 321×6=1926. Check that the 20 ones in the first and the extra hundred within 120 in the second are preserved.",
    "transfer": "For the fictional Bong County rice cooperative, 246×4=984 kilograms of rice, with the tens region 40×4=160. A different partition such as (240+6)×4 gives 960+24=984; accept any complete justified partition."
  },
  "teacherGuide": {
    "proposedMinutes": 45,
    "timingEvidence": "NOT_MEASURED",
    "segments": [
      {
        "minutes": 5,
        "activity": "Inspect and physically represent the arrangement or place values"
      },
      {
        "minutes": 8,
        "activity": "Link the area model with column multiplication and name each carried quantity"
      },
      {
        "minutes": 12,
        "activity": "Guided practice with specific hints and feedback"
      },
      {
        "minutes": 10,
        "activity": "Independent fresh problems"
      },
      {
        "minutes": 5,
        "activity": "Diagnose and explain a plausible error"
      },
      {
        "minutes": 5,
        "activity": "Transfer and explain a connection"
      }
    ],
    "support": "Use labelled hundreds/tens/ones cards and one partial product at a time. Accept a scribed explanation while the pupil directs the quantities and regrouping.",
    "extension": "Calculate 312×7=2184 and 609×5=3045 with two valid partitions. Explain every regrouped quantity, including zero places.",
    "block90Proposal": "After the 45-minute core: compare two partitions for 312×7 and 609×5 for 20 minutes, peer-audit the place values for 15 minutes, then defend why regrouping preserves the total for 10 minutes.",
    "assessment": "The draft requests future independent assessment design but supplies no governed form or protected scoring items. Practice is formative; no official records may be written.",
    "retention": "Request fresh equal-group or place-value problems at least seven days later. No retention event is scheduled or fabricated here."
  },
  "references": [
    {
      "title": "Original LiberiaLearn scenario and mathematical model",
      "use": "Original questions, contexts, computations and diagram parameters; no third-party text or images copied.",
      "rights": "Original educational draft; distribution-rights review pending."
    },
    {
      "title": "OpenStax Prealgebra 2e: Distributive Property",
      "url": "https://openstax.org/books/prealgebra-2e/pages/7-3-distributive-property",
      "use": "Concept reference for distributing multiplication over a partition; not a claimed Liberia standards alignment.",
      "rights": "Reference link only; no external content reproduced."
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
  "title": "Multiply hundreds, tens and ones",
  "instruction": {
    "standard": "liberialearn-v4-instruction/1.0.0",
    "retention": {
      "delayDays": 7,
      "prompts": [
        "Without the worked example, explain: Multiply a three-digit whole number by one digit using a partitioned area model and a written calculation.",
        "Without the worked example, explain: Explain regrouping as preserving place value, including a zero digit in a product or factor."
      ]
    }
  },
  "estimatedMinutes": 45,
  "ageBand": "UPPER_PRIMARY",
  "pedagogy": {
    "primaryStrategy": "GUIDED_TO_INDEPENDENT",
    "rationale": "Connect an area partition to place-value products, use guided checks to diagnose lost place values, and transfer to a community reading-card plan."
  },
  "prerequisiteAssumptions": [
    "Recognize hundreds, tens and ones, recall single-digit multiplication facts and add whole-number quantities."
  ],
  "misconceptions": [
    {
      "id": "digits-without-place-value",
      "objectiveId": "g4-math-three-digit-products-o1",
      "description": "The digits of a factor are multiplied as single units and their products are added.",
      "response": "Name the full place values before multiplying: 2 hundreds is 200, not 2."
    },
    {
      "id": "discard-regrouped-value",
      "objectiveId": "g4-math-three-digit-products-o2",
      "description": "Tens or hundreds formed by a partial product are discarded when writing the final digits.",
      "response": "Keep the value of every partial product and regroup it into the correct place rather than deleting it."
    }
  ],
  "scenes": [
    {
      "id": "see-place-values",
      "type": "EXPLANATION",
      "title": "Partition a larger factor",
      "purpose": "EXPLAIN_CONCEPT",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Inspect the hundreds, tens and ones regions and identify which product counts each region.",
      "content": {
        "body": "A fictional school in Nimba County plans three exercise books for each of 214 pupils. Split 214 pupils into groups of 200, 10 and 4. Each group needs three books per pupil; the three regions together count the whole order."
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
        "digits-without-place-value",
        "discard-regrouped-value"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "A fictional school in Nimba County plans three exercise books for each of 214 pupils. Split 214 pupils into groups of 200, 10 and 4. Each group needs three books per pupil; the three regions together count the whole order. Connect each region to its full place-value quantities. Find 214 × 3 by splitting it into parts.",
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
        "phase": "VISUALIZE",
        "blocks": [
          {
            "type": "AREA_MODEL",
            "id": "hundreds-tens-ones",
            "mode": "SHOW",
            "factorA": 214,
            "factorB": 3,
            "splitA": [
              200,
              10,
              4
            ],
            "prompt": "Connect each region to its full place-value quantities."
          }
        ]
      }
    },
    {
      "id": "worked-product",
      "type": "GUIDED_EXAMPLE",
      "title": "Connect the model to the written calculation",
      "purpose": "MODEL_WORKED_EXAMPLE",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Reveal the partial products and explain where the extra ten from twelve ones belongs.",
      "content": {
        "body": "Multiply each full quantity by three. Twelve ones can be regrouped as one ten and two ones. Regrouping does not create or remove books; it is another way to name the same value."
      },
      "interaction": {
        "kind": "NONE"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Name the value of the 2 in 214 before multiplying it.",
        "Keep the whole value of 4×3, including the ten it contains."
      ],
      "misconceptionIds": [
        "digits-without-place-value",
        "discard-regrouped-value"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Multiply each full quantity by three. Twelve ones can be regrouped as one ten and two ones. Regrouping does not create or remove books; it is another way to name the same value. Find three exercise books for each of 214 pupils. Step 1: Multiply each place-value quantity. 214 × 3 = (200 × 3) + (10 × 3) + (4 × 3) Step 2: Combine the complete partial products. 600 + 30 + 12 = 642 Step 3: Regroup twelve ones without losing their value. 600 + 40 + 2 = 642",
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
        "phase": "DEMONSTRATE",
        "blocks": [
          {
            "type": "WORKED_SOLUTION",
            "id": "three-digit-worked",
            "problem": "Find three exercise books for each of 214 pupils.",
            "steps": [
              {
                "text": "Multiply each place-value quantity.",
                "tex": "214\\times3=(200\\times3)+(10\\times3)+(4\\times3)"
              },
              {
                "text": "Combine the complete partial products.",
                "tex": "600+30+12=642"
              },
              {
                "text": "Regroup twelve ones without losing their value.",
                "tex": "600+40+2=642"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "column-algorithm",
      "type": "GUIDED_EXAMPLE",
      "title": "Connect the regions to column multiplication",
      "purpose": "MODEL_WORKED_EXAMPLE",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Reveal the column calculation and explain how the carried ten comes from the ones region.",
      "content": {
        "body": "Keep hundreds, tens and ones in separate columns. Start at the ones. Four ones times three is twelve ones: write two ones and carry one ten. One ten times three plus the carried ten is four tens. Two hundreds times three is six hundreds. These columns name the same 642 books as the three regions.\n\n| Row | Hundreds | Tens | Ones |\n| --- | --- | --- | --- |\n| Carried value | | 1 | |\n| Pupils | 2 | 1 | 4 |\n| Multiply by | | | 3 |\n| Books | 6 | 4 | 2 |"
      },
      "interaction": {
        "kind": "NONE"
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "The carried 1 means one ten, not one extra one.",
        "Match the ones-region product of twelve with two ones plus one ten."
      ],
      "misconceptionIds": [
        "digits-without-place-value",
        "discard-regrouped-value"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Keep hundreds, tens and ones in separate columns. Start at the ones. Four ones times three is twelve ones: write two ones and carry one ten. One ten times three plus the carried ten is four tens. Two hundreds times three is six hundreds. These columns name the same 642 books as the three regions.\n\n| Row | Hundreds | Tens | Ones |\n| --- | --- | --- | --- |\n| Carried value | | 1 | |\n| Pupils | 2 | 1 | 4 |\n| Multiply by | | | 3 |\n| Books | 6 | 4 | 2 | Write 214 times 3 in hundreds, tens and ones columns. Step 1: Align the place-value columns. 214 × 3 Step 2: Ones: keep two ones and carry one ten. 4 × 3 = 12 = 10 + 2 Step 3: Tens: add the carried ten to the three tens. (1 × 3) + 1 = 4 tens Step 4: Hundreds: six hundreds complete the result. 600 + 40 + 2 = 642",
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
        "phase": "ORIENT",
        "blocks": [
          {
            "type": "WORKED_SOLUTION",
            "id": "column-worked",
            "problem": "Write 214 times 3 in hundreds, tens and ones columns.",
            "steps": [
              {
                "text": "Align the place-value columns.",
                "tex": "214\\times3"
              },
              {
                "text": "Ones: keep two ones and carry one ten.",
                "tex": "4\\times3=12=10+2"
              },
              {
                "text": "Tens: add the carried ten to the three tens.",
                "tex": "(1\\times3)+1=4\\text{ tens}"
              },
              {
                "text": "Hundreds: six hundreds complete the result.",
                "tex": "600+40+2=642"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "guided-products",
      "type": "PRACTICE",
      "title": "Keep the zero place and the regrouped value",
      "purpose": "GUIDED_PRACTICE",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Write the column algorithm for 143 times 3, find both totals, then determine how many tens are formed by eight ones multiplied by four.",
      "content": {
        "body": "Try 143 times 3 and 208 times 4. In 208, there are no tens to start with, but multiplying the eight ones can still create tens. A zero digit is not permission to discard value created elsewhere."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "guided-products-response-0",
            "prompt": "Show 143 times 3 in columns. Name the value of the carried 1 when twelve tens are regrouped. Use the area partition to check your result.",
            "minLength": 20
          }
        ]
      },
      "tools": {
        "requested": [],
        "prohibited": []
      },
      "hints": [
        "Write the factor as hundreds plus tens plus ones, using full quantities.",
        "Thirty-two ones can be named as three tens and two ones."
      ],
      "misconceptionIds": [
        "digits-without-place-value",
        "discard-regrouped-value"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Try 143 times 3 and 208 times 4. In 208, there are no tens to start with, but multiplying the eight ones can still create tens. A zero digit is not permission to discard value created elsewhere. Calculate and interpret the products. 143 times 3: write your answer. 208 times 4: write your answer. Tens formed by 8 times 4 ones: write your answer. Show 143 times 3 in columns. Name the value of the carried 1 when twelve tens are regrouped. Use the area partition to check your result.",
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
        "phase": "SOLVE_WITH_SUPPORT",
        "blocks": [
          {
            "type": "NUMERIC_RESPONSE",
            "id": "guided-three-digit",
            "mode": "GUIDED",
            "prompt": "Calculate and interpret the products.",
            "parts": [
              {
                "id": "guided-three-digit-0",
                "label": "143 times 3",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 429
                },
                "misconceptions": [
                  {
                    "value": 24,
                    "feedback": "The 1 names 100 and the 4 names 40. Their products are 300 and 120, not 3 and 12.",
                    "misconceptionId": "digits-without-place-value"
                  }
                ]
              },
              {
                "id": "guided-three-digit-1",
                "label": "208 times 4",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 832
                },
                "misconceptions": [
                  {
                    "value": 40,
                    "feedback": "Two hundreds times four is 800; treating the 2 as two ones loses the hundreds.",
                    "misconceptionId": "digits-without-place-value"
                  }
                ]
              },
              {
                "id": "guided-three-digit-2",
                "label": "Tens formed by 8 times 4 ones",
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
                    "value": 0,
                    "feedback": "Eight ones times four makes 32 ones: three tens and two ones, even though the starting tens digit was zero.",
                    "misconceptionId": "discard-regrouped-value"
                  }
                ]
              }
            ],
            "hints": [
              "Partition the larger factor into full hundreds, tens and ones; retain every regrouped quantity."
            ],
            "afterAttempt": [
              "143 times 3: 429. The 1 names 100 and the 4 names 40. Their products are 300 and 120, not 3 and 12.",
              "208 times 4: 832. Two hundreds times four is 800; treating the 2 as two ones loses the hundreds.",
              "Tens formed by 8 times 4 ones: 3. Eight ones times four makes 32 ones: three tens and two ones, even though the starting tens digit was zero."
            ]
          }
        ]
      }
    },
    {
      "id": "independent-products",
      "type": "PRACTICE",
      "title": "Solve two new products independently",
      "purpose": "INDEPENDENT_PRACTICE",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Show column multiplication and an area-partition check for 125 times 4. Calculate 321 times 6 and explain every regrouped value independently.",
      "content": {
        "body": "Use column multiplication for 125 times 4. Use a partitioned calculation to check it, then choose either method for 321 times 6. Check that both methods preserve all the place-value quantities, especially when a final digit is zero."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "independent-products-response-0",
            "prompt": "Show the column calculation for 125 times 4 and identify each carried quantity. Check it by adding the area-model partial products. Explain why the zero digits in the answer preserve the full value.",
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
        "digits-without-place-value",
        "discard-regrouped-value"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "Use column multiplication for 125 times 4. Use a partitioned calculation to check it, then choose either method for 321 times 6. Check that both methods preserve all the place-value quantities, especially when a final digit is zero. Find each product. 125 times 4: write your answer. 321 times 6: write your answer. Show the column calculation for 125 times 4 and identify each carried quantity. Check it by adding the area-model partial products. Explain why the zero digits in the answer preserve the full value.",
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
        "phase": "PRACTICE_INDEPENDENTLY",
        "blocks": [
          {
            "type": "NUMERIC_RESPONSE",
            "id": "independent-three-digit",
            "mode": "INDEPENDENT",
            "prompt": "Find each product.",
            "parts": [
              {
                "id": "independent-three-digit-0",
                "label": "125 times 4",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 500
                },
                "misconceptions": [
                  {
                    "value": 480,
                    "feedback": "The 20 ones formed by 5×4 contribute two tens. Dropping those two tens leaves 480 instead of the complete value.",
                    "misconceptionId": "discard-regrouped-value"
                  }
                ]
              },
              {
                "id": "independent-three-digit-1",
                "label": "321 times 6",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 1926
                },
                "misconceptions": [
                  {
                    "value": 1826,
                    "feedback": "The 120 from 20×6 includes an additional hundred. Keep it when combining with 300×6 and 1×6.",
                    "misconceptionId": "discard-regrouped-value"
                  }
                ]
              }
            ],
            "hints": [],
            "afterAttempt": [
              "125 times 4: 500. The 20 ones formed by 5×4 contribute two tens. Dropping those two tens leaves 480 instead of the complete value.",
              "321 times 6: 1926. The 120 from 20×6 includes an additional hundred. Keep it when combining with 300×6 and 1×6."
            ]
          }
        ]
      }
    },
    {
      "id": "regrouping-diagnosis",
      "type": "PRACTICE",
      "title": "Find the value that disappeared",
      "purpose": "ADDRESS_MISCONCEPTION",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Identify how the twenty ones affect the tens and hundreds places, and justify the corrected total.",
      "content": {
        "body": "A pupil writes 125 times 4 as 480 after forming 400, 80 and 20. The partial products were correct, but the last combination lost part of the value. Explain how to repair the combination."
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
        "digits-without-place-value",
        "discard-regrouped-value"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "A pupil writes 125 times 4 as 480 after forming 400, 80 and 20. The partial products were correct, but the last combination lost part of the value. Explain how to repair the combination. Combine the partial products 400, 80 and 20. A fictional pupil wrote: 400 + 80 + 20 = 480 Which correction preserves every partial product? Options: Ignore 20 because its ones digit is zero.; Combine 80 and 20 as 100, then add it to 400.; Append 20 to 480 to make 48020..",
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
        "phase": "ANALYZE_MISTAKE",
        "blocks": [
          {
            "type": "MISTAKE_ANALYSIS",
            "id": "lost-value-diagnosis",
            "problem": "Combine the partial products 400, 80 and 20.",
            "attempt": {
              "name": "A fictional pupil",
              "steps": [
                "400 + 80 + 20 = 480"
              ]
            },
            "question": "Which correction preserves every partial product?",
            "options": [
              {
                "id": "drop-zero",
                "text": "Ignore 20 because its ones digit is zero.",
                "feedback": "The zero ones digit does not remove the two tens represented by 20."
              },
              {
                "id": "preserve-tens",
                "text": "Combine 80 and 20 as 100, then add it to 400.",
                "feedback": "The tens combine to make another hundred, giving a total of 500."
              },
              {
                "id": "append-digits",
                "text": "Append 20 to 480 to make 48020.",
                "feedback": "Appending digits changes place values. Add the quantities instead."
              }
            ],
            "formativeKey": {
              "expectedOptionId": "preserve-tens"
            },
            "correction": [
              "400+80+20=400+100=500."
            ],
            "misconceptionId": "discard-regrouped-value"
          }
        ]
      }
    },
    {
      "id": "reading-project",
      "type": "PRACTICE",
      "title": "Plan a rice delivery in Bong County",
      "purpose": "INDEPENDENT_PRACTICE",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Find the total kilograms, explain what 40×4 counts and compare a second valid calculation as an advanced challenge.",
      "content": {
        "body": "A fictional community rice cooperative in Bong County packs 246 bags with four kilograms of rice in each bag. The team must plan the total mass for delivery. Use a complete calculation and explain one partial product so another pupil can check the plan."
      },
      "interaction": {
        "kind": "FREE_RESPONSE",
        "prompts": [
          {
            "id": "reading-project-response-0",
            "prompt": "Explain what the 40×4 region counts and why all partial products must be kept. For an advanced challenge, show a second valid partition of 246 and prove that the total stays the same.",
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
        "digits-without-place-value",
        "discard-regrouped-value"
      ],
      "evidence": {
        "kind": "NONE"
      },
      "accessibility": {
        "textAlternative": "A fictional community rice cooperative in Bong County packs 246 bags with four kilograms of rice in each bag. The team must plan the total mass for delivery. Use a complete calculation and explain one partial product so another pupil can check the plan. What total mass of rice is planned? Kilograms of rice: write your answer. Explain what the 40×4 region counts and why all partial products must be kept. For an advanced challenge, show a second valid partition of 246 and prove that the total stays the same.",
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
        "blocks": [
          {
            "type": "NUMERIC_RESPONSE",
            "id": "rice-delivery-transfer",
            "mode": "INDEPENDENT",
            "prompt": "What total mass of rice is planned?",
            "parts": [
              {
                "id": "rice-delivery-transfer-0",
                "label": "Kilograms of rice",
                "quantity": "OTHER",
                "unit": {
                  "kind": "NONE",
                  "base": ""
                },
                "formativeKey": {
                  "value": 984
                },
                "misconceptions": [
                  {
                    "value": 864,
                    "feedback": "The forty-bag region is 40×4=160. Treating it as only 40 discards part of the plan.",
                    "misconceptionId": "digits-without-place-value"
                  }
                ]
              }
            ],
            "hints": [],
            "afterAttempt": [
              "Kilograms of rice: 984. The forty-bag region is 40×4=160. Treating it as only 40 discards part of the plan."
            ]
          }
        ]
      }
    },
    {
      "id": "independent-explanation",
      "type": "MASTERY_CHECK",
      "title": "Independent assessment unavailable",
      "purpose": "ASSESS_MASTERY",
      "objectiveIds": [
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "learnerAction": "Review your practice calculation.",
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
            "objectiveId": "g4-math-three-digit-products-o1",
            "responseType": "ASSESSMENT_RESPONSE",
            "scaffoldLevel": "NONE"
          },
          {
            "responseKey": "future-1",
            "objectiveId": "g4-math-three-digit-products-o2",
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
        "g4-math-three-digit-products-o1",
        "g4-math-three-digit-products-o2"
      ],
      "interaction": "FREE_RESPONSE",
      "evidenceType": "QUIZ",
      "difficulty": "CORE",
      "misconceptionIds": [
        "digits-without-place-value",
        "discard-regrouped-value"
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

Multiply hundreds, tens and ones

Partition a larger factor

A fictional school in Nimba County plans three exercise books for each of 214 pupils. Split 214 pupils into groups of 200, 10 and 4. Each group needs three books per pupil; the three regions together count the whole order. Connect each region to its full place-value quantities. Find 214 × 3 by splitting it into parts.

Connect the model to the written calculation

Multiply each full quantity by three. Twelve ones can be regrouped as one ten and two ones. Regrouping does not create or remove books; it is another way to name the same value. Find three exercise books for each of 214 pupils. Step 1: Multiply each place-value quantity. 214 × 3 = (200 × 3) + (10 × 3) + (4 × 3) Step 2: Combine the complete partial products. 600 + 30 + 12 = 642 Step 3: Regroup twelve ones without losing their value. 600 + 40 + 2 = 642

Name the value of the 2 in 214 before multiplying it.

Keep the whole value of 4×3, including the ten it contains.

Connect the regions to column multiplication

Keep hundreds, tens and ones in separate columns. Start at the ones. Four ones times three is twelve ones: write two ones and carry one ten. One ten times three plus the carried ten is four tens. Two hundreds times three is six hundreds. These columns name the same 642 books as the three regions.

| Row | Hundreds | Tens | Ones |
| --- | --- | --- | --- |
| Carried value | | 1 | |
| Pupils | 2 | 1 | 4 |
| Multiply by | | | 3 |
| Books | 6 | 4 | 2 | Write 214 times 3 in hundreds, tens and ones columns. Step 1: Align the place-value columns. 214 × 3 Step 2: Ones: keep two ones and carry one ten. 4 × 3 = 12 = 10 + 2 Step 3: Tens: add the carried ten to the three tens. (1 × 3) + 1 = 4 tens Step 4: Hundreds: six hundreds complete the result. 600 + 40 + 2 = 642

The carried 1 means one ten, not one extra one.

Match the ones-region product of twelve with two ones plus one ten.

Keep the zero place and the regrouped value

Try 143 times 3 and 208 times 4. In 208, there are no tens to start with, but multiplying the eight ones can still create tens. A zero digit is not permission to discard value created elsewhere. Calculate and interpret the products. 143 times 3: write your answer. 208 times 4: write your answer. Tens formed by 8 times 4 ones: write your answer. Show 143 times 3 in columns. Name the value of the carried 1 when twelve tens are regrouped. Use the area partition to check your result.

Write the factor as hundreds plus tens plus ones, using full quantities.

Thirty-two ones can be named as three tens and two ones.

Show 143 times 3 in columns. Name the value of the carried 1 when twelve tens are regrouped. Use the area partition to check your result.
Response: __________________________

Solve two new products independently

Use column multiplication for 125 times 4. Use a partitioned calculation to check it, then choose either method for 321 times 6. Check that both methods preserve all the place-value quantities, especially when a final digit is zero. Find each product. 125 times 4: write your answer. 321 times 6: write your answer. Show the column calculation for 125 times 4 and identify each carried quantity. Check it by adding the area-model partial products. Explain why the zero digits in the answer preserve the full value.

Show the column calculation for 125 times 4 and identify each carried quantity. Check it by adding the area-model partial products. Explain why the zero digits in the answer preserve the full value.
Response: __________________________

Find the value that disappeared

A pupil writes 125 times 4 as 480 after forming 400, 80 and 20. The partial products were correct, but the last combination lost part of the value. Explain how to repair the combination. Combine the partial products 400, 80 and 20. A fictional pupil wrote: 400 + 80 + 20 = 480 Which correction preserves every partial product? Options: Ignore 20 because its ones digit is zero.; Combine 80 and 20 as 100, then add it to 400.; Append 20 to 480 to make 48020..

Plan a rice delivery in Bong County

A fictional community rice cooperative in Bong County packs 246 bags with four kilograms of rice in each bag. The team must plan the total mass for delivery. Use a complete calculation and explain one partial product so another pupil can check the plan. What total mass of rice is planned? Kilograms of rice: write your answer. Explain what the 40×4 region counts and why all partial products must be kept. For an advanced challenge, show a second valid partition of 246 and prove that the total stays the same.

Explain what the 40×4 region counts and why all partial products must be kept. For an advanced challenge, show a second valid partition of 246 and prove that the total stays the same.
Response: __________________________

Independent assessment unavailable

No independent assessment is available in this draft.
