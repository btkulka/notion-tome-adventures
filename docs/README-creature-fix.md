# Creature Type Fix Script

This script automatically fixes creature type relations for monsters in your Notion D&D database by:

1. Retrieving all creature type records from your Creature Types database
2. Finding all monsters with blank creature type relations
3. Looking in each monster's Tags column to find their type
4. Setting the Monster's creature type relation to match the found type
5. Removing the creature type text from the Tags text column
6. Adding the Creature Type as a selected option in the Monster Tags multi-select field

## Setup Instructions

### 1. Discover Your Databases

First, run the database discovery script to identify your database IDs:

```bash
node discover-databases.js
```

This will show you all your Notion databases and help identify:
- Your existing `CREATURES_DATABASE_ID` (should already be configured)
- Your `CREATURE_TYPES_DATABASE_ID` (needs to be configured)

### 2. Configure Environment Variables

Set the creature types database ID in Supabase:

```bash
supabase secrets set CREATURE_TYPES_DATABASE_ID=your_creature_types_database_id
```

You can verify your current environment variables with:
```bash
supabase secrets list
```

### 3. Deploy the Function

Deploy the fix-creature-types function to Supabase:

```bash
supabase functions deploy fix-creature-types
```

### 4. Run the Fix Script

Execute the creature type fix:

```bash
node debug-fix-creature-types.js
```

## Expected Database Structure

### Creature Types Database
Should have records with these properties:
- **Name** (title): The name of the creature type (e.g., "Beast", "Dragon", "Humanoid")

### Creatures/Monsters Database  
Should have records with these properties:
- **Monster Name** or **Name** (title): The name of the monster
- **Tags** (rich text): Contains the creature type as text that needs to be removed
- **Tags** (multi-select): Where the creature type will be added as an option
- **Creature Type** or **Type** (relation): Links to the Creature Types database

## How It Works

### Algorithm Details

1. **Fetch Creature Types**: Gets all records from the Creature Types database
2. **Find Monsters**: Queries for monsters where the creature type relation is empty
3. **Type Matching**: For each monster, searches the Tags text for creature type names
4. **Update Relations**: Sets the Creature Type relation to the matching type record
5. **Clean Tags Text**: Removes the creature type name from the Tags rich text field
6. **Update Multi-Select**: Adds the creature type to the Tags multi-select field

### Example Process

**Before:**
- Monster: "Adult Red Dragon"
- Tags (text): "Dragon, Fire, Large, Legendary"  
- Tags (multi-select): ["Fire", "Large", "Legendary"]
- Creature Type: (empty)

**After:**
- Monster: "Adult Red Dragon"
- Tags (text): "Fire, Large, Legendary"
- Tags (multi-select): ["Fire", "Large", "Legendary", "Dragon"]  
- Creature Type: → Links to "Dragon" record

## Output and Results

The script provides detailed output including:
- Number of creature types found
- Number of monsters that need fixing
- Success/failure status for each monster
- Summary statistics
- Detailed logs of changes made

### Sample Output
```
🔧 Starting creature type fix process...
✅ Found 15 creature types:
  - Beast (abc123...)
  - Dragon (def456...)
  - Humanoid (ghi789...)

✅ Found 47 monsters to fix:
  - Adult Red Dragon: "Dragon, Fire, Large, Legendary"
  - Wolf: "Beast, Pack, Medium"
  ...

🎉 Process completed!
📊 Results:
   - Processed: 47
   - Updated: 42
   - Skipped: 3
   - Errors: 2
```

## Error Handling

The script handles several error conditions:
- **No matching type**: Skips monsters where no creature type is found in tags
- **API errors**: Logs and continues with other monsters
- **Rate limiting**: Includes delays between API calls
- **Malformed data**: Gracefully handles missing or unexpected properties

## Property Name Variations

The script checks multiple possible property names to handle different database schemas:

**Creature Names**: Monster Name, Name, Monster, Monsters, CreatureName, Title
**Creature Types**: Type, MonsterType, CreatureType, Creature Type, Category  
**Tags**: Tags, Tag

## Rollback Considerations

**Important**: This script modifies your Notion data. Consider:

1. **Backup**: Export your databases before running
2. **Test**: Run on a small subset first 
3. **Review**: Check the output logs before running on all data
4. **Manual Undo**: The script logs all changes, allowing manual reversal if needed

## Troubleshooting

### Common Issues

**"Database not found" errors**:
- Verify database IDs are correct
- Check Notion API permissions  
- Ensure integration has access to both databases

**"No matches found" errors**:
- Check that creature types exist in the Tags text
- Verify creature type names match exactly
- Consider case sensitivity in matching

**Rate limiting**:
- The script includes delays, but for very large datasets you may need longer delays
- Modify the `setTimeout` value in the script if needed

### Debug Mode

For additional debugging, you can modify the script to:
- Log more detailed property information
- Process only specific monsters
- Increase delay between API calls

## Files Created

- `supabase/functions/fix-creature-types/index.ts` - Main function
- `debug-fix-creature-types.js` - Test script to run the function  
- `discover-databases.js` - Database discovery helper
- `README-creature-fix.md` - This documentation
