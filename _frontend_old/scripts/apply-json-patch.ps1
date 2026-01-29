# -----------------------------
# Apply JSON Patch Script
# Applies RFC 6902 JSON Patch operations to a JSON file
# -----------------------------

param(
    [Parameter(Mandatory)]
    [string]$TargetJsonPath,

    [Parameter(Mandatory)]
    [array]$Patch
)

if (-not (Test-Path $TargetJsonPath)) {
    throw "Target JSON file not found: $TargetJsonPath"
}

# Read current JSON
$content = Get-Content $TargetJsonPath -Raw | ConvertFrom-Json

# Apply patch operations
foreach ($operation in $Patch) {
    $op = $operation.op
    $path = $operation.path
    
    Write-Host "🛠️  Applying patch operation: $op $path" -ForegroundColor Yellow
    
    switch ($op) {
        "add" {
            # Add operation
            $pathParts = $path.TrimStart('/').Split('/')
            $target = $content
            
            # Navigate to parent
            for ($i = 0; $i -lt $pathParts.Length - 1; $i++) {
                $key = $pathParts[$i]
                if (-not $target.$key) {
                    $target | Add-Member -MemberType NoteProperty -Name $key -Value @{} -Force
                }
                $target = $target.$key
            }
            
            # Add the value
            $finalKey = $pathParts[-1]
            if ($target -is [PSCustomObject]) {
                $target | Add-Member -MemberType NoteProperty -Name $finalKey -Value $operation.value -Force
            } elseif ($target -is [System.Collections.IList]) {
                if ($finalKey -match '^-?\d+$') {
                    $index = [int]$finalKey
                    if ($index -eq -1 -or $index -eq $target.Count) {
                        $target.Add($operation.value)
                    } else {
                        $target.Insert($index, $operation.value)
                    }
                }
            }
        }
        
        "replace" {
            # Replace operation
            $pathParts = $path.TrimStart('/').Split('/')
            $target = $content
            
            # Navigate to target
            for ($i = 0; $i -lt $pathParts.Length - 1; $i++) {
                $key = $pathParts[$i]
                $target = $target.$key
            }
            
            # Replace the value
            $finalKey = $pathParts[-1]
            if ($target -is [PSCustomObject]) {
                $target.$finalKey = $operation.value
            } elseif ($target -is [System.Collections.IList]) {
                if ($finalKey -match '^-?\d+$') {
                    $target[[int]$finalKey] = $operation.value
                }
            }
        }
        
        "remove" {
            # Remove operation
            $pathParts = $path.TrimStart('/').Split('/')
            $target = $content
            
            # Navigate to parent
            for ($i = 0; $i -lt $pathParts.Length - 1; $i++) {
                $key = $pathParts[$i]
                $target = $target.$key
            }
            
            # Remove the value
            $finalKey = $pathParts[-1]
            if ($target -is [PSCustomObject]) {
                $target.PSObject.Properties.Remove($finalKey)
            } elseif ($target -is [System.Collections.IList]) {
                if ($finalKey -match '^-?\d+$') {
                    $target.RemoveAt([int]$finalKey)
                }
            }
        }
        
        "copy" {
            # Copy operation
            $fromPath = $operation.from
            $toPath = $operation.path
            
            # Get value from source
            $fromParts = $fromPath.TrimStart('/').Split('/')
            $sourceValue = $content
            foreach ($part in $fromParts) {
                $sourceValue = $sourceValue.$part
            }
            
            # Apply add operation to destination
            $toParts = $toPath.TrimStart('/').Split('/')
            $target = $content
            for ($i = 0; $i -lt $toParts.Length - 1; $i++) {
                $key = $toParts[$i]
                if (-not $target.$key) {
                    $target | Add-Member -MemberType NoteProperty -Name $key -Value @{} -Force
                }
                $target = $target.$key
            }
            $finalKey = $toParts[-1]
            $target | Add-Member -MemberType NoteProperty -Name $finalKey -Value $sourceValue -Force
        }
        
        "move" {
            # Move operation (copy then remove)
            $fromPath = $operation.from
            $toPath = $operation.path
            
            # Get value from source
            $fromParts = $fromPath.TrimStart('/').Split('/')
            $sourceValue = $content
            foreach ($part in $fromParts) {
                $sourceValue = $sourceValue.$part
            }
            
            # Apply add to destination
            $toParts = $toPath.TrimStart('/').Split('/')
            $target = $content
            for ($i = 0; $i -lt $toParts.Length - 1; $i++) {
                $key = $toParts[$i]
                if (-not $target.$key) {
                    $target | Add-Member -MemberType NoteProperty -Name $key -Value @{} -Force
                }
                $target = $target.$key
            }
            $finalKey = $toParts[-1]
            $target | Add-Member -MemberType NoteProperty -Name $finalKey -Value $sourceValue -Force
            
            # Remove from source
            $sourceTarget = $content
            for ($i = 0; $i -lt $fromParts.Length - 1; $i++) {
                $key = $fromParts[$i]
                $sourceTarget = $sourceTarget.$key
            }
            $sourceTarget.PSObject.Properties.Remove($fromParts[-1])
        }
        
        default {
            Write-Warning "Unknown patch operation: $op"
        }
    }
}

# Write back to file
$content | ConvertTo-Json -Depth 10 | Set-Content $TargetJsonPath
Write-Host "✅ JSON patch applied successfully" -ForegroundColor Green

