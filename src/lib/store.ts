import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { get, set as setItem, del } from 'idb-keyval';

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
  lastSyncedAt: Date | null;
  lastSyncedVersion: number;
  isInitialized: boolean;
  isLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  isOnline: boolean;

  // Actions
  initialize: () => Promise<void>;
  syncDeltas: () => Promise<void>;
  reset: () => Promise<void>;
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

export const useStore = create<SyncState>((set, getStore) => ({
  profiles: {},
  songs: {},
  gigs: {},
  setlists: {},
  sets: {},
  set_songs: {},
  
  lastSyncedAt: null,
  lastSyncedVersion: 0,
  isInitialized: false,
  isLoading: false,
  loadingProgress: 0,
  loadingMessage: '',
  isOnline: navigator.onLine,

  initialize: async () => {
    if (getStore().isInitialized) return;

    set({ isLoading: true, loadingProgress: 0, loadingMessage: 'Loading local data...' });

    // Window online/offline listeners
    window.addEventListener('online', () => {
      set({ isOnline: true });
      getStore().syncDeltas();
    });
    window.addEventListener('offline', () => set({ isOnline: false }));

    // Visibility change (re-sync when app comes to foreground)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === 'visible' && getStore().isOnline) {
        getStore().syncDeltas();
      }
    });

    try {
      // 1. Load from IndexedDB
      const cached = await get(DB_KEY) as any;
      let currentVersion = 0;

      if (cached) {
        set({ 
          ...cached.data, 
          lastSyncedVersion: cached.lastSyncedVersion || 0,
          lastSyncedAt: cached.lastSyncedAt ? new Date(cached.lastSyncedAt) : null
        });
        currentVersion = cached.lastSyncedVersion || 0;
      }

      // 2. Initial Sync
      await getStore().syncDeltas();

      set({ isInitialized: true, isLoading: false });

      // 3. Start Realtime Subscription
      supabase.channel('global-sync-v3')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' }, 
          (payload) => {
             // If we receive a realtime message, we process it AND optionally trigger a delta sync 
             // if the version gap suggests we missed something.
             getStore().processRealtimeUpdate(payload);
          }
        )
        .subscribe((status) => {
           if (status === 'SUBSCRIBED') {
             console.log('Realtime connected');
           }
        });

      // 4. Polling Fallback (every 5 minutes)
      setInterval(() => {
        if (getStore().isOnline && !document.hidden) {
           getStore().syncDeltas();
        }
      }, 5 * 60 * 1000);

    } catch (err) {
      console.error("Init failed:", err);
      set({ 
        isLoading: false, 
        isInitialized: true, // Allow app to render even if offline/failed
        loadingMessage: 'Offline Mode' 
      });
    }
  },

  syncDeltas: async () => {
    const currentVersion = getStore().lastSyncedVersion;
    set({ loadingMessage: 'Checking for updates...', isOnline: true });
    
    try {
      const totalTables = PERSISTED_TABLES.length;
      let processedTables = 0;
      let maxVersionFound = currentVersion;
      let hasChanges = false;
      
      const newState: any = {};
      PERSISTED_TABLES.forEach(t => {
         newState[t] = { ...getStore()[t as keyof SyncState] as object };
      });

      for (const table of PERSISTED_TABLES) {
        // Fetch only deltas
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('version', currentVersion);

        if (error) throw error;

        if (data && data.length > 0) {
          hasChanges = true;
          data.forEach((row: any) => {
            if (row.version > maxVersionFound) maxVersionFound = row.version;
            newState[table][row.id] = row;
          });
        }
        
        processedTables++;
        // Only update progress if we are in the initial loading phase
        if (getStore().isLoading) {
           set({ loadingProgress: (processedTables / totalTables) * 100 });
        }
      }

      const now = new Date();

      if (hasChanges) {
        set({ 
          ...newState, 
          lastSyncedVersion: maxVersionFound,
          lastSyncedAt: now
        });
        
        // Persist
        await setItem(DB_KEY, {
          data: newState,
          lastSyncedVersion: maxVersionFound,
          lastSyncedAt: now.toISOString()
        });
        console.log("Sync complete. New Version:", maxVersionFound);
      } else {
        set({ lastSyncedAt: now });
        console.log("Up to date.");
      }

    } catch (err) {
      console.error("Delta sync failed:", err);
      // Don't block UI on background sync fail
    }
  },

  reset: async () => {
    try {
      // 1. Clear IndexedDB
      await del(DB_KEY);
      
      // 2. Clear State
      set({
        profiles: {},
        songs: {},
        gigs: {},
        setlists: {},
        sets: {},
        set_songs: {},
        lastSyncedVersion: 0,
        lastSyncedAt: null,
        isInitialized: false
      });
      
      console.log("Local data cleared.");
    } catch (e) {
      console.error("Failed to clear local data:", e);
    }
  },

  processRealtimeUpdate: async (payload) => {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    
    if (!PERSISTED_TABLES.includes(table)) return;

    const state = getStore();
    // @ts-ignore
    const currentTableMap = state[table] as Record<string, any>;
    const newTableMap = { ...currentTableMap };
    let updatedVersion = state.lastSyncedVersion;
    
    if (eventType === 'DELETE') {
       if (oldRecord?.id) delete newTableMap[oldRecord.id];
    } else if (newRecord) {
       newTableMap[newRecord.id] = newRecord;
       if (newRecord.version > updatedVersion) updatedVersion = newRecord.version;
    }

    // @ts-ignore
    set({ [table]: newTableMap, lastSyncedVersion: updatedVersion, lastSyncedAt: new Date() });

    const fullStateToSave: any = {};
    PERSISTED_TABLES.forEach(t => {
       // @ts-ignore
       fullStateToSave[t] = getStore()[t];
    });
    
    await setItem(DB_KEY, {
      data: fullStateToSave,
      lastSyncedVersion: updatedVersion,
      lastSyncedAt: new Date().toISOString()
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