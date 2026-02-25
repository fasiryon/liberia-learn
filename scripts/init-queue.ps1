$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "sprints" | Out-Null

$blocks = @(
  @{
    id="block-5"; title="Block 5: Ops Intelligence (Self-Healing A+B)"
    branch="block-5-ops-intelligence"
    promptFile="prompts\block-5-ops-intelligence.txt"
    bodyFile="docs\pr-bodies\block-5-ops-intelligence.md"
    adrStubFile="docs\adr\_stubs\block-5-ops-intelligence-adr.md"
    status="todo"
  },
  @{
    id="block-7a"; title="Block 7A: Performance Engine Core (Schema + Mastery Core)"
    branch="block-7a-performance-core"
    promptFile="prompts\block-7a-performance-core.txt"
    bodyFile="docs\pr-bodies\block-7a-performance-core.md"
    adrStubFile="docs\adr\_stubs\block-7a-performance-core-adr.md"
    status="todo"
  },
  @{
    id="block-7b"; title="Block 7B: Adaptive Baseline (C) + Baseline Capture"
    branch="block-7b-adaptive-baseline"
    promptFile="prompts\block-7b-adaptive-baseline.txt"
    bodyFile="docs\pr-bodies\block-7b-adaptive-baseline.md"
    adrStubFile="docs\adr\_stubs\block-7b-adaptive-baseline-adr.md"
    status="todo"
  },
  @{
    id="block-8"; title="Block 8: Hybrid Monthly Reporting"
    branch="block-8-hybrid-reporting"
    promptFile="prompts\block-8-hybrid-reporting.txt"
    bodyFile="docs\pr-bodies\block-8-hybrid-reporting.md"
    adrStubFile="docs\adr\_stubs\block-8-hybrid-reporting-adr.md"
    status="todo"
  },
  @{
    id="block-6"; title="Block 6: MOE Governance & National Controls"
    branch="block-6-moe-governance"
    promptFile="prompts\block-6-moe-governance.txt"
    bodyFile="docs\pr-bodies\block-6-moe-governance.md"
    adrStubFile="docs\adr\_stubs\block-6-moe-governance-adr.md"
    status="todo"
  },
  @{
    id="block-9"; title="Block 9: AI Stabilization Layer (Tutor + Teacher Assist)"
    branch="block-9-ai-stabilization"
    promptFile="prompts\block-9-ai-stabilization.txt"
    bodyFile="docs\pr-bodies\block-9-ai-stabilization.md"
    adrStubFile="docs\adr\_stubs\block-9-ai-stabilization-adr.md"
    status="todo"
  },
  @{
    id="block-10"; title="Block 10: National Scale Infrastructure"
    branch="block-10-national-scale"
    promptFile="prompts\block-10-national-scale.txt"
    bodyFile="docs\pr-bodies\block-10-national-scale.md"
    adrStubFile="docs\adr\_stubs\block-10-national-scale-adr.md"
    status="todo"
  },
  @{
    id="block-11"; title="Block 11: Labs3D Engine (Measured STEM)"
    branch="block-11-labs3d"
    promptFile="prompts\block-11-labs3d.txt"
    bodyFile="docs\pr-bodies\block-11-labs3d.md"
    adrStubFile="docs\adr\_stubs\block-11-labs3d-adr.md"
    status="todo"
  }
)

@{ blocks = $blocks } | ConvertTo-Json -Depth 10 | Set-Content "sprints\queue.json" -Encoding UTF8
Write-Host "✅ Queue initialized at sprints\queue.json" -ForegroundColor Green
Write-Host "Next: .\scripts\run-next.ps1" -ForegroundColor Yellow
