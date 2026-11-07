export type CampaignRole = 'dm' | 'player';

/** What a Notion handler may ask about the signed-in caller. */
export interface NotionContext {
  campaignRole(campaignId: string): Promise<CampaignRole | null>;
}
