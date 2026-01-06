import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { get, set as setItem } from 'idb-keyval';

// --- Types ---
export interface SyncState {
  // Persisted Tables
  profiles: Record<string, any>;
  songs: Record<string, any>;
  gigs: Record<string, any>;
  setlists: Record<string, any>;
  sets: Record<string, any>;
  set_songs: Record<string, any>;
  
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

const PERSISTED_TABLES = [
  'profiles',
  'songs', 
  'gigs', 
  'setlists', 
  'sets', 
  'set_songs', 
];

const DB_KEY = 'dyad-local-cache-v1';

export const useStore = create<SyncState>((set, get) => ({
  profiles: {},
  songs: {},
  gigs: {},
  setlists: {},
  sets: {},
  set_songs: {},
  
  lastSyncedVersion: 0,
  isInitialized: false,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',

  initialize: async () => {
    if (get().isInitialized || get().isLoading) return;

    set({ isLoading: true, loadingProgress: 0, loadingMessage: 'Loading local data...' });

    try {
      // 1. Load from IndexedDB
      const cached = await get(DB_KEY);
      let currentVersion = 0;

      if (cached) {
        set({ 
          ...cached.data, 
          lastSyncedVersion: cached.lastSyncedVersion || 0 
        });
        currentVersion = cached.lastSyncedVersion || 0;
        console.log("Loaded from cache. Version:", currentVersion);
      }

      // 2. Fetch Deltas from Supabase
      set({ loadingMessage: 'Checking for updates...' });
      
      const totalTables = PERSISTED_TABLES.length;
      let processedTables = 0;
      let maxVersionFound = currentVersion;
      let hasChanges = false;

      // We clone the current state to apply updates
      const newState: any = {};
      // Copy existing state to newState accumulator
      PERSISTED_TABLES.forEach(t => {
         newState[t] = { ...get()[t as keyof SyncState] as object };
      });

      for (const table of PERSISTED_TABLES) {
        // Only fetch rows newer than our local version
        // We include deleted rows so we can remove them locally
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('version', currentVersion);

        if (error) throw error;

        if (data && data.length > 0) {
          hasChanges = true;
          // Apply Deltas
          data.forEach((row: any) => {
            if (row.version > maxVersionFound) maxVersionFound = row.version;
            
            // If deleted_at is set, remove from local store
            // Note: In some designs, you keep soft-deletes. 
            // Here, we remove from the UI-facing store map for cleanliness,
            // but we might want to keep them if we need to sync them back?
            // Actually, simply updating the record with the 'deleted_at' field is safer 
            // so UI can filter them out, rather than deleting the key (which is a hard delete).
            // Let's store the row as is (with deleted_at) so useItems can filter it.
            
            newState[table][row.id] = row;
          });
        }
        
        processedTables++;
        set({ loadingProgress: (processedTables / totalTables) * 100 });
      }

      // 3. Update State & Persist
      if (hasChanges) {
        set({ 
          ...newState, 
          lastSyncedVersion: maxVersionFound,
          isInitialized: true, 
          isLoading: false, 
          loadingMessage: 'Sync Complete' 
        });
        
        // Save to IDB
        await setItem(DB_KEY, {
          data: newState,
          lastSyncedVersion: maxVersionFound
        });
        console.log("Sync complete. New Version:", maxVersionFound);
      } else {
        set({ 
          isInitialized: true, 
          isLoading: false, 
          loadingMessage: 'Up to date' 
        });
        console.log("Up to date.");
      }

      // 4. Start Realtime Subscription
      // We subscribe to all changes. When a change comes, we apply it and update IDB.
      supabase.channel('global-sync-v2')
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
      // Even if sync fails, we mark initialized if we had cache, so app is usable offline
      set({ 
        isLoading: false, 
        isInitialized: true, 
        loadingMessage: 'Offline Mode' 
      });
    }
  },

  processRealtimeUpdate: async (payload) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    
    if (!PERSISTED_TABLES.includes(table)) return;

    const state = get();
    // @ts-ignore
    const currentTableMap = state[table] as Record<string, any>;
    const newTableMap = { ...currentTableMap };
    let updatedVersion = state.lastSyncedVersion;
    
    if (eventType === 'DELETE') {
       // Hard delete from DB -> Hard delete locally
       if (oldRecord?.id) delete newTableMap[oldRecord.id];
    } else if (newRecord) {
       // Insert or Update (Soft delete comes here as Update with deleted_at set)
       newTableMap[newRecord.id] = newRecord;
       if (newRecord.version > updatedVersion) updatedVersion = newRecord.version;
    }

    // Update Store
    // @ts-ignore
    set({ [table]: newTableMap, lastSyncedVersion: updatedVersion });

    // Update IDB (Debounce this in prod, but fine for now)
    const fullStateToSave: any = {};
    PERSISTED_TABLES.forEach(t => {
       // @ts-ignore
       fullStateToSave[t] = get()[t];
    });
    
    await setItem(DB_KEY, {
      data: fullStateToSave,
      lastSyncedVersion: updatedVersion
    });
  }
}));

// --- Selectors ---

export const useItems = (table: keyof SyncState, includeDeleted = false) => {
  // @ts-ignore
  const map = useStore(state => state[table] as Record<string, any>);
  if (!map) return [];
  return Object.values(map).filter(item => includeDeleted || !item.deleted_at);
};

export const useItem = (table: keyof SyncState, id: string | undefined) => {
  // @ts-ignore
  const map = useStore(state => state[table] as Record<string, any>);
  return id ? map[id] : undefined;
};