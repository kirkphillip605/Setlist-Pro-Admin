import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Radio, 
  Users, 
  Crown, 
  StopCircle, 
  Hand, 
  Music2,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/use-realtime";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const GigSessions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Subscribe to all relevant tables for realtime updates
  useRealtime({ table: 'gig_sessions', queryKey: ['active-sessions'] });
  useRealtime({ table: 'gig_session_participants', queryKey: ['active-sessions'] });
  useRealtime({ table: 'leadership_requests', queryKey: ['active-sessions'] });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: async () => {
      // 1. Fetch Active Sessions
      const { data: activeSessions, error } = await supabase
        .from('gig_sessions')
        .select(`
          *,
          gigs (name, venue_name),
          leader:profiles!gig_sessions_leader_id_fkey (id, first_name, last_name, email)
        `)
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // 2. Fetch Participants & Requests for these sessions
      const sessionIds = activeSessions.map(s => s.id);
      
      const [participantsRes, requestsRes] = await Promise.all([
         sessionIds.length > 0 ? supabase
            .from('gig_session_participants')
            .select('session_id, user:profiles(id, first_name, last_name, email), last_seen')
            .in('session_id', sessionIds) : { data: [] },
         sessionIds.length > 0 ? supabase
            .from('leadership_requests')
            .select('session_id, requester:profiles(first_name, last_name), status')
            .eq('status', 'pending')
            .in('session_id', sessionIds) : { data: [] }
      ]);

      // Merge data
      return activeSessions.map(session => ({
        ...session,
        participants: participantsRes.data?.filter(p => p.session_id === session.id) || [],
        requests: requestsRes.data?.filter(r => r.session_id === session.id) || []
      }));
    }
  });

  // Actions
  const endSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('gig_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Session ended" }),
    onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  const promoteToLeader = useMutation({
    mutationFn: async ({ sessionId, userId }: { sessionId: string, userId: string }) => {
      const { error } = await supabase
        .from('gig_sessions')
        .update({ leader_id: userId })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Leader updated" }),
    onError: (e) => toast({ variant: "destructive", title: "Error", description: e.message })
  });

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Radio className="h-8 w-8 text-red-500 animate-pulse" /> Live Sessions
          </h1>
          <p className="text-muted-foreground">Monitor and manage active performance sessions.</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
           <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">Loading sessions...</div>
        ) : sessions?.length === 0 ? (
          <div className="col-span-full border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground flex flex-col items-center">
            <Radio className="h-12 w-12 opacity-20 mb-4" />
            <h3 className="text-lg font-medium">No Active Sessions</h3>
            <p>When users start a performance mode session, it will appear here.</p>
          </div>
        ) : sessions?.map(session => (
          <Card key={session.id} className="border-l-4 border-l-green-500 shadow-sm relative overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20">
               <div className="flex justify-between items-start">
                  <div>
                     <CardTitle className="flex items-center gap-2 text-xl">
                        {session.gigs?.name || "Ad-hoc Session"}
                     </CardTitle>
                     <CardDescription className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1"><Music2 className="h-3 w-3"/> Set {session.current_set_index + 1} • Song {session.current_song_index + 1}</span>
                        <span>•</span>
                        <span>Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}</span>
                     </CardDescription>
                  </div>
                  <Badge variant={session.is_on_break ? "secondary" : "default"} className={session.is_on_break ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}>
                     {session.is_on_break ? "ON BREAK" : "LIVE"}
                  </Badge>
               </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
               {/* Leader Section */}
               <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center gap-3">
                     <div className="relative">
                        <Avatar>
                           <AvatarFallback className="bg-primary text-primary-foreground">{session.leader?.first_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-1 -right-1 bg-yellow-400 text-white rounded-full p-0.5 shadow-sm">
                           <Crown className="h-3 w-3 fill-current" />
                        </div>
                     </div>
                     <div>
                        <p className="font-medium text-sm">Session Leader</p>
                        <p className="text-sm text-muted-foreground">{session.leader?.first_name} {session.leader?.last_name}</p>
                     </div>
                  </div>
                  {session.requests?.length > 0 && (
                     <TooltipProvider>
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <Badge variant="destructive" className="animate-pulse cursor-help">
                                 <Hand className="h-3 w-3 mr-1" /> {session.requests.length} Request{session.requests.length !== 1 && 's'}
                              </Badge>
                           </TooltipTrigger>
                           <TooltipContent>
                              <p>Users requesting leadership:</p>
                              <ul className="list-disc pl-4 text-xs mt-1">
                                 {session.requests.map((r:any) => (
                                    <li key={r.requester.first_name}>{r.requester.first_name} {r.requester.last_name}</li>
                                 ))}
                              </ul>
                           </TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                  )}
               </div>

               {/* Participants Grid */}
               <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                     <Users className="h-4 w-4" /> Active Participants ({session.participants.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {session.participants.map((p: any) => {
                        const isLeader = p.user?.id === session.leader_id;
                        return (
                           <div key={p.user?.id} className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors group">
                              <div className="flex items-center gap-2">
                                 <div className={`h-2 w-2 rounded-full ${isLeader ? 'bg-yellow-400' : 'bg-green-500'}`} />
                                 <span className="text-sm font-medium truncate max-w-[120px]">
                                    {p.user?.first_name} {p.user?.last_name}
                                 </span>
                              </div>
                              {!isLeader && (
                                 <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => promoteToLeader.mutate({ sessionId: session.id, userId: p.user.id })}
                                 >
                                    Promote
                                 </Button>
                              )}
                           </div>
                        );
                     })}
                     {session.participants.length === 0 && (
                        <p className="text-xs text-muted-foreground italic col-span-2">No other participants connected.</p>
                     )}
                  </div>
               </div>

               <div className="pt-4 border-t flex justify-end">
                  <Button 
                     variant="destructive" 
                     size="sm"
                     onClick={() => {
                        if(confirm("Are you sure you want to forcibly end this session for all users?")) endSession.mutate(session.id);
                     }}
                  >
                     <StopCircle className="mr-2 h-4 w-4" /> End Session
                  </Button>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
};

export default GigSessions;