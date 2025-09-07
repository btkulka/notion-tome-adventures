import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotionDiscovery, type DatabaseMatch, type DatabaseSchema, type NotionDatabase } from '@/hooks/useNotionDiscovery';
import { useToast } from '@/hooks/use-toast';

export const NotionDatabaseDiscovery = () => {
  const [discoveryResult, setDiscoveryResult] = useState<{ allDatabases: NotionDatabase[]; matches: DatabaseMatch[] } | null>(null);
  const [schemas, setSchemas] = useState<Record<string, DatabaseSchema>>({});
  const { discoverDatabases, getSchema, loading, error } = useNotionDiscovery();
  const { toast } = useToast();

  const handleDiscover = async () => {
    try {
      const result = await discoverDatabases();
      setDiscoveryResult(result);
      
      toast({
        title: "Discovery Complete",
        description: `Found ${result.allDatabases.length} databases in your Notion workspace`,
      });
    } catch (err) {
      toast({
        title: "Discovery Failed",
        description: "Failed to discover databases. Check your Notion API key.",
        variant: "destructive",
      });
    }
  };

  const handleGetSchema = async (databaseId: string, expectedName: string) => {
    try {
      const schema = await getSchema(databaseId);
      setSchemas(prev => ({ ...prev, [databaseId]: schema }));
      
      toast({
        title: "Schema Retrieved",
        description: `Got schema for ${expectedName} database`,
      });
    } catch (err) {
      toast({
        title: "Schema Failed",
        description: `Failed to get schema for ${expectedName}`,
        variant: "destructive",
      });
    }
  };

  const generateDTOs = () => {
    if (Object.keys(schemas).length === 0) return;

    const dtoCode = Object.values(schemas).map(schema => {
      const interfaceName = `${schema.title.replace(/[^a-zA-Z0-9]/g, '')}DTO`;
      
      const properties = schema.properties.map(prop => {
        let tsType = 'any';
        
        switch (prop.type) {
          case 'title':
          case 'rich_text':
          case 'select':
          case 'email':
          case 'phone_number':
          case 'url':
            tsType = 'string';
            break;
          case 'number':
            tsType = 'number';
            break;
          case 'checkbox':
            tsType = 'boolean';
            break;
          case 'date':
            tsType = 'string'; // ISO date string
            break;
          case 'multi_select':
            tsType = 'string[]';
            break;
          case 'files':
            tsType = 'Array<{ name: string; url: string; }>';
            break;
          case 'relation':
            tsType = 'string[]'; // Array of relation IDs
            break;
          case 'formula':
          case 'rollup':
            tsType = 'any'; // Depends on formula result
            break;
          default:
            tsType = 'any';
        }
        
        return `  ${prop.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}: ${tsType};`;
      }).join('\n');

      return `export interface ${interfaceName} {
  id: string;
${properties}
  created_time: string;
  last_edited_time: string;
}`;
    }).join('\n\n');

    // Copy to clipboard
    navigator.clipboard.writeText(dtoCode);
    
    toast({
      title: "DTOs Generated",
      description: "TypeScript DTOs copied to clipboard!",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notion Database Discovery</CardTitle>
          <CardDescription>
            Discover and analyze your Notion databases to create proper DTOs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleDiscover} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Discovering...' : 'Discover My Notion Databases'}
          </Button>
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {discoveryResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Matches</CardTitle>
              <CardDescription>
                Matched databases to expected D&D tables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {discoveryResult.matches.map((match, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{match.expectedName}</h4>
                    {match.matched && (
                      <Badge variant="outline">Matched</Badge>
                    )}
                  </div>
                  
                  {match.matched ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <strong>Found:</strong> {match.matched.title}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleGetSchema(match.matched!.id, match.expectedName)}
                          disabled={loading}
                        >
                          Get Schema
                        </Button>
                        {schemas[match.matched.id] && (
                          <Badge variant="secondary">Schema Retrieved</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">No exact match found</p>
                      {match.suggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium">Suggestions:</p>
                          {match.suggestions.map(suggestion => (
                            <div key={suggestion.id} className="flex items-center gap-2 mt-1">
                              <span className="text-xs">{suggestion.title}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGetSchema(suggestion.id, match.expectedName)}
                              >
                                Use This
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {Object.keys(schemas).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Retrieved Schemas</CardTitle>
                <CardDescription>
                  Database schemas ready for DTO generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.values(schemas).map(schema => (
                    <div key={schema.id} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">{schema.title}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {schema.properties.map(prop => (
                          <div key={prop.id} className="flex justify-between">
                            <span>{prop.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {prop.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <Button onClick={generateDTOs} className="w-full">
                    Generate TypeScript DTOs
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};