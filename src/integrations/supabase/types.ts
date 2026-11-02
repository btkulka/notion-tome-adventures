export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          prompt: string | null
          seed: number | null
          storage_path: string
          workflow: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          prompt?: string | null
          seed?: number | null
          storage_path: string
          workflow?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          prompt?: string | null
          seed?: number | null
          storage_path?: string
          workflow?: string | null
        }
        Relationships: []
      }
      campaign_invites: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          max_uses: number | null
          uses: number
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          max_uses?: number | null
          uses?: number
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          max_uses?: number | null
          uses?: number
        }
        Relationships: []
      }
      campaign_members: {
        Row: {
          campaign_id: string
          character_notion_id: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          character_notion_id?: string | null
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          character_notion_id?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dm_allowlist: {
        Row: {
          created_at: string
          discord_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          discord_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          discord_id?: string
          note?: string | null
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          active_map_id: string | null
          campaign_id: string
          notion_session_id: string | null
          party_map_id: string | null
          party_x: number
          party_y: number
          status: string
          updated_at: string
          weather: string
          world_minutes: number
        }
        Insert: {
          active_map_id?: string | null
          campaign_id: string
          notion_session_id?: string | null
          party_map_id?: string | null
          party_x?: number
          party_y?: number
          status?: string
          updated_at?: string
          weather?: string
          world_minutes?: number
        }
        Update: {
          active_map_id?: string | null
          campaign_id?: string
          notion_session_id?: string | null
          party_map_id?: string | null
          party_x?: number
          party_y?: number
          status?: string
          updated_at?: string
          weather?: string
          world_minutes?: number
        }
        Relationships: []
      }
      map_fog: {
        Row: {
          explored: string
          map_id: string
          updated_at: string
        }
        Insert: {
          explored: string
          map_id: string
          updated_at?: string
        }
        Update: {
          explored?: string
          map_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_objects: {
        Row: {
          created_at: string
          data: Json
          hidden: boolean
          id: string
          map_id: string
          rot: number
          type: string
          updated_at: string
          x: number
          y: number
          z: number
        }
        Insert: {
          created_at?: string
          data?: Json
          hidden?: boolean
          id?: string
          map_id: string
          rot?: number
          type: string
          updated_at?: string
          x?: number
          y?: number
          z?: number
        }
        Update: {
          created_at?: string
          data?: Json
          hidden?: boolean
          id?: string
          map_id?: string
          rot?: number
          type?: string
          updated_at?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: []
      }
      maps: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          gen_params: Json | null
          height: number
          id: string
          kind: string
          name: string
          parent_map_id: string | null
          parent_pin_id: string | null
          scale: number
          seed: number
          settings: Json
          terrain: Json
          thumbnail_path: string | null
          updated_at: string
          version: number
          width: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          gen_params?: Json | null
          height: number
          id?: string
          kind: string
          name: string
          parent_map_id?: string | null
          parent_pin_id?: string | null
          scale?: number
          seed?: number
          settings?: Json
          terrain: Json
          thumbnail_path?: string | null
          updated_at?: string
          version?: number
          width: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          gen_params?: Json | null
          height?: number
          id?: string
          kind?: string
          name?: string
          parent_map_id?: string | null
          parent_pin_id?: string | null
          scale?: number
          seed?: number
          settings?: Json
          terrain?: Json
          thumbnail_path?: string | null
          updated_at?: string
          version?: number
          width?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_id: string | null
          discord_username: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      travel_log: {
        Row: {
          campaign_id: string
          created_at: string
          encounter: Json | null
          from_x: number
          from_y: number
          id: string
          map_id: string
          miles: number
          minutes: number
          pace: string
          path: Json
          started_at: number
          to_x: number
          to_y: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          encounter?: Json | null
          from_x: number
          from_y: number
          id?: string
          map_id: string
          miles: number
          minutes: number
          pace: string
          path: Json
          started_at: number
          to_x: number
          to_y: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          encounter?: Json | null
          from_x?: number
          from_y?: number
          id?: string
          map_id?: string
          miles?: number
          minutes?: number
          pace?: string
          path?: Json
          started_at?: number
          to_x?: number
          to_y?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_campaign: { Args: { cid: string }; Returns: undefined }
      claim_character: { Args: { character_id: string; cid: string }; Returns: undefined }
      is_campaign_dm: { Args: { cid: string }; Returns: boolean }
      is_campaign_member: { Args: { cid: string }; Returns: boolean }
      is_dm: { Args: Record<PropertyKey, never>; Returns: boolean }
      join_campaign: { Args: { invite_code: string }; Returns: string }
      map_campaign: { Args: { mid: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
