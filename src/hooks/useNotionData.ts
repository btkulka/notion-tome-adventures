import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NotionCreature {
  id: string;
  name: string;
  type: string;
  challenge_rating: number;
  xp_value: number;
  armor_class: number;
  hit_points: number;
  environment: string[];
  alignment: string;
  size: string;
}

export interface NotionEnvironment {
  id: string;
  name: string;
  description: string;
  terrain_type: string[];
  climate: string;
}

export interface GeneratedEncounter {
  id: string;
  environment: string;
  totalXP: number;
  baseXP: number;
  difficulty: string;
  monsters: Array<{
    name: string;
    quantity: number;
    cr: number;
    xp: number;
    total_xp: number;
    type: string;
    alignment: string;
    size: string;
  }>;
  generationLog: string[];
  parameters: any;
}

// Hook for fetching creatures from Notion
export const useNotionCreatures = () => {
  const [creatures, setCreatures] = useState<NotionCreature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCreatures = async (filters: any = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching creatures with filters:', filters);
      
      const { data, error } = await supabase.functions.invoke('fetch-creatures', {
        body: filters,
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to fetch creatures from Notion');
      }
      
      if (!data || !data.creatures) {
        throw new Error('Invalid response format from creatures endpoint');
      }
      
      console.log(`Successfully fetched ${data.creatures.length} creatures`);
      setCreatures(data.creatures);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch creatures. Please check your Notion configuration.';
      setError(errorMessage);
      console.error('Error fetching creatures:', err);
      setCreatures([]);
    } finally {
      setLoading(false);
    }
  };

  return { creatures, loading, error, fetchCreatures };
};

// Hook for fetching environments from Notion
export const useNotionEnvironments = () => {
  const [environments, setEnvironments] = useState<NotionEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching environments from Notion...');
        
        const { data, error } = await supabase.functions.invoke('fetch-environments');

        if (error) {
          console.error('Supabase function error:', error);
          throw new Error(error.message || 'Failed to fetch environments from Notion');
        }
        
        if (!data || !data.environments) {
          throw new Error('Invalid response format from environments endpoint');
        }
        
        console.log(`Successfully fetched ${data.environments.length} environments`);
        setEnvironments(data.environments);
    } catch (err: any) {
      let errorMessage = 'Failed to fetch environments. Please check your Notion configuration.';
      
      if (err.message?.includes('NOTION_API_KEY')) {
        errorMessage = 'Notion API key is not configured. Please set up your Notion integration.';
      } else if (err.message?.includes('database not found')) {
        errorMessage = 'Environments database not found in Notion. Please create a database with "environments" or "terrain" in the title.';
      } else if (err.message?.includes('Cannot read properties')) {
        errorMessage = 'Notion client initialization failed. Please check your API configuration.';
      }
      
      setError(errorMessage);
      console.error('Error fetching environments:', err);
      setEnvironments([]);
    } finally {
      setLoading(false);
    }
    };

    fetchEnvironments();
  }, []);

  return { environments, loading, error };
};

// Hook for generating encounters
export const useEncounterGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateEncounter = async (params: any): Promise<GeneratedEncounter | null> => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Generating encounter with params:', params);
      
      const { data, error } = await supabase.functions.invoke('generate-encounter', {
        body: params,
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to generate encounter');
      }
      
      if (!data || !data.encounter) {
        throw new Error('Invalid response format from encounter generation endpoint');
      }
      
      console.log('Successfully generated encounter:', data.encounter);
      return data.encounter;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate encounter. Please check your Notion configuration.';
      setError(errorMessage);
      console.error('Error generating encounter:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generateEncounter, loading, error };
};