# PowerShell script to set up and run the creature type fix

Write-Host "🚀 Creature Type Fix Setup" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Setup Steps:" -ForegroundColor Yellow
Write-Host "1. Discover your Notion databases"
Write-Host "2. Configure environment variables"  
Write-Host "3. Deploy the function"
Write-Host "4. Run the fix script"
Write-Host ""

Write-Host "Step 1: Database Discovery" -ForegroundColor Cyan
Write-Host "Running database discovery to find your database IDs..."
Write-Host ""

try {
    node discover-databases.js
    Write-Host ""
    Write-Host "✅ Database discovery completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Database discovery failed. Please run manually: node discover-databases.js" -ForegroundColor Red
    Write-Host ""
}

Write-Host "Step 2: Environment Configuration" -ForegroundColor Cyan
Write-Host "Next, you need to set your CREATURE_TYPES_DATABASE_ID:" -ForegroundColor Yellow
Write-Host "supabase secrets set CREATURE_TYPES_DATABASE_ID=your_database_id" -ForegroundColor White
Write-Host ""

$response = Read-Host "Have you set the CREATURE_TYPES_DATABASE_ID? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host ""
    Write-Host "Step 3: Deploy Function" -ForegroundColor Cyan
    Write-Host "Deploying fix-creature-types function..."
    
    try {
        supabase functions deploy fix-creature-types
        Write-Host "✅ Function deployed successfully" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Step 4: Run Fix Script" -ForegroundColor Cyan
        $runNow = Read-Host "Run the creature type fix now? (y/n)"
        if ($runNow -eq 'y' -or $runNow -eq 'Y') {
            Write-Host "🔧 Running creature type fix..."
            node debug-fix-creature-types.js
        } else {
            Write-Host "👍 You can run the fix later with: node debug-fix-creature-types.js" -ForegroundColor Blue
        }
    } catch {
        Write-Host "❌ Function deployment failed. Please run manually: supabase functions deploy fix-creature-types" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "📚 Manual Steps:" -ForegroundColor Yellow
    Write-Host "1. Set environment variable: supabase secrets set CREATURE_TYPES_DATABASE_ID=your_id"
    Write-Host "2. Deploy function: supabase functions deploy fix-creature-types"
    Write-Host "3. Run fix: node debug-fix-creature-types.js"
}

Write-Host ""
Write-Host "📖 For detailed documentation, see README-creature-fix.md" -ForegroundColor Blue
