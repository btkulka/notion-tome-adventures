# D&D Notion Tome Adventures - AI Agent Blueprint

## Project Overview
This is a React-based D&D encounter generator that exclusively uses Notion databases as the data source through Supabase Edge Functions. The application generates balanced encounters by querying creature and environment data from configured Notion databases.

## 🚨 CRITICAL CONSTRAINTS - NEVER VIOLATE THESE

### 1. NO FALLBACK DATA POLICY
- **NEVER** create, use, or implement any form of mock, default, or fallback data
- **NEVER** add hardcoded arrays of creatures, environments, or any game data
- **NEVER** create "sample data" or "example data" for testing
- **NEVER** implement fallback logic that provides alternate data when Notion fails
- When Notion integration fails, the application should fail gracefully with error messages
- Empty states should show loading indicators or error messages, NOT placeholder content

### 2. SUPABASE DEPLOYMENT ONLY
- **ALWAYS** use deployed Supabase Edge Functions, never local development functions
- **NEVER** implement local alternatives to edge functions
- **NEVER** bypass Supabase by implementing direct Notion API calls in the frontend
- All data fetching must go through the production Supabase instance at `https://xhrobkdzjabllhftksvt.supabase.co`

### 3. NOTION DATABASE DEPENDENCY
- The application is 100% dependent on properly configured Notion databases
- All creatures, environments, and encounter data MUST come from Notion
- The application should not function without proper Notion integration
- Configuration errors should result in clear error messages, not workarounds

## Architecture Overview

### Frontend (React + TypeScript + Vite)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (dev server runs on port 8080)
- **UI Components**: shadcn/ui components with Tailwind CSS
- **State Management**: React hooks (useState, useEffect)
- **Routing**: React Router

### Backend (Supabase Edge Functions)
- **Runtime**: Deno with TypeScript
- **Functions Location**: `supabase/functions/`
- **Shared Utilities**: `supabase/functions/_shared/`
- **Deployment**: Production Supabase instance only

### Data Source (Notion)
- **Primary Database**: Creatures database with monsters/NPCs
- **Secondary Database**: Environments database with locations
- **Integration**: Notion API through Supabase Edge Functions
- **Authentication**: Notion API key stored as Supabase secret

## Key Components Structure

### Core Services
- `src/hooks/useNotionService.ts` - Main service hook for all Notion operations
- `src/services/advanced-encounter-generator.ts` - Client-side encounter algorithms
- `src/lib/supabase-client.ts` - Supabase client configuration

### Edge Functions
- `fetch-creatures` - Retrieves creature data from Notion
- `fetch-environments` - Retrieves environment data from Notion  
- `generate-encounter` - Creates balanced encounters using creature data
- `discover-notion-databases` - Finds and matches Notion databases
- `get-notion-schema` - Analyzes database structure

### UI Components
- `AppSidebar.tsx` - Main parameter configuration interface
- `Index.tsx` - Main application page with encounter display
- Various utility components in `src/components/ui/`

## Environment Configuration

### Required Supabase Secrets
```bash
NOTION_API_KEY=your_notion_integration_token
CREATURES_DATABASE_ID=notion_database_id_for_creatures
ENVIRONMENTS_DATABASE_ID=notion_database_id_for_environments
```

### Frontend Environment Variables (.env)
```bash
VITE_SUPABASE_PROJECT_ID=xhrobkdzjabllhftksvt
VITE_SUPABASE_URL=https://xhrobkdzjabllhftksvt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

## Development Guidelines

### When Adding New Features
1. **Data Requirements**: Determine what Notion database fields are needed
2. **Edge Function**: Implement or modify edge functions to handle data fetching
3. **Frontend Integration**: Use `useNotionService` hook to call edge functions
4. **Error Handling**: Implement proper error states without fallbacks
5. **Testing**: Test with real Notion data only

### Error Handling Strategy
- **Network Errors**: Show connection error messages
- **Data Errors**: Display validation error details
- **Empty Results**: Show "no data found" messages with setup instructions
- **Configuration Errors**: Provide clear setup guidance
- **Never**: Hide errors with mock data or fallbacks

### Code Patterns to Follow
```typescript
// ✅ CORRECT: Fail when no data
const [environments, setEnvironments] = useState<Environment[]>([]);

useEffect(() => {
  const loadData = async () => {
    try {
      const result = await fetchEnvironments();
      if (result?.environments?.length > 0) {
        setEnvironments(result.environments);
      } else {
        setEnvironments([]); // Empty array, no fallbacks
      }
    } catch (error) {
      console.error('Failed to load:', error);
      setEnvironments([]); // Fail gracefully
    }
  };
  loadData();
}, []);
```

```typescript
// ❌ WRONG: Never do this
const defaultEnvironments = ['Forest', 'Dungeon']; // NO DEFAULTS
if (environments.length === 0) {
  return defaultEnvironments; // NO FALLBACKS
}
```

### File Organization
```
src/
├── components/          # UI components
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
├── pages/              # Route components  
├── services/           # Business logic services
├── types/              # TypeScript type definitions
└── utils/              # Helper functions

supabase/
├── functions/          # Edge function implementations
└── config.toml         # Supabase configuration
```

## Common Tasks and Patterns

### Adding a New Edge Function
1. Create function directory: `supabase/functions/function-name/`
2. Implement `index.ts` with proper imports from `_shared/`
3. Use standard CORS handling from `notion-utils.ts`
4. Add corresponding method to `useNotionService.ts`
5. Deploy to production Supabase instance

### Modifying Data Structures
1. Update TypeScript interfaces in `src/types/`
2. Modify edge function data processing
3. Update frontend components to handle new structure
4. Ensure proper error handling for missing fields

### Debugging Edge Functions
- Use Supabase dashboard logs for deployed functions
- Add console.log statements in edge functions
- Check CORS configuration for client-side errors
- Verify environment variables in Supabase settings

## Security Considerations
- Notion API keys are stored as Supabase secrets, never in frontend code
- All database queries go through authenticated edge functions
- Frontend uses Supabase anon key with appropriate RLS policies
- CORS is configured to allow the specific frontend domain

## Performance Guidelines
- Edge functions include proper error handling and timeouts
- Frontend implements loading states for all async operations
- Large datasets are paginated when possible
- Failed requests are logged but not retried with fallback data

## Deployment Process
1. **Edge Functions**: Deploy via Supabase CLI or dashboard
2. **Frontend**: Build and deploy static files to hosting platform
3. **Environment Setup**: Configure all required secrets in Supabase dashboard
4. **Notion Integration**: Ensure Notion databases are properly structured and accessible

## Troubleshooting Common Issues

### "No environments/creatures found"
- Check Notion API key validity
- Verify database IDs are correct
- Confirm database permissions for the integration
- Review edge function logs for specific errors

### CORS Errors
- Ensure frontend dev server uses port 8080
- Check edge function CORS configuration
- Verify deployed functions have correct headers

### Encounter Generation Failures
- Confirm creatures database has required fields (CR, XP, environment)
- Check XP threshold parameters are reasonable
- Verify creature filtering logic in edge functions

---

## For AI Agents: Key Reminders

1. **Read this blueprint** before making any changes to understand constraints
2. **Never implement fallback data** - the application should fail rather than show fake data
3. **Always use production Supabase** - no local development edge functions
4. **Test with real Notion data** - set up proper integration for testing
5. **Maintain error transparency** - users should see real errors, not hidden failures
6. **Follow established patterns** - use existing hooks and services for consistency
7. **Update this blueprint** if you add new architectural constraints or patterns

This project prioritizes data integrity and real-world functionality over convenience features that might mask configuration issues.
