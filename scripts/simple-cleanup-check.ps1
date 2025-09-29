# Simple Code Cleanup Checker

Write-Host "🧹 Code Cleanup Analysis" -ForegroundColor Cyan

# Check for console statements
$consoleFiles = Select-String -Path "src\**\*.ts*" -Pattern "console\." -SimpleMatch
$consoleCount = $consoleFiles.Count

# Check for any types
$anyFiles = Select-String -Path "src\**\*.ts*" -Pattern "\bany\b" 
$anyCount = $anyFiles.Count

# Check for hardcoded secrets
$secretFiles = Select-String -Path "scripts\**\*.js" -Pattern "eyJ[A-Za-z0-9_-]*\." 
$secretCount = $secretFiles.Count

Write-Host ""
Write-Host "📊 Results:" -ForegroundColor Green
Write-Host "Console statements: $consoleCount occurrences" -ForegroundColor $(if ($consoleCount -gt 0) { "Yellow" } else { "Green" })
Write-Host "Any types: $anyCount occurrences" -ForegroundColor $(if ($anyCount -gt 0) { "Yellow" } else { "Green" })  
Write-Host "Hardcoded secrets: $secretCount files" -ForegroundColor $(if ($secretCount -gt 0) { "Red" } else { "Green" })

if ($secretCount -gt 0) {
    Write-Host ""
    Write-Host "🚨 SECURITY: Hardcoded secrets found!" -ForegroundColor Red
    $secretFiles | ForEach-Object { Write-Host "  $($_.Filename)" -ForegroundColor Red }
}

Write-Host ""
Write-Host "Analysis complete!" -ForegroundColor Green
