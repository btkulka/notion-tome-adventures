// Shared utilities for fixing fields in Notion databases
// This module provides reusable functions for processing tag-based field updates

export interface FieldFixConfig {
  sourceField: string;           // The rich text field containing values to extract (e.g., "Tags")
  targetField: string;           // The field to update (e.g., "Creature Type", "Alignment")
  targetType: 'relation' | 'select';  // Type of target field
  multiSelectField?: string;     // Optional multi-select field to also update (e.g., "Monster Tags")
  validValues: string[] | Map<string, string>;  // Valid values or lookup map
}

export interface ProcessResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  details: any[];
}

export interface MonsterRecord {
  id: string;
  name: string;
  tags: string;
  currentValue?: string;
  currentTags?: string[];
}

/**
 * Extract monster records that need processing
 */
export function extractMonsterRecords(
  pages: any[],
  config: FieldFixConfig,
  nameField: string = 'Monster Name'
): MonsterRecord[] {
  const records: MonsterRecord[] = [];
  
  for (const page of pages) {
    const props = page.properties;
    
    // Extract monster name
    let name = 'Unknown Monster';
    if (props?.[nameField]?.title?.[0]?.plain_text) {
      name = props[nameField].title[0].plain_text;
    }
    
    // Extract tags text
    let tagsText = '';
    if (props?.[config.sourceField]?.rich_text?.[0]?.plain_text) {
      tagsText = props[config.sourceField].rich_text[0].plain_text;
    }
    
    // Extract current multi-select tags if applicable
    const currentTags = config.multiSelectField 
      ? props?.[config.multiSelectField]?.multi_select?.map((tag: any) => tag.name) || []
      : [];
    
    // Extract current value in target field
    let currentValue: string | undefined;
    if (config.targetType === 'select') {
      currentValue = props?.[config.targetField]?.select?.name;
    } else if (config.targetType === 'relation') {
      // For relations, we'd need to resolve the ID - skip for now if already has value
      currentValue = props?.[config.targetField]?.relation?.length > 0 ? 'has_value' : undefined;
    }
    
    // Only process if there are tags and no current value (or explicitly empty)
    if (tagsText.trim() && !currentValue) {
      records.push({
        id: page.id,
        name: name.trim(),
        tags: tagsText.trim(),
        currentValue,
        currentTags
      });
    }
  }
  
  return records;
}

/**
 * Find matching value in tags text
 */
export function findMatchingValue(
  tagsText: string, 
  validValues: string[] | Map<string, string>
): { found: string | null; matchedText: string | null } {
  const lowerTags = tagsText.toLowerCase();
  
  if (Array.isArray(validValues)) {
    // Simple array lookup
    for (const value of validValues) {
      if (lowerTags.includes(value.toLowerCase())) {
        return { found: value, matchedText: value };
      }
    }
  } else {
    // Map lookup (key = text to find in tags, value = actual field value)
    for (const [searchText, fieldValue] of validValues.entries()) {
      if (lowerTags.includes(searchText.toLowerCase())) {
        return { found: fieldValue, matchedText: searchText };
      }
    }
  }
  
  return { found: null, matchedText: null };
}

/**
 * Clean tags text by removing the matched value
 */
