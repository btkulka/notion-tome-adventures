#!/bin/bash

# Deployment script for generate-encounter function
# Run this in Git Bash or WSL if Docker issues persist

echo "🚀 Deploying generate-encounter function to Supabase..."

# Attempt to deploy using npx (bypasses local Docker issues)
npx supabase functions deploy generate-encounter --project-ref xhrobkdzjabllhftksvt --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
else
    echo "❌ Deployment failed. Please deploy manually via Supabase dashboard:"
    echo "1. Go to https://supabase.com/dashboard/project/xhrobkdzjabllhftksvt/functions"
    echo "2. Create new function: generate-encounter"
    echo "3. Copy code from: supabase/functions/generate-encounter/index.ts"
fi

echo "🔧 Don't forget to set environment variables in Supabase dashboard:"
echo "- NOTION_API_KEY"
echo "- CREATURES_DATABASE_ID"
echo "- ENVIRONMENTS_DATABASE_ID"
