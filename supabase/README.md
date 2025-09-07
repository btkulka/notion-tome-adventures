# Supabase Backend

This directory contains the Supabase configuration and Edge Functions for the backend services.

## Structure

- **config.toml** - Supabase project configuration
- **functions/** - Serverless Edge Functions

## Edge Functions

### Core Functions
- **discover-notion-databases/** - Discovers and analyzes Notion database schemas
- **get-notion-schema/** - Retrieves detailed schema information for Notion databases
- **generate-encounter/** - Creates D&D encounters based on specified criteria

### Data Fetching
- **fetch-creatures/** - Retrieves creature data from Notion
- **fetch-environments/** - Retrieves environment/location data from Notion

### Data Fixing
- **fix-creature-types/** - Automatically fixes creature type relations using Tags field
- **fix-alignments/** - Automatically fixes alignment fields using Tags field

### Debugging & Testing
- **debug-schemas/** - Debug function for examining database schemas
- **simple-creatures-test/** - Simple test function for creature data retrieval

### Shared Utilities
- **_shared/** - Shared utilities and helper functions used across multiple Edge Functions
  - **field-fix-utils.ts** - Modular utilities for automated field fixing
  - **notion-utils.ts** - Common Notion API utilities

## Deployment

Deploy functions using the Supabase CLI:
```bash
npx supabase functions deploy [function-name]
```

Deploy all functions:
```bash
npx supabase functions deploy
```
