# Project Notes & Reminders

## Development Environment
- **Always use port 8080** for local development
- Default commands now use port 8080 automatically
- Supabase local: http://localhost:54321

## Quick Reference Commands
```bash
# Start development server
npm run dev

# Debug creatures
npm run fix:alignments
npm run fix:creature-types
npm run fix:all

# Manual debug scripts
node scripts/debug/debug-simple.js
node scripts/debug/discover-databases.js
```

## Common Patterns
- Edge functions are in `/supabase/functions/`
- Debug scripts are in `/scripts/debug/`
- All Notion API calls go through Supabase Edge Functions
- TypeScript interfaces are in `/src/types/`

## Architecture Notes
- Frontend: React + Vite + TypeScript
- Backend: Supabase Edge Functions
- Database: Notion API integration
- Styling: Tailwind CSS + shadcn/ui

## Debugging Tips
- Use `debug-simple.js` for basic connectivity tests
- Use `discover-databases.js` to find Notion databases
- Check Supabase function logs for API issues
- Always test locally on port 8080 before deploying

## Project Structure Reminders
- `/src/components/` - React components
- `/src/hooks/` - Custom React hooks
- `/src/services/` - Business logic
- `/src/types/` - TypeScript interfaces
- `/supabase/functions/` - Backend logic
- `/scripts/` - Utility and debug scripts
