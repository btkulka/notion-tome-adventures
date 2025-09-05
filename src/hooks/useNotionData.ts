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
      
      const { data, error } = await supabase.functions.invoke('fetch-creatures', {
        body: filters,
      });

      if (error) throw error;
      
      setCreatures(data.creatures || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch creatures');
      console.error('Error fetching creatures:', err);
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
        
        const { data, error } = await supabase.functions.invoke('fetch-environments');

        if (error) throw error;
        
        setEnvironments(data.environments || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch environments');
        console.error('Error fetching environments:', err);
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
      
      const { data, error } = await supabase.functions.invoke('generate-encounter', {
        body: params,
      });

      if (error) throw error;
      
      return data.encounter;
    } catch (err: any) {
      setError(err.message || 'Failed to generate encounter');
      console.error('Error generating encounter:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generateEncounter, loading, error };
};