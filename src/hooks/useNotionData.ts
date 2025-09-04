import { useState, useEffect } from 'react';
import { NotionService } from '@/lib/notion';
import { CreatureDTO, EnvironmentDTO, EncounterDTO } from '@/types/notion-dtos';

export const useNotionCreatures = () => {
  const [creatures, setCreatures] = useState<CreatureDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreatures = async () => {
      try {
        setLoading(true);
        const data = await NotionService.getCreatures();
        setCreatures(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch creatures from Notion');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatures();
  }, []);

  return { creatures, loading, error, refetch: () => {} };
};

export const useNotionEnvironments = () => {
  const [environments, setEnvironments] = useState<EnvironmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoading(true);
        const data = await NotionService.getEnvironments();
        setEnvironments(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch environments from Notion');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEnvironments();
  }, []);

  return { environments, loading, error, refetch: () => {} };
};

export const useNotionEncounters = () => {
  const [encounters, setEncounters] = useState<EncounterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEncounters = async () => {
      try {
        setLoading(true);
        const data = await NotionService.getEncounters();
        setEncounters(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch encounters from Notion');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEncounters();
  }, []);

  const saveEncounter = async (encounter: EncounterDTO) => {
    try {
      const id = await NotionService.saveEncounter(encounter);
      if (id) {
        // Refresh the encounters list
        const data = await NotionService.getEncounters();
        setEncounters(data);
        return id;
      }
      throw new Error('Failed to save encounter');
    } catch (err) {
      setError('Failed to save encounter to Notion');
      console.error(err);
      throw err;
    }
  };

  return { encounters, loading, error, saveEncounter, refetch: () => {} };
};