# Governance Loop Scripts

This directory contains the authoritative governance loop system for LiberiaLearn factory pipeline.

## Prerequisites

1. **AJV CLI** - Install globally:
   ```powershell
   npm install -g ajv-cli
   ```

2. **OpenAI API Key** - Set environment variable:
   ```powershell
   $env:OPENAI_API_KEY = "your-api-key-here"
   ```

## Scripts

### `governance-loop.ps1` (AUTHORITATIVE)
The main governance loop that orchestrates the Agent-1 → Agent-5 → Repair/Reject workflow.

**Parameters:**
- `-EwoId` (Required): Education Work Order ID
- `-Agent1OutputPath` (Required): Path to Agent-1's output JSON file
- `-SchemaPath` (Required): Path to unified curriculum schema JSON
- `-Agent5PromptPath` (Required): Path to Agent-5 (QA/Governance) prompt file
- `-OpenAIModel` (Optional): OpenAI model to use (default: "gpt-4")

**Workflow:**
1. Schema validation (hard fail if invalid)
2. Run Agent-5 (governance) on Agent-1 output
3. Handle decisions:
   - **ACCEPT** → Success, exit
   - **REPAIR** → Apply JSON patch, recurse
   - **REJECT** → Throw error

**Example:**
```powershell
.\scripts\governance-loop.ps1 `
    -EwoId "EWO-00001" `
    -Agent1OutputPath ".\FactoryArtifacts\Results\EWO-00001-Agent-1.json" `
    -SchemaPath ".\docs\internal\schemas\unified-curriculum-schema.json" `
    -Agent5PromptPath ".\docs\internal\agents\qa-governance-agent.md"
```

### `schema-validation.ps1`
Validates curriculum JSON against the unified schema using AJV CLI.

**Function:**
- `Test-CurriculumSchema` - Validates JSON against schema

**Parameters:**
- `-JsonPath` (Required): Path to JSON file to validate
- `-SchemaPath` (Required): Path to schema JSON file
- `-FailOnError` (Switch): Throw error if validation fails

### `run-agent.ps1`
Executes an agent using OpenAI API with a prompt file and input JSON.

**Parameters:**
- `-PromptPath` (Required): Path to agent prompt file
- `-InputJsonPath` (Required): Path to input JSON file
- `-OutputPath` (Required): Path to save agent output
- `-Model` (Optional): OpenAI model (default: "gpt-4")

**Features:**
- Reads prompt and input JSON
- Calls OpenAI API
- Extracts JSON from response (handles markdown code blocks)
- Saves output to file

### `apply-json-patch.ps1`
Applies RFC 6902 JSON Patch operations to a JSON file.

**Parameters:**
- `-TargetJsonPath` (Required): Path to JSON file to patch
- `-Patch` (Required): Array of patch operations

**Supported Operations:**
- `add` - Add a value
- `replace` - Replace a value
- `remove` - Remove a value
- `copy` - Copy a value
- `move` - Move a value

### `test-governance-loop.ps1`
Test script to verify the governance loop system.

**Usage:**
```powershell
.\scripts\test-governance-loop.ps1 -EwoId "EWO-TEST-001"
```

## Integration

The governance loop is integrated into `testFactoryPipelineParallel.ps1` and runs automatically after Agent-1 completes successfully.

## Error Handling

- Schema validation failures cause hard failures (throw error)
- Governance REJECT decisions throw errors
- Invalid JSON responses are logged and saved for debugging
- All errors include detailed messages and context

## Notes

- The governance loop is **recursive** - it will re-run after REPAIR operations
- The loop is **safe** - it validates inputs and handles errors gracefully
- The loop is **autonomous** - it makes decisions without human intervention
- The loop is **non-hallucinatory** - it uses schema validation and structured outputs

