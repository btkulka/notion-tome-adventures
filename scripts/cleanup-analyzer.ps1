# Code Cleanup Automation Script
# Run this to continue cleaning up the codebase

Write-Host "🧹 Code Cleanup Automation Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Function to check and replace console statements
function Update-ConsoleStatements {
    param([string]$FilePath)
    
    $content = Get-Content $FilePath -Raw
    if ($content -match "console\.(log|error|warn|info)") {
        Write-Host "⚠️ Found console statements in: $FilePath" -ForegroundColor Yellow
        Write-Host "   Manual review recommended for proper logging integration" -ForegroundColor Gray
        return $true
    }
    return $false
}

# Function to check for hardcoded API keys
function Check-HardcodedSecrets {
    param([string]$FilePath)
    
    $content = Get-Content $FilePath -Raw
    if ($content -match "eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*") {
        Write-Host "🔐 Found potential hardcoded API key in: $FilePath" -ForegroundColor Red
        Write-Host "   SECURITY RISK: Move to environment variables" -ForegroundColor Red
        return $true
    }
    return $false
}

# Function to check for any types
function Check-TypeSafety {
    param([string]$FilePath)
    
    $content = Get-Content $FilePath -Raw
    $anyCount = ([regex]::Matches($content, "\bany\b")).Count
    if ($anyCount -gt 0) {
        Write-Host "📝 Found $anyCount 'any' types in: $FilePath" -ForegroundColor Yellow
        Write-Host "   Consider improving type safety" -ForegroundColor Gray
        return $anyCount
    }
    return 0
}

Write-Host "`n🔍 Scanning codebase for cleanup opportunities..." -ForegroundColor Green

$filesWithConsole = @()
$filesWithSecrets = @()
$filesWithAnyTypes = @()
$totalAnyTypes = 0

# Scan TypeScript and JavaScript files
$sourceFiles = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx", "*.js", "*.jsx"

foreach ($file in $sourceFiles) {
    if (Update-ConsoleStatements $file.FullName) {
        $filesWithConsole += $file.FullName
    }
    
    if (Check-HardcodedSecrets $file.FullName) {
        $filesWithSecrets += $file.FullName
    }
    
    $anyCount = Check-TypeSafety $file.FullName
    if ($anyCount -gt 0) {
        $filesWithAnyTypes += @{ File = $file.FullName; Count = $anyCount }
        $totalAnyTypes += $anyCount
    }
}

# Scan script files for hardcoded secrets
$scriptFiles = Get-ChildItem -Path "scripts" -Recurse -Include "*.js"
foreach ($file in $scriptFiles) {
    if (Check-HardcodedSecrets $file.FullName) {
        $filesWithSecrets += $file.FullName
    }
}

Write-Host "`n📊 Cleanup Summary:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan

Write-Host "Console Statements: $($filesWithConsole.Count) files" -ForegroundColor $(if ($filesWithConsole.Count -gt 0) { "Yellow" } else { "Green" })
Write-Host "Hardcoded Secrets: $($filesWithSecrets.Count) files" -ForegroundColor $(if ($filesWithSecrets.Count -gt 0) { "Red" } else { "Green" })
Write-Host "Any Types: $totalAnyTypes occurrences in $($filesWithAnyTypes.Count) files" -ForegroundColor $(if ($totalAnyTypes -gt 0) { "Yellow" } else { "Green" })

if ($filesWithSecrets.Count -gt 0) {
    Write-Host "`n🚨 PRIORITY: Security Issues Found" -ForegroundColor Red
    Write-Host "Files with hardcoded secrets:" -ForegroundColor Red
    $filesWithSecrets | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    Write-Host "ACTION REQUIRED: Move API keys to .env files" -ForegroundColor Red
}

if ($filesWithConsole.Count -gt 0) {
    Write-Host "`n⚠️ Console Statements Found" -ForegroundColor Yellow
    Write-Host "Files to update:" -ForegroundColor Yellow
    $filesWithConsole | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host "RECOMMENDED: Replace with logger utility" -ForegroundColor Yellow
}

if ($totalAnyTypes -gt 0) {
    Write-Host "`n📝 Type Safety Improvements" -ForegroundColor Yellow
    Write-Host "Files with 'any' types:" -ForegroundColor Yellow
    $filesWithAnyTypes | ForEach-Object { 
        $file = $_.File
        $count = $_.Count
        Write-Host "  - $file ($count instances)" -ForegroundColor Yellow 
    }
    Write-Host "RECOMMENDED: Add proper TypeScript interfaces" -ForegroundColor Yellow
}

Write-Host "`n🎯 Next Steps:" -ForegroundColor Green
Write-Host "1. Address security issues (hardcoded secrets) immediately" -ForegroundColor White
Write-Host "2. Update remaining console statements with logger utility" -ForegroundColor White
Write-Host "3. Improve type safety by replacing 'any' types" -ForegroundColor White
Write-Host "4. Run 'npm run lint' to catch additional issues" -ForegroundColor White

Write-Host "`n✅ Cleanup analysis complete!" -ForegroundColor Green
