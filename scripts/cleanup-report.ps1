# Code Cleanup Summary Report

Write-Host "Code Cleanup Analysis" -ForegroundColor Cyan

# Count console statements in source files
$consoleCount = (Select-String -Path "src\**\*.ts*" -Pattern "console\." -SimpleMatch).Count

# Count any types in source files  
$anyCount = (Select-String -Path "src\**\*.ts*" -Pattern "\bany\b").Count

# Count hardcoded secrets in scripts
$secretCount = (Select-String -Path "scripts\**\*.js" -Pattern "eyJ[A-Za-z0-9_-]*\." -ErrorAction SilentlyContinue).Count

Write-Host ""
Write-Host "Results:" -ForegroundColor Green
Write-Host "- Console statements: $consoleCount" -ForegroundColor Yellow
Write-Host "- Any types: $anyCount" -ForegroundColor Yellow  
Write-Host "- Hardcoded secrets: $secretCount" -ForegroundColor Red

Write-Host ""
Write-Host "Cleanup analysis complete" -ForegroundColor Green
