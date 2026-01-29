param(
  [string]$OutRoot = ".\FactoryArtifacts\Subjects",
  [string]$Version = "0.1.0",
  [switch]$Force
)

# Subjects must match your schema enum exactly
$Subjects = @(
  "MATH",
  "ENGLISH",
  "SCIENCE",
  "PHYSICS",
  "CHEMISTRY",
  "BIOLOGY",
  "COMPUTER_SCIENCE",
  "ICT",
  "HISTORY",
  "CIVICS",
  "GEOGRAPHY",
  "ECONOMICS",
  "BUSINESS_STUDIES",
  "ARTS",
  "CREATIVITY",
  "PE",
  "LITERACY"
)

# Consider these "STEM-ish" for adding virtual labs
$StemSubjects = New-Object System.Collections.Generic.HashSet[string]
@("MATH","SCIENCE","PHYSICS","CHEMISTRY","BIOLOGY","COMPUTER_SCIENCE","ICT") | ForEach-Object { [void]$StemSubjects.Add($_) }

function Get-CognitiveBand([int]$grade) {
  if ($grade -ge 1 -and $grade -le 3) { return "FOUNDATION" }
  elseif ($grade -ge 4 -and $grade -le 9) { return "CORE" }
  else { return "SPECIALIZATION" } # 10–12
}

function Pad2([int]$n) { return "{0:D2}" -f $n }

function Make-Id([string]$prefix, [string]$body) {
  # Body MUST be only A–Z0–9 to match: ^(LESSON|UNIT|TERM|SUBJECT)-[A-Z0-9]+$
  $clean = ($body.ToUpper() -replace "[^A-Z0-9]", "")
  return "$prefix-$clean"
}

function New-Metadata([string]$id, [string]$version, [string]$status, [string]$nowIso) {
  return @{
    id         = $id
    version    = $version
    created_at = $nowIso
    updated_at = $nowIso
    status     = $status
  }
}

function New-LessonNode([int]$grade, [string]$subject, [string]$band, [int]$unitIndex, [int]$lessonIndex, [string]$version, [string]$nowIso) {
  $g2 = Pad2 $grade
  $u2 = Pad2 $unitIndex
  $l2 = Pad2 $lessonIndex

  # IDs that pass pattern (no extra hyphens)
  $lessonId = Make-Id "LESSON" ("G{0}{1}U{2}L{3}" -f $g2, $subject, $u2, $l2)

  $loId  = "LO-G{0}-{1}-U{2}L{3}" -f $g2, $subject, $u2, $l2
  $actId = "ACT-G{0}-{1}-U{2}L{3}-A1" -f $g2, $subject, $u2, $l2
  $asmId = "ASM-G{0}-{1}-U{2}L{3}" -f $g2, $subject, $u2, $l2

  $node = @{
    metadata = (New-Metadata -id $lessonId -version $version -status "draft" -nowIso $nowIso)
    title = "Lesson $lessonIndex (Unit $unitIndex) — $subject Grade $grade"
    description = "Day-1 lesson shell. Keep offline-capable. Expand with richer examples, practice, and teacher supports."
    content_type = "LESSON"
    educational_context = @{
      grade = $grade
      subject = $subject
      cognitive_band = $band
    }
    learning_objectives = @(
      @{
        id = $loId
        statement = "Students can demonstrate the key idea for Lesson $lessonIndex in Unit $unitIndex."
        bloom_level = "APPLY"
        success_criteria = @(
          "Explains the concept in their own words",
          "Solves at least 3 practice items accurately"
        )
      }
    )
    activities = @(
      @{
        id = $actId
        type = "PRACTICE"
        title = "Guided + Independent Practice"
        description = "Short guided examples followed by independent items. Teacher checks misconceptions and gives targeted feedback."
        duration_minutes = 30
        offline_capable = $true
        interaction_pattern = "individual"
        differentiation = @{
          struggling = "Use simpler numbers/shorter text; provide worked example; reduce cognitive load."
          advanced = "Add a challenge item with extension reasoning; ask for a second solution strategy."
          mixed_literacy = "Read aloud option; use visuals; allow verbal explanation."
        }
      }
    )
    assessments = @(
      @{
        id = $asmId
        type = "FORMATIVE"
        format = "SHORT_ANSWER"
        adaptive = $true
        mastery_threshold = 0.7
        questions = @(
          @{
            id = "Q1"
            question = "Answer a core question that checks understanding for this lesson."
            points = 2
            difficulty = "D2"
            ai_gradable = $true
          },
          @{
            id = "Q2"
            question = "Solve one applied problem connected to real life."
            points = 3
            difficulty = "D3"
            ai_gradable = $true
          }
        )
        feedback = @{
          correct = "Good work — you showed clear understanding."
          incorrect = "Let’s review the key step and try again."
          partial = "You’re close — fix the reasoning on the highlighted step."
        }
      }
    )
  }

  # Add a minimal virtual lab only for STEM-ish subjects
  if ($StemSubjects.Contains($subject)) {
    $vlabId = "VLAB-G{0}-{1}-U{2}L{3}" -f $g2, $subject, $u2, $l2
    $node.virtual_labs = @(
      @{
        id = $vlabId
        type = "SIMULATION"
        title = "Offline-first Guided Simulation"
        description = "A lightweight simulation concept that can be implemented later as HTML5; text-guided today."
        implementation_level = "text_guided"
        steps = @(
          @{
            step_number = 1
            instruction = "Follow the guided steps to explore the concept."
            expected_observation = "You notice a pattern that supports the lesson idea."
            ai_tutor_hint = "What changes? What stays the same?"
          }
        )
        household_alternative = "Use paper, pencil, and simple objects (bottle caps/beans) to model the idea."
      }
    )
  }

  return $node
}

function New-UnitNode([int]$grade, [string]$subject, [string]$band, [int]$unitIndex, [string]$version, [string]$nowIso) {
  $g2 = Pad2 $grade
  $u2 = Pad2 $unitIndex
  $unitId = Make-Id "UNIT" ("G{0}{1}U{2}" -f $g2, $subject, $u2)

  $unitNode = @{
    metadata = (New-Metadata -id $unitId -version $version -status "draft" -nowIso $nowIso)
    title = "Unit $unitIndex — $subject Grade $grade"
    description = "Day-1 unit shell. Expand into a full unit map with mastery checkpoints and local Liberia examples."
    content_type = "UNIT"
    educational_context = @{
      grade = $grade
      subject = $subject
      cognitive_band = $band
    }
    nested_content = @(
      (New-LessonNode -grade $grade -subject $subject -band $band -unitIndex $unitIndex -lessonIndex 1 -version $version -nowIso $nowIso),
      (New-LessonNode -grade $grade -subject $subject -band $band -unitIndex $unitIndex -lessonIndex 2 -version $version -nowIso $nowIso)
    )
  }

  return $unitNode
}

function New-FullSubject([int]$grade, [string]$subject, [string]$band, [string]$version, [string]$nowIso) {
  $g2 = Pad2 $grade
  $subjectId = Make-Id "SUBJECT" ("{0}G{1}" -f $subject, $g2)

  $node = @{
    metadata = (New-Metadata -id $subjectId -version $version -status "draft" -nowIso $nowIso)
    title = "LiberiaLearn $subject — Grade $grade ($band)"
    description = "Day-1 full-subject shell. Offline-capable by default. Expand units/lessons iteratively while keeping student access to all grades/subjects."
    content_type = "FULL_SUBJECT"
    educational_context = @{
      grade = $grade
      subject = $subject
      cognitive_band = $band
    }
    standards_alignment = @{
      global_benchmarks = @{
        source_countries = @("Singapore","Finland","Japan")
        frameworks = @("Common Core")
        adaptation_notes = "Depth-over-breadth with mastery progression; productive struggle; offline-first delivery."
      }
    }
    cultural_context = @{
      local_examples = @(
        "Liberian markets and budgeting",
        "Transport and distances",
        "School life and community activities"
      )
      language_notes = "Use clear Liberian English; allow optional short clarifications in Liberian Koloqua where appropriate."
      real_world_applications = @(
        "Household planning and saving",
        "Community problem-solving",
        "Reading data and making decisions"
      )
      community_connections = @(
        "Connect tasks to home, market, school, and community roles."
      )
    }
    ai_tutor_metadata = @{
      hint_strategy = "socratic"
      prerequisite_check = @(
        "Basic reading of numbers/terms for the grade band",
        "Prior grade key skills where applicable"
      )
      adaptive_parameters = @{
        difficulty_adjustment = $true
        pacing_flexible = $true
      }
      common_misconceptions = @(
        @{
          misconception = "Rushing to answers without explaining reasoning."
          correction = "Require a short explanation or model before final answer."
        }
      )
    }
    technical_metadata = @{
      offline_capable = $true
      sync_required = "optional"
      estimated_storage_mb = 25
      media_formats = @("image","audio")
      device_requirements = @{
        min_screen_inches = 7
        min_storage_mb = 256
        touch_required = $false
      }
      performance_targets = @{
        load_time_seconds = 2
        min_fps = 30
      }
    }
    nested_content = @(
      (New-UnitNode -grade $grade -subject $subject -band $band -unitIndex 1 -version $version -nowIso $nowIso),
      (New-UnitNode -grade $grade -subject $subject -band $band -unitIndex 2 -version $version -nowIso $nowIso),
      (New-UnitNode -grade $grade -subject $subject -band $band -unitIndex 3 -version $version -nowIso $nowIso),
      (New-UnitNode -grade $grade -subject $subject -band $band -unitIndex 4 -version $version -nowIso $nowIso),
      (New-UnitNode -grade $grade -subject $subject -band $band -unitIndex 5 -version $version -nowIso $nowIso)
    )
  }

  return $node
}

# --- Main ---
$nowIso = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

foreach ($grade in 1..12) {
  $band = Get-CognitiveBand $grade
  $gradeFolder = Join-Path $OutRoot ("G{0}" -f (Pad2 $grade))
  New-Item -ItemType Directory -Path $gradeFolder -Force | Out-Null

  foreach ($subject in $Subjects) {
    $outPath = Join-Path $gradeFolder ("{0}.json" -f $subject)

    if ((Test-Path $outPath) -and (-not $Force)) {
      Write-Host "Skipping (exists): $outPath"
      continue
    }

    $artifact = New-FullSubject -grade $grade -subject $subject -band $band -version $Version -nowIso $nowIso

    $json = $artifact | ConvertTo-Json -Depth 50
    Set-Content -Path $outPath -Value $json -Encoding UTF8

    Write-Host "Wrote: $outPath"
  }
}

Write-Host "✅ Done. Generated subject shells under: $OutRoot"
