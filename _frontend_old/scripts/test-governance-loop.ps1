# -----------------------------
# Test Governance Loop Script
# Tests the complete governance workflow
# -----------------------------

param(
  [Parameter(Mandatory=$false)]
  [string]$EwoId = "EWO-TEST-001",

  [Parameter(Mandatory=$false)]
  [string]$Model = "gpt-4"
)

Write-Host "🧪 Testing Governance Loop" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

# Check AJV CLI
try {
  $null = ajv help 2>&1
  Write-Host "✅ AJV CLI is installed" -ForegroundColor Green
} catch {
  Write-Host "❌ AJV CLI not found. Install with: npm install -g ajv-cli" -ForegroundColor Red
  exit 1
}

# Check OpenAI API key
if (-not $env:OPENAI_API_KEY) {
  Write-Host "❌ OPENAI_API_KEY environment variable is not set" -ForegroundColor Red
  exit 1
} else {
  Write-Host "✅ OPENAI_API_KEY is set" -ForegroundColor Green
}

# Paths
$schemaPath = ".\docs\internal\schemas\unified-curriculum-schema.json"
$agent5PromptPath = ".\docs\internal\agents\qa-governance-agent.md"
$resultsDir = ".\FactoryArtifacts\Results"

if (-not (Test-Path $schemaPath)) {
  Write-Host "❌ Schema file not found: $schemaPath" -ForegroundColor Red
  exit 1
} else {
  Write-Host "✅ Schema file found: $schemaPath" -ForegroundColor Green
}

if (-not (Test-Path $agent5PromptPath)) {
  Write-Host "❌ Agent-5 prompt file not found: $agent5PromptPath" -ForegroundColor Red
  exit 1
} else {
  Write-Host "✅ Agent-5 prompt file found: $agent5PromptPath" -ForegroundColor Green
}

if (-not (Test-Path $resultsDir)) {
  New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}

# -----------------------------
# Create a SCHEMA-VALID test LESSON artifact (minimal but passes gates)
# -----------------------------
Write-Host "`n📝 Creating schema-valid Agent-1 test output..." -ForegroundColor Yellow

$agent1OutputPath = Join-Path $resultsDir "$EwoId-Agent-1.json"

$now = (Get-Date).ToString("o")

$testLesson = @{
  metadata = @{
    id         = "LESSON-TEST001"
    version    = "1.0.0"
    created_at = $now
    updated_at = $now
    status     = "draft"
  }
  educational_context = @{
    grade          = 5
    subject        = "MATH"
    cognitive_band = "CORE"
    term           = 1
    week           = 1
  }
  title        = "Grade 5 Math - Place Value & Rounding (Test Lesson)"
  content_type = "LESSON"
  description  = "Offline-first mastery lesson using Liberian contexts (LD market examples)."

  learning_objectives = @(
    @{
      id = "LO-1"
      statement = "Explain the value of digits in a whole number up to 1,000,000 using place value."
      bloom_level = "UNDERSTAND"
      assessment_method = "Short answer + oral explanation"
      success_criteria = @(
        "Correctly names each place value position",
        "Explains why a digit’s value changes by position"
      )
    },
    @{
      id = "LO-2"
      statement = "Round whole numbers to the nearest 10, 100, and 1,000."
      bloom_level = "APPLY"
      assessment_method = "Practice + formative quiz"
      success_criteria = @(
        "Uses correct rounding rule based on next digit",
        "Shows a number line or step explanation"
      )
    },
    @{
      id = "LO-3"
      statement = "Solve real-world Liberia money problems using place value and rounding."
      bloom_level = "APPLY"
      assessment_method = "Word problems"
      success_criteria = @(
        "Identifies important information in the problem",
        "Computes and explains the final answer with units (LD)"
      )
    }
  )

  activities = @(
    @{
      id = "ACT-1"
      type = "VISUAL"
      title = "Place Value Chart (CPA: Pictorial → Abstract)"
      description = "Students build a place value chart and place digits into columns."
      duration_minutes = 12
      offline_capable = $true
      instructions = @{
        student = "Draw a place value chart in your notebook (ones to hundred-thousands). Place digits from the teacher’s numbers into the chart."
        teacher = "Model one example on the board. Ask students to explain digit values using the chart."
      }
      interaction_pattern = "whole_class"
      differentiation = @{
        struggling = "Use numbers up to 10,000 and provide a pre-drawn chart template."
        advanced = "Include numbers up to 1,000,000 and ask for expanded form."
        mixed_literacy = "Use visuals and read instructions aloud; allow oral responses."
      }
    },
    @{
      id = "ACT-2"
      type = "PRACTICE"
      title = "Guided Practice: Rounding with Liberia Market Prices"
      description = "Students round LD prices and explain why."
      duration_minutes = 15
      offline_capable = $true
      instructions = @{
        student = "Round each LD price to the nearest 10, 100, and 1,000. Write one sentence explaining your rounding choice."
        teacher = "Model the first two. Then circulate and ask students 'Which digit decides?'"
      }
      interaction_pattern = "individual"
      differentiation = @{
        struggling = "Start with rounding to nearest 10 only; use number lines."
        advanced = "Add estimation: compare exact total vs rounded total for 5 items."
        mixed_literacy = "Provide a worked example and allow verbal explanation."
      }
    }
  )

  virtual_labs = @(
    @{
      id = "LAB-1"
      type = "SIMULATION"
      title = "Rounding Simulator (Text-Guided)"
      description = "Students simulate rounding using a number line and decision digit."
      implementation_level = "text_guided"
      steps = @(
        @{
          step_number = 1
          instruction = "Write the number and circle the rounding place (10/100/1000)."
          expected_observation = "The rounding digit is identified."
          ai_tutor_hint = "Look at the digit immediately to the right."
          safety_note = ""
        },
        @{
          step_number = 2
          instruction = "Check the next digit: 0–4 round down, 5–9 round up."
          expected_observation = "Student chooses up or down correctly."
          ai_tutor_hint = "5 or more means increase the rounding digit by 1."
          safety_note = ""
        },
        @{
          step_number = 3
          instruction = "Replace all digits to the right with zeros and write final answer."
          expected_observation = "Final rounded number has zeros in correct positions."
          ai_tutor_hint = "Digits after the rounding place become 0."
          safety_note = ""
        }
      )
      household_alternative = "Use bottle caps or beans on a drawn number line to show moving up/down."
      materials_needed = @("Notebook", "Pencil", "Optional: beans/bottle caps")
      analysis_questions = @(
        "Why does the 'next digit' decide the rounding direction?",
        "How does rounding help when shopping at the market?"
      )
    }
  )

  assessments = @(
    @{
      id = "ASM-1"
      type = "FORMATIVE"
      format = "MCQ"
      time_limit_minutes = 10
      mastery_threshold = 0.7
      adaptive = $false
      questions = @(
        @{
          id = "Q1"
          question = "In the number 45,230, what is the value of the digit 5?"
          type = "MCQ"
          points = 1
          difficulty = "D2"
          options = @("5", "50", "500", "5,000")
          correct_answer = "5,000"
          explanation = "The digit 5 is in the thousands place, so it represents 5,000."
          hints = @("Find the place value column for 5.", "Thousands means 1,000s.")
          ai_gradable = $true
        },
        @{
          id = "Q2"
          question = "Round 6,742 to the nearest 100."
          type = "MCQ"
          points = 1
          difficulty = "D2"
          options = @("6,700", "6,800", "6,740", "6,750")
          correct_answer = "6,700"
          explanation = "To round to the nearest 100, look at the tens digit (4). 4 rounds down."
          hints = @("Circle the hundreds digit.", "Check the tens digit to decide up/down.")
          ai_gradable = $true
        },
        @{
          id = "Q3"
          question = "Waterside Market: Rice costs LD 1,985. Round to the nearest 10."
          type = "MCQ"
          points = 1
          difficulty = "D2"
          options = @("LD 1,980", "LD 1,990", "LD 1,900", "LD 2,000")
          correct_answer = "LD 1,990"
          explanation = "Nearest 10: look at the ones digit (5). 5 rounds up."
          hints = @("Nearest 10 depends on the ones digit.", "5 means round up.")
          ai_gradable = $true
        },
        @{
          id = "Q4"
          question = "Which statement is TRUE about place value?"
          type = "MCQ"
          points = 1
          difficulty = "D1"
          options = @(
            "A digit always has the same value.",
            "A digit’s value depends on its position in the number.",
            "Only the first digit matters.",
            "Zeros are never important."
          )
          correct_answer = "A digit’s value depends on its position in the number."
          explanation = "Place value means the position (ones, tens, hundreds…) changes a digit’s value."
          hints = @("Think: ones vs tens.", "Same digit, different column.")
          ai_gradable = $true
        },
        @{
          id = "Q5"
          question = "Round 152,499 to the nearest 1,000."
          type = "MCQ"
          points = 1
          difficulty = "D3"
          options = @("152,000", "153,000", "152,500", "152,400")
          correct_answer = "152,000"
          explanation = "Nearest 1,000: look at the hundreds digit (4). 4 rounds down."
          hints = @("Circle the thousands digit.", "Check the hundreds digit.")
          ai_gradable = $true
        }
      )
      feedback = @{
        correct = "Nice! You used place value and rounding correctly."
        incorrect = "Check the digit to the right of the rounding place and try again."
        partial = "You’re close—show your place value reasoning."
      }
    }
  )

  cultural_context = @{
    local_examples = @(
      "Using Liberian Dollars (LD) at Waterside Market to estimate prices",
      "Buying rice, pepper, and oil in a local community market",
      "Comparing distances and towns in Montserrado County"
    )
    language_notes = "Use clear simple English; allow learners to explain in Liberian English/Koloqua style before formal phrasing."
    real_world_applications = @(
      "Estimating total cost when shopping with limited cash",
      "Reading big numbers in school fees or transport fares"
    )
    community_connections = @(
      "Talk to a family member about how they estimate market prices",
      "Find 3 prices at a local shop and practice rounding"
    )
  }

  technical_metadata = @{
    offline_capable = $true
    sync_required = "optional"
    estimated_storage_mb = 1.2
    media_formats = @("text")
    device_requirements = @{
      min_screen_inches = 5.0
      min_storage_mb = 50
      touch_required = $false
    }
    performance_targets = @{
      load_time_seconds = 2.0
      min_fps = 30
    }
  }

  ai_tutor_metadata = @{
    hint_strategy = "socratic"
    common_misconceptions = @(
      @{
        misconception = "The digit 5 always means 5."
        correction = "A digit’s value depends on place value (ones, tens, hundreds…)."
      },
      @{
        misconception = "Rounding to the nearest 100 means look at the hundreds digit."
        correction = "You look at the digit to the right (tens) to decide up or down."
      },
      @{
        misconception = "If the next digit is 5, round down."
        correction = "5 rounds up in standard rounding rules."
      }
    )
    prerequisite_check = @(
      "Read and write whole numbers up to 100,000",
      "Understand tens and hundreds",
      "Compare two numbers using >, <, ="
    )
    adaptive_parameters = @{
      difficulty_adjustment = $true
      pacing_flexible = $true
    }
  }

  lesson_plan = @{
    opening = "Quick warm-up: read 3 large numbers aloud and identify the thousands place."
    direct_instruction = "Teach place value using CPA. Then teach rounding rules with a number line."
    guided_practice = "Work 2 examples together using LD market prices."
    independent_practice = "Students complete rounding practice set and explain reasoning."
    closing = "Exit ticket: one place value question + one rounding question."
    extension = "Accessibility: allow oral answers; provide number line template; extra challenge: estimate totals for 5 market items."
  }

  parent_summary = "Today your child learned place value and how to round numbers. You can help by asking them to round LD prices at the market."
}

$testLesson | ConvertTo-Json -Depth 25 | Set-Content $agent1OutputPath -Encoding UTF8
Write-Host "✅ Created Agent-1 output: $agent1OutputPath" -ForegroundColor Green

# -----------------------------
# Schema validation (non-interactive)
# -----------------------------
Write-Host "`n🔍 Testing schema validation..." -ForegroundColor Yellow
. "$PSScriptRoot\schema-validation.ps1"

$schemaOk = Test-CurriculumSchema `
  -JsonPath $agent1OutputPath `
  -SchemaPath $schemaPath `
  -FailOnError

# -----------------------------
# Run governance loop
# -----------------------------
Write-Host "`n🛡️  Running governance loop..." -ForegroundColor Yellow
Write-Host "   This will call OpenAI API and may take a moment..." -ForegroundColor Gray

try {
  & "$PSScriptRoot\governance-loop.ps1" `
    -EwoId $EwoId `
    -Agent1OutputPath $agent1OutputPath `
    -SchemaPath $schemaPath `
    -Agent5PromptPath $agent5PromptPath `
    -OpenAIModel $Model

  Write-Host "`n✅ Governance loop test completed successfully!" -ForegroundColor Green
  Write-Host "`n📊 Results:" -ForegroundColor Cyan
  Write-Host "   Agent-1 Output: $agent1OutputPath" -ForegroundColor Gray
  Write-Host "   Agent-5 Output: $resultsDir\$EwoId-Agent-5.json" -ForegroundColor Gray
} catch {
  Write-Host "`n❌ Governance loop test failed: $_" -ForegroundColor Red
  Write-Host "   Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Gray
  exit 1
}

Write-Host "`n🎉 All tests passed!" -ForegroundColor Green
