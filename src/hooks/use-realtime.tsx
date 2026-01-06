import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseRealtimeOptions {
  table: string;
  queryKey: any[];
  filter?: string; // e.g., "id=eq.123"
  enabled?: boolean;
}

export const useRealtime = ({ table, queryKey, filter, enabled = true }: UseRealtimeOptions) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`public:${table}:${filter || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter,
        },
        (payload) => {
          console.log(`Realtime update on ${table}:`, payload);
          // Invalidate the query to trigger a refetch
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // console.log(`Subscribed to realtime updates for ${table}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, queryKey, queryClient, enabled]);
};