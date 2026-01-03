export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      app_statuses: {
        Row: {
          id: string
          platform: 'any' | 'android' | 'ios'
          environment: 'production' | 'staging' | 'development'
          is_maintenance: boolean
          maintenance_message: string | null
          maintenance_started_at: string | null
          maintenance_expected_end_at: string | null
          requires_update: boolean
          min_version_code: number | null
          min_version_name: string | null
          update_url_android: string | null
          update_url_ios: string | null
          changed_at: string
        }
        Insert: Partial<Database['public']['Tables']['app_statuses']['Row']>
        Update: Partial<Database['public']['Tables']['app_statuses']['Row']>
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string | null
          operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'REORDER' | 'BULK_UPDATE' | 'BULK_DELETE'
          old_record: Json | null
          new_record: Json | null
          changed_by: string | null
          band_id: string | null
          changed_at: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          role: string | null
          is_active: boolean | null
          is_approved: boolean | null
          has_password: boolean | null
          preferences: Json | null
          phone: string | null
          is_super_admin: boolean | null
        }
      }
      songs: {
        Row: {
          id: string
          title: string
          artist: string
          key: string | null
          tempo: string | null
          created_at: string | null
        }
      }
      gigs: {
        Row: {
          id: string
          name: string
          venue_name: string | null
          start_time: string
          is_active: boolean | null
        }
      }
    }
  }
}