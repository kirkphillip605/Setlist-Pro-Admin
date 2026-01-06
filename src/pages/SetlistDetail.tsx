import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Clock, 
  Music2, 
  Plus, 
  Trash2, 
  GripVertical, 
  ChevronUp, 
  ChevronDown, 
  Save, 
  X,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtime } from "@/hooks/use-realtime";

const SetlistDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Realtime subscriptions
  useRealtime({ table: 'setlists', queryKey: ['setlist', id], filter: `id=eq.${id}` });
  useRealtime({ table: 'sets', queryKey: ['setlist', id], filter: `setlist_id=eq.${id}` });
  // set_songs updates will trigger refetch via invalidate, but for complex nested logic we might rely on manual refetch after mutation for consistency
  // Ideally, useRealtime should handle it if we filter correctly, but complex relational updates can be race-y.

  // --- Data Fetching ---

  const { data: setlistData, isLoading } = useQuery({
    queryKey: ['setlist', id],
    queryFn: async () => {
      // 1. Fetch Setlist
      const { data: setlist, error: slError } = await supabase.from('setlists').select('*').eq('id', id!).single();
      if (slError) throw slError;

      // 2. Fetch Sets
      const { data: sets, error: sError } = await supabase.from('sets').select('*').eq('setlist_id', id!).order('position');
      if (sError) throw sError;

      // 3. Fetch Set Songs + Song Details
      const setIds = sets.map(s => s.id);
      let setSongs: any[] = [];
      if (setIds.length > 0) {
        const { data: songs, error: ssError } = await supabase
          .from('set_songs')
          .select('*, songs(*)')
          .in('set_id', setIds)
          .order('position');
        if (ssError) throw ssError;
        setSongs = songs;
      }

      // Merge structure
      const setsWithSongs = sets.map(set => ({
        ...set,
        songs: setSongs.filter(ss => ss.set_id === set.id).sort((a, b) => a.position - b.position)
      }));

      // Set of used song IDs for "Unique Song" check
      const usedSongIds = new Set(setSongs.map(ss => ss.song_id));

      return { setlist, sets: setsWithSongs, usedSongIds };
    }
  });

  const { data: allSongs } = useQuery({
    queryKey: ['all-songs-minimal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('songs').select('id, title, artist, key, tempo').order('title');
      if (error) throw error;
      return data;
    }
  });


  // --- Mutations ---

  // 1. Add Set
  const addSet = useMutation({
    mutationFn: async () => {
      const nextPos = (setlistData?.sets.length || 0);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('sets').insert({
        setlist_id: id,
        name: `Set ${nextPos + 1}`,
        position: nextPos,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Set added" });
    }
  });

  // 2. Delete Set (and reorder)
  const deleteSet = useMutation({
    mutationFn: async ({ setId, position }: { setId: string, position: number }) => {
      // Delete target
      const { error: delError } = await supabase.from('sets').delete().eq('id', setId);
      if (delError) throw delError;

      // Reorder subsequent sets
      // We can't do this easily in one query without a stored proc, so we do it client-side logic -> server updates
      // OR simpler: Fetch all sets > position and decrement.
      const setsToUpdate = setlistData?.sets.filter(s => s.position > position) || [];
      
      for (const set of setsToUpdate) {
         await supabase.from('sets').update({ position: set.position - 1 }).eq('id', set.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Set deleted" });
    }
  });

  // 3. Rename Set
  const renameSet = useMutation({
    mutationFn: async ({ setId, name }: { setId: string, name: string }) => {
      const { error } = await supabase.from('sets').update({ name }).eq('id', setId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
    }
  });

  // 4. Add Song to Set
  const addSongToSet = useMutation({
    mutationFn: async ({ setId, songId, currentCount }: { setId: string, songId: string, currentCount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('set_songs').insert({
        set_id: setId,
        song_id: songId,
        position: currentCount,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Song added" });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
  });

  // 5. Remove Song from Set (and reorder)
  const removeSong = useMutation({
    mutationFn: async ({ itemLink, setSongs }: { itemLink: any, setSongs: any[] }) => {
      // Delete
      await supabase.from('set_songs').delete().eq('id', itemLink.id);
      
      // Reorder siblings
      const siblingsToUpdate = setSongs.filter(s => s.position > itemLink.position);
      for (const s of siblingsToUpdate) {
        await supabase.from('set_songs').update({ position: s.position - 1 }).eq('id', s.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Song removed" });
    }
  });

  // 6. Move Song (Up/Down)
  const moveSong = useMutation({
    mutationFn: async ({ item, direction, allItems }: { item: any, direction: 'up' | 'down', allItems: any[] }) => {
      const currentIndex = item.position;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Find swap partner
      const partner = allItems.find(i => i.position === targetIndex);
      if (!partner) return; // Should not happen if UI is correct

      // Swap positions
      await supabase.from('set_songs').update({ position: targetIndex }).eq('id', item.id);
      await supabase.from('set_songs').update({ position: currentIndex }).eq('id', partner.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setlist', id] })
  });

  // 7. Move Set (Up/Down)
  const moveSet = useMutation({
    mutationFn: async ({ set, direction, allSets }: { set: any, direction: 'up' | 'down', allSets: any[] }) => {
      const currentIndex = set.position;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const partner = allSets.find(s => s.position === targetIndex);
      if (!partner) return;

      await supabase.from('sets').update({ position: targetIndex }).eq('id', set.id);
      await supabase.from('sets').update({ position: currentIndex }).eq('id', partner.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setlist', id] })
  });


  // --- UI Components ---

  const [songSearch, setSongSearch] = useState("");
  const [activeSetIdForAdd, setActiveSetIdForAdd] = useState<string | null>(null);

  const filteredSongs = useMemo(() => {
    if (!allSongs) return [];
    return allSongs.filter(s => 
      !setlistData?.usedSongIds.has(s.id) && 
      (s.title.toLowerCase().includes(songSearch.toLowerCase()) || s.artist.toLowerCase().includes(songSearch.toLowerCase()))
    );
  }, [allSongs, setlistData?.usedSongIds, songSearch]);

  if (isLoading) return <AdminLayout><div>Loading...</div></AdminLayout>;
  if (!setlistData?.setlist) return <AdminLayout><div>Setlist not found</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6 sticky top-0 z-10 bg-background/95 backdrop-blur py-4 border-b">
        <Link to="/setlists" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Setlists
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
               {setlistData.setlist.name}
               {setlistData.setlist.is_default && <Badge className="bg-amber-500">Default</Badge>}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {setlistData.setlist.date}</span>
            </div>
          </div>
          <Button onClick={() => addSet.mutate()}>
             <Plus className="mr-2 h-4 w-4" /> Add Set
          </Button>
        </div>
      </div>

      <div className="space-y-8 pb-20">
        {setlistData.sets.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
             <h3 className="text-lg font-medium text-muted-foreground">No sets yet</h3>
             <Button variant="outline" className="mt-4" onClick={() => addSet.mutate()}>Create First Set</Button>
          </div>
        ) : (
          setlistData.sets.map((set: any, index: number) => (
            <Card key={set.id} className="relative overflow-hidden group/card">
              <CardHeader className="pb-3 bg-muted/30 flex flex-row items-center justify-between space-y-0">
                 <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col gap-0.5">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6" 
                         disabled={index === 0}
                         onClick={() => moveSet.mutate({ set, direction: 'up', allSets: setlistData.sets })}
                       >
                         <ChevronUp className="h-3 w-3" />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6"
                         disabled={index === setlistData.sets.length - 1}
                         onClick={() => moveSet.mutate({ set, direction: 'down', allSets: setlistData.sets })}
                       >
                         <ChevronDown className="h-3 w-3" />
                       </Button>
                    </div>
                    <Input 
                      defaultValue={set.name} 
                      className="text-lg font-medium h-auto py-1 px-2 w-[300px] border-transparent hover:border-input focus:border-input transition-colors bg-transparent"
                      onBlur={(e) => {
                         if (e.target.value !== set.name) renameSet.mutate({ setId: set.id, name: e.target.value });
                      }}
                    />
                    <Badge variant="outline" className="text-muted-foreground font-normal">{set.songs.length} Songs</Badge>
                 </div>
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="text-muted-foreground hover:text-destructive"
                   onClick={() => {
                      if (confirm(`Delete ${set.name}?`)) deleteSet.mutate({ setId: set.id, position: set.position });
                   }}
                 >
                    <Trash2 className="h-4 w-4" />
                 </Button>
              </CardHeader>
              
              <CardContent className="pt-4">
                <div className="space-y-1">
                  {set.songs.map((item: any, songIdx: number) => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md group transition-colors border border-transparent hover:border-border">
                       <div className="flex items-center gap-4 flex-1">
                          <span className="text-muted-foreground font-mono w-4 text-center text-sm">{songIdx + 1}</span>
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button 
                               variant="ghost" size="icon" className="h-4 w-4 p-0" 
                               disabled={songIdx === 0}
                               onClick={() => moveSong.mutate({ item, direction: 'up', allItems: set.songs })}
                             ><ChevronUp className="h-3 w-3" /></Button>
                             <Button 
                               variant="ghost" size="icon" className="h-4 w-4 p-0"
                               disabled={songIdx === set.songs.length - 1}
                               onClick={() => moveSong.mutate({ item, direction: 'down', allItems: set.songs })}
                             ><ChevronDown className="h-3 w-3" /></Button>
                          </div>
                          <div>
                             <p className="font-medium text-sm">{item.songs?.title}</p>
                             <p className="text-xs text-muted-foreground">{item.songs?.artist}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-6">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                             {item.songs?.key && <span className="flex items-center bg-muted px-1.5 py-0.5 rounded"><Music2 className="w-3 h-3 mr-1"/> {item.songs.key}</span>}
                             {item.songs?.tempo && <span className="flex items-center bg-muted px-1.5 py-0.5 rounded"><Clock className="w-3 h-3 mr-1"/> {item.songs.tempo}</span>}
                          </div>
                          <Button 
                             variant="ghost" size="icon" 
                             className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                             onClick={() => removeSong.mutate({ itemLink: item, setSongs: set.songs })}
                          >
                             <X className="h-4 w-4" />
                          </Button>
                       </div>
                    </div>
                  ))}
                </div>

                <Dialog open={activeSetIdForAdd === set.id} onOpenChange={(open) => !open && setActiveSetIdForAdd(null)}>
                  <DialogTrigger asChild>
                    <Button 
                       variant="outline" 
                       className="w-full mt-4 border-dashed text-muted-foreground hover:text-primary"
                       onClick={() => { setActiveSetIdForAdd(set.id); setSongSearch(""); }}
                    >
                       <Plus className="mr-2 h-4 w-4" /> Add Song to {set.name}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] h-[70vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Add Song to {set.name}</DialogTitle>
                    </DialogHeader>
                    <div className="relative">
                       <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                       <Input 
                         placeholder="Search songs..." 
                         className="pl-8" 
                         value={songSearch} 
                         onChange={(e) => setSongSearch(e.target.value)}
                         autoFocus
                       />
                    </div>
                    <ScrollArea className="flex-1 -mx-6 px-6">
                       {filteredSongs.length === 0 ? (
                         <div className="text-center py-8 text-muted-foreground">
                            {songSearch ? "No matching songs found." : "Start typing to search."}
                            <p className="text-xs mt-1">(Songs already in this setlist are hidden)</p>
                         </div>
                       ) : (
                         <div className="space-y-1 py-2">
                            {filteredSongs.map(song => (
                               <button
                                  key={song.id}
                                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg text-left group transition-colors"
                                  onClick={() => {
                                     addSongToSet.mutate({ setId: set.id, songId: song.id, currentCount: set.songs.length });
                                     // Don't close immediately to allow multi-add? Or close? Let's keep open for rapid building.
                                  }}
                               >
                                  <div>
                                     <p className="font-medium text-sm">{song.title}</p>
                                     <p className="text-xs text-muted-foreground">{song.artist}</p>
                                  </div>
                                  <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary" />
                               </button>
                            ))}
                         </div>
                       )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))
        )}

        <Button size="lg" className="w-full h-12 text-lg shadow-sm" onClick={() => addSet.mutate()}>
           <Plus className="mr-2 h-5 w-5" /> Add New Set
        </Button>
      </div>
    </AdminLayout>
  );
};

export default SetlistDetail;