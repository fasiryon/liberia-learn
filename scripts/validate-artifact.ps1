param(
  [Parameter(Mandatory=$true)]
  [string]$JsonPath
)

$SchemaPath = ".\docs\internal\schemas\unified-curriculum-schema.json"

node .\scripts\validate-schema.mjs $SchemaPath $JsonPath
