import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// --- Types ---
export interface SyncState {
  profiles: Record<string, any>;
  songs: Record<string, any>;
  gigs: Record<string, any>;
  setlists: Record<string, any>;
  sets: Record<string, any>;
  set_songs: Record<string, any>;
  gig_sessions: Record<string, any>;
  gig_session_participants: Record<string, any>;
  
  // Meta
  lastSyncedVersion: number;
  isInitialized: boolean;
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;

  // Actions
  initialize: () => Promise<void>;
  processRealtimeUpdate: (payload: RealtimePostgresChangesPayload<any>) => void;
}

const TABLES_TO_SYNC = [
  'profiles',
  'songs', 
  'gigs', 
  'setlists', 
  'sets', 
  'set_songs', 
  'gig_sessions', 
  'gig_session_participants'
];

export const useStore = create<SyncState>((set, get) => ({
  profiles: {},
  songs: {},
  gigs: {},
  setlists: {},
  sets: {},
  set_songs: {},
  gig_sessions: {},
  gig_session_participants: {},
  
  lastSyncedVersion: 0,
  isInitialized: false,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',

  initialize: async () => {
    // Prevent double init
    if (get().isInitialized || get().isLoading) return;

    set({ isLoading: true, loadingProgress: 0, loadingMessage: 'Connecting...' });

    try {
      // 1. Fetch all data initially (Simple "Admin" approach: load everything)
      // In a more complex app, we'd use IndexedDB and only fetch delta > lastSyncedVersion
      const totalTables = TABLES_TO_SYNC.length;
      let loadedTables = 0;
      let maxVersion = 0;

      const newState: Partial<SyncState> = {};

      for (const table of TABLES_TO_SYNC) {
        set({ loadingMessage: `Syncing ${table}...` });
        
        // Fetch all active rows (not deleted) for the UI state
        // We include deleted_at rows in the fetch only if we need to process them, 
        // but for the cache "state", we usually only want active ones, or we filter later.
        // Let's store EVERYTHING so we can handle relational integrity if needed, 
        // but typically we just filter out deleted_at in selectors.
        
        const { data, error } = await supabase
          .from(table)
          .select('*'); // Load all

        if (error) throw error;

        // Convert array to Record<ID, Row>
        const tableMap: Record<string, any> = {};
        data?.forEach((row: any) => {
           tableMap[row.id] = row;
           if (row.version > maxVersion) maxVersion = row.version;
        });

        newState[table as keyof SyncState] = tableMap;
        
        loadedTables++;
        set({ loadingProgress: (loadedTables / totalTables) * 100 });
      }

      set({ 
        ...newState, 
        lastSyncedVersion: maxVersion,
        isInitialized: true, 
        isLoading: false,
        loadingMessage: 'Complete'
      });

      console.log("Initial Sync Complete. Max Version:", maxVersion);

      // 2. Set up Realtime Subscription
      supabase.channel('global-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' }, 
          (payload) => {
             get().processRealtimeUpdate(payload);
          }
        )
        .subscribe();

    } catch (err) {
      console.error("Sync failed:", err);
      set({ isLoading: false, loadingMessage: 'Sync failed. Please refresh.' });
    }
  },

  processRealtimeUpdate: async (payload) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    
    // Only handle tables we care about
    if (!TABLES_TO_SYNC.includes(table)) return;

    const state = get();
    const currentTableMap = state[table as keyof SyncState] as Record<string, any>;
    const newTableMap = { ...currentTableMap };
    
    // NOTE: The backend trigger 'handle_row_version' ensures newRecord has the new version.
    // However, for DELETE events, Supabase only sends 'old' record with ID. 
    // We implemented "Soft Delete" via UPDATE usually, but if a HARD DELETE happens:
    
    if (eventType === 'DELETE') {
       // Hard delete: remove from store
       if (oldRecord?.id) {
         delete newTableMap[oldRecord.id];
       }
    } else if (newRecord) {
       // INSERT or UPDATE
       // If it has a deleted_at, we still keep it in store, but selectors will filter it.
       // This matches "Server Source of Truth" where the row exists but is marked deleted.
       newTableMap[newRecord.id] = newRecord;
       
       // Update max version
       if (newRecord.version > state.lastSyncedVersion) {
         set({ lastSyncedVersion: newRecord.version });
       }
    }

    set({ [table as keyof SyncState]: newTableMap });
  }
}));

// --- Selectors ---

export const useItems = (table: keyof SyncState, includeDeleted = false) => {
  const map = useStore(state => state[table] as Record<string, any>);
  return Object.values(map).filter(item => includeDeleted || !item.deleted_at);
};

export const useItem = (table: keyof SyncState, id: string | undefined) => {
  const map = useStore(state => state[table] as Record<string, any>);
  return id ? map[id] : undefined;
};