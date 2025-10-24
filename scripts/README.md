# Scripts Directory

This directory is reserved for production-related scripts and utilities.

All debugging and one-off scripts have been removed as part of the codebase cleanup.

## Current Status

✅ **Clean** - No unused debug scripts  
✅ **Organized** - All Notion extraction logic centralized in `supabase/functions/_shared/notion-extractors.ts`  
✅ **Type-Safe** - DTOs match actual edge function outputs in `src/types/notion-dtos.ts`

## Architecture

The application follows a clean data flow:

```
Notion API → Edge Functions (_shared/notion-extractors.ts) → DTOs → Frontend
```

All property extraction happens in one place:
- `supabase/functions/_shared/notion-extractors.ts` - Single source of truth for all Notion data extraction

## If You Need to Debug

Use the Supabase dashboard to:
1. Check edge function logs: https://supabase.com/dashboard/project/xhrobkdzjabllhftksvt/functions
2. View database data: https://supabase.com/dashboard/project/xhrobkdzjabllhftksvt/editor
3. Test edge functions directly: https://supabase.com/dashboard/project/xhrobkdzjabllhftksvt/functions/{function_name}/details

Or use the browser console and Network tab to debug API calls from the frontend.
