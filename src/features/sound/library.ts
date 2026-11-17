// The campaign's sound library and scenes, cached across visits (lib/cached.ts)
// and shared by the mixer and the library panel.
import { useCached } from '@/lib/cached';
import { soundsApi } from './api';

export const useLibrary = (campaignId: string) => useCached(['sounds', campaignId], () => soundsApi.list(campaignId));
export const useScenes = (campaignId: string) => useCached(['sound-scenes', campaignId], () => soundsApi.scenes(campaignId));
