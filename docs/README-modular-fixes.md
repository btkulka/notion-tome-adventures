# 🔧 Modular Field Fix System

This system provides a scalable, reusable framework for fixing field mappings in your Notion D&D database. It extracts values from text fields and properly maps them to structured fields.

## 🏗️ **Architecture**

### Core Components

1. **`field-fix-utils.ts`** - Shared utilities and interfaces
2. **`fix-creature-types/index.ts`** - Creature type relation fixes
3. **`fix-alignments/index.ts`** - Alignment select field fixes
4. **Individual test scripts** - For testing each function

### Modular Design Benefits

- ✅ **Reusable**: Same core logic for different field types
- ✅ **Scalable**: Easy to add new field fixes
- ✅ **Maintainable**: Centralized logic for common operations
- ✅ **Type-safe**: Full TypeScript interfaces
- ✅ **Configurable**: Flexible configuration for different field types

## 🔧 **How It Works**

### Process Flow
1. **Query** monsters with empty target fields
2. **Extract** text values from Tags field
3. **Match** against valid values/relations
4. **Update** target field (select/relation)
5. **Clean** source text field
6. **Add** to multi-select tags field
7. **Log** detailed results

### Configuration-Driven
```typescript
const config: FieldFixConfig = {
  sourceField: 'Tags',           // Where to extract from
  targetField: 'Alignment',      // Where to set value
  targetType: 'select',          // Type of target field
  multiSelectField: 'Monster Tags', // Also add to multi-select
  validValues: ALIGNMENT_VALUES  // Allowed values
}
```

## 📋 **Current Implementations**

### 1. Creature Types Fix ✅
- **Source**: Tags (rich text)
- **Target**: Creature Type (relation)
- **Values**: Beast, Dragon, Humanoid, etc.
- **Status**: Deployed and tested
- **Results**: 43 monsters updated

### 2. Alignments Fix ✅  
- **Source**: Tags (rich text)
- **Target**: Alignment (select)
- **Values**: Lawful Good, Chaotic Evil, etc.
- **Status**: Deployed and tested
- **Results**: 60 monsters updated

## 🚀 **Usage**

### Run Individual Fixes
```bash
# Creature types
node debug-fix-creature-types.js

# Alignments  
node debug-fix-alignments.js
```

### Run All Fixes
```bash
node run-all-fixes.js
```

## 🛠️ **Adding New Field Fixes**

To add a new field fix (e.g., Size, Environment), follow this pattern:

### 1. Create New Function
```typescript
// supabase/functions/fix-sizes/index.ts
import { FieldFixConfig, extractMonsterRecords, processFieldFix } from '../_shared/field-fix-utils.ts'

const SIZE_VALUES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']

const config: FieldFixConfig = {
  sourceField: 'Tags',
  targetField: 'Size', 
  targetType: 'select',
  multiSelectField: 'Monster Tags',
  validValues: SIZE_VALUES
}

// ... rest follows same pattern
```

### 2. Create Test Script
```javascript
// debug-fix-sizes.js
async function testFixSizes() {
  // ... follows same pattern as other debug scripts
}
```

### 3. Deploy and Test
```bash
npx supabase functions deploy fix-sizes
node debug-fix-sizes.js
```

## 📊 **Field Types Supported**

### Select Fields
- Single choice from predefined options
- Example: Alignment, Size
- Uses `{ select: { name: value } }`

### Relation Fields  
- Links to records in other databases
- Example: Creature Type, Challenge Rating
- Uses `{ relation: [{ id: relationId }] }`
- Requires relation lookup map

### Multi-Select Fields
- Multiple tags/categories
- Example: Monster Tags, Environments
- Uses `{ multi_select: [{ name: tag1 }, { name: tag2 }] }`

## 🔍 **Utility Functions**

### `extractMonsterRecords()`
- Extracts relevant monsters from query results
- Filters based on field configuration
- Returns standardized monster objects

### `findMatchingValue()`
- Searches text for valid values
- Supports arrays or lookup maps
- Case-insensitive matching

### `cleanTagsText()`
- Removes matched values from text
- Handles commas and spacing
- Normalizes whitespace

### `buildUpdateData()`
- Creates Notion API update payload
- Handles different field types
- Updates multiple fields atomically

### `processFieldFix()`
- Main orchestration function
- Processes all monsters
- Provides detailed results and logging

## 🛡️ **Error Handling**

- **Individual failures**: Continue processing other monsters
- **Rate limiting**: Built-in delays between API calls
- **Validation**: Check for required values and IDs
- **Logging**: Detailed success/failure information
- **Rollback**: All changes logged for manual reversal

## 📈 **Performance**

- **Batch processing**: Up to 100 monsters per run
- **Rate limiting**: 100ms delay between updates
- **Efficient queries**: Targeted filtering to reduce API calls
- **Parallel processing**: Multiple field types can run independently

## 🎯 **Future Enhancements**

### Potential New Field Fixes
- **Size**: Extract from Tags → Size select field
- **Environment**: Extract from Tags → Environments relation
- **Challenge Rating**: Extract from Tags → Challenge Rating relation
- **Sources**: Extract from Tags → Source select field

### Advanced Features
- **Batch operations**: Process multiple field types in one run
- **Conditional logic**: More complex matching rules
- **Data validation**: Pre-flight checks before updates
- **Rollback functionality**: Automated undo operations

## 📚 **Files Reference**

### Core Files
- `supabase/functions/_shared/field-fix-utils.ts` - Shared utilities
- `supabase/functions/_shared/notion-utils.ts` - Notion API helpers

### Implementations
- `supabase/functions/fix-creature-types/index.ts` - Creature type fixes
- `supabase/functions/fix-alignments/index.ts` - Alignment fixes

### Test Scripts
- `debug-fix-creature-types.js` - Test creature types
- `debug-fix-alignments.js` - Test alignments
- `run-all-fixes.js` - Run all fixes together

### Documentation
- `README-creature-fix.md` - Original creature type documentation
- `README-modular-fixes.md` - This documentation
- `COMPLETION-SUMMARY.md` - Project completion summary

## 💡 **Best Practices**

1. **Test first**: Always test with small batches
2. **Backup data**: Export before running fixes
3. **Review logs**: Check results before running on full dataset
4. **Incremental**: Run fixes for one field type at a time initially
5. **Monitor**: Watch for rate limiting or API errors