export function cleanTagsText(tagsText: string, matchedText: string): string {
  const regex = new RegExp(matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let cleaned = tagsText.replace(regex, '').trim();
  
  // Clean up any extra commas or spaces
  cleaned = cleaned
    .replace(/,\s*,/g, ',')     // Remove double commas
    .replace(/^,\s*/, '')       // Remove leading comma
    .replace(/\s*,$/, '')       // Remove trailing comma
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();
  
  return cleaned;
}

/**
 * Build update data object for Notion API
 */
export function buildUpdateData(
  config: FieldFixConfig,
  foundValue: string,
  matchedText: string,
  originalTags: string,
  currentTags: string[],
  relationId?: string
): any {
  const updateData: any = {};
  
  // Update the target field
  if (config.targetType === 'select') {
    updateData[config.targetField] = {
      select: { name: foundValue }
    };
  } else if (config.targetType === 'relation' && relationId) {
    updateData[config.targetField] = {
      relation: [{ id: relationId }]
    };
  }
  
  // Update multi-select tags if specified
  if (config.multiSelectField) {
    const updatedTags = [...(currentTags || [])];
    if (!updatedTags.some(tag => tag.toLowerCase() === foundValue.toLowerCase())) {
      updatedTags.push(foundValue);
    }
    
    updateData[config.multiSelectField] = {
      multi_select: updatedTags.map(tagName => ({ name: tagName }))
    };
  }
  
  return updateData;
}

/**
 * Process a single monster record
 */
export async function processMonsterRecord(
  notion: any,
  monster: MonsterRecord,
  config: FieldFixConfig,
  relationLookup?: Map<string, string>
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    console.log(`\n🐉 Processing: ${monster.name}`);
    console.log(`   Tags: "${monster.tags}"`);
    
    // Find matching value in tags
    const { found, matchedText } = findMatchingValue(monster.tags, config.validValues);
    
    if (!found || !matchedText) {
      console.log(`   ⚠️ No matching ${config.targetField} found in tags`);
      return {
        success: false,
        result: {
          monster: monster.name,
          status: 'skipped',
          reason: `No matching ${config.targetField} found in tags`,
          tags: monster.tags
        }
      };
    }
    
    console.log(`   ✅ Found matching ${config.targetField}: ${found}`);
    
    // Clean tags text
    const updatedTagsText = cleanTagsText(monster.tags, matchedText);
    console.log(`   📝 Updated tags text: "${updatedTagsText}"`);
    
    // Get relation ID if needed
    let relationId: string | undefined;
    if (config.targetType === 'relation' && relationLookup) {
      relationId = relationLookup.get(found);
      if (!relationId) {
        console.log(`   ❌ No relation ID found for ${found}`);
        return {
          success: false,
          result: {
            monster: monster.name,
            status: 'error',
            error: `No relation ID found for ${found}`
          }
        };
      }
    }
    
    // Build update data
    const updateData = buildUpdateData(
      config,
      found,
      matchedText,
      monster.tags,
      monster.currentTags || [],
      relationId
    );
    
    // Update monster record
    await notion.pages.update({
      page_id: monster.id,
      properties: updateData
    });
    
    console.log(`   ✅ Successfully updated ${monster.name}`);
    
    return {
      success: true,
      result: {
        monster: monster.name,
        status: 'updated',
        foundValue: found,
        originalTags: monster.tags,
        updatedTagsText,
        updatedField: config.targetField
      }
    };
    
  } catch (error) {
    console.error(`   ❌ Error processing ${monster.name}:`, error);
    return {
      success: false,
      result: {
        monster: monster.name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Main processing function for field fixes with batch processing
 */
export async function processFieldFix(
  notion: any,
  monsters: MonsterRecord[],
  config: FieldFixConfig,
  relationLookup?: Map<string, string>,
  batchSize: number = 10
): Promise<ProcessResult> {
  console.log(`🔧 Processing ${monsters.length} monsters for ${config.targetField} in batches of ${batchSize}...`);
  
  const results: ProcessResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };
  
  // Process in batches
  for (let i = 0; i < monsters.length; i += batchSize) {
    const batch = monsters.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(monsters.length / batchSize);
    
    console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} monsters)...`);
    
    for (const monster of batch) {
      results.processed++;
      
      const result = await processMonsterRecord(notion, monster, config, relationLookup);
      
      if (result.success) {
        results.updated++;
      } else if (result.result.status === 'skipped') {
        results.skipped++;
      } else {
        results.errors++;
      }
      
      results.details.push(result.result);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Batch ${batchNum} completed: ${batch.length} monsters processed`);
    
    // Add a longer delay between batches
    if (i + batchSize < monsters.length) {
      console.log(`⏳ Pausing 2 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}
