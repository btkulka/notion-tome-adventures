# Deploy Environment Filtering Fixes
# Run this script to deploy the enhanced environment filtering logic

Write-Host "🚀 Deploying Environment Filtering Fixes..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "supabase\functions\generate-encounter\index.ts")) {
    Write-Host "❌ Error: Not in the correct project directory" -ForegroundColor Red
    Write-Host "Please run this script from the root of your notion-tome-adventures project" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running (required for Supabase)
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Deploying generate-encounter function..." -ForegroundColor Blue

# Deploy the function
try {
    npx supabase functions deploy generate-encounter --project-ref fykmkjdpfswkuduozqyj
    Write-Host "✅ Function deployed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed. You may need to login first:" -ForegroundColor Red
    Write-Host "npx supabase login" -ForegroundColor Yellow
    Write-Host "Then try running this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🎯 Environment filtering fixes deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "Changes include:" -ForegroundColor Cyan
Write-Host "- Enhanced environment property extraction (Environment, Environments, Biome)" -ForegroundColor White
Write-Host "- Support for relation, multi_select, and select property types" -ForegroundColor White
Write-Host "- Case-insensitive environment filtering" -ForegroundColor White
Write-Host "- Removed problematic 'Unknown' value skipping logic" -ForegroundColor White
Write-Host "- Comprehensive debugging logs for troubleshooting" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Test environment filtering by:" -ForegroundColor Yellow
Write-Host "1. Select an environment (e.g., 'Arctic') in the encounter generator" -ForegroundColor White
Write-Host "2. Generate an encounter" -ForegroundColor White
Write-Host "3. Check the generation log for environment filter results" -ForegroundColor White
