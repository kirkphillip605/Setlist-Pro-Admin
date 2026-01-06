import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, Clock, Music2, Plus, Trash2, GripVertical, Check, Search, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtime } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Components ---

const SortableSetItem = ({ set, onDelete, onRename, onAddSong, children }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: set.id, data: { type: 'set', set } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={cn("relative mb-6 group/card", isDragging ? "opacity-30 border-primary border-2 border-dashed z-0" : "z-auto")}
    >
      <CardHeader className="pb-3 bg-muted/30 flex flex-row items-center justify-between space-y-0 p-4">
          <div className="flex items-center gap-2 flex-1">
            <div {...attributes} {...listeners} className="cursor-grab hover:text-primary text-muted-foreground p-1 rounded hover:bg-muted">
               <GripVertical className="h-5 w-5" />
            </div>
            <Input 
              defaultValue={set.name} 
              className="text-lg font-medium h-auto py-1 px-2 w-[300px] border-transparent hover:border-input focus:border-input transition-colors bg-transparent shadow-none"
              onBlur={(e) => {
                  if (e.target.value !== set.name) onRename(set.id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()} 
              onMouseDown={(e) => e.stopPropagation()}
            />
            <Badge variant="outline" className="text-muted-foreground font-normal ml-2">{set.songs.length} Songs</Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(set)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
      </CardHeader>
      
      <CardContent className="pt-2 px-4 pb-4">
         <div className="space-y-1 min-h-[10px]">
           {children}
         </div>
         <Button 
            variant="outline" 
            className="w-full mt-3 border-dashed text-muted-foreground hover:text-primary h-9 text-xs"
            onClick={onAddSong}
         >
            <Plus className="mr-2 h-3 w-3" /> Add Song
         </Button>
      </CardContent>
    </Card>
  );
};

const SortableSongItem = ({ item, index, onRemove }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id, data: { type: 'song', song: item } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "flex items-center justify-between py-2 px-3 rounded-md group transition-colors border border-transparent select-none bg-card",
        isDragging ? "opacity-30 bg-muted border-dashed border-primary" : "hover:bg-muted/50 hover:border-border"
      )}
    >
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground/50 hover:text-primary transition-colors">
              <GripVertical className="h-4 w-4" />
          </div>
          <span className="text-muted-foreground font-mono w-4 text-center text-xs opacity-50">{index + 1}</span>
          <div className="truncate">
              <p className="font-medium text-sm truncate">{item.songs?.title}</p>
              <p className="text-xs text-muted-foreground truncate">{item.songs?.artist}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-70">
              {item.songs?.key && <span className="flex items-center bg-muted px-1.5 py-0.5 rounded"><Music2 className="w-3 h-3 mr-1"/> {item.songs.key}</span>}
              {item.songs?.tempo && <span className="flex items-center bg-muted px-1.5 py-0.5 rounded"><Clock className="w-3 h-3 mr-1"/> {item.songs.tempo}</span>}
          </div>
          <Button 
              variant="ghost" size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(item)}
          >
              <X className="h-3.5 w-3.5" />
          </Button>
        </div>
    </div>
  );
};


const SetlistDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Realtime
  useRealtime({ table: 'setlists', queryKey: ['setlist', id], filter: `id=eq.${id}` });
  useRealtime({ table: 'sets', queryKey: ['setlist', id], filter: `setlist_id=eq.${id}` });
  useRealtime({ table: 'set_songs', queryKey: ['setlist', id] });

  // Dnd Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<any>(null);

  // --- Data Fetching ---

  const { data: setlistData, isLoading } = useQuery({
    queryKey: ['setlist', id],
    queryFn: async () => {
      // 1. Setlist
      const { data: setlist, error: slError } = await supabase.from('setlists').select('*').eq('id', id!).single();
      if (slError) throw slError;

      // 2. Sets
      const { data: sets, error: sError } = await supabase.from('sets').select('*').eq('setlist_id', id!).order('position');
      if (sError) throw sError;

      // 3. Set Songs
      const setIds = sets.map(s => s.id);
      let setSongs: any[] = [];
      if (setIds.length > 0) {
        const { data: songs, error: ssError } = await supabase
          .from('set_songs')
          .select('*, songs(id, title, artist, key, tempo)')
          .in('set_id', setIds)
          .order('position');
        if (ssError) throw ssError;
        setSongs = songs;
      }

      // Merge
      const setsWithSongs = sets.map(set => ({
        ...set,
        songs: setSongs.filter(ss => ss.set_id === set.id).sort((a, b) => a.position - b.position)
      }));

      const usedSongIds = new Set(setSongs.map(ss => ss.song_id));

      return { setlist, sets: setsWithSongs, usedSongIds };
    }
  });

  const { data: allSongs } = useQuery({
    queryKey: ['all-songs-picker'],
    queryFn: async () => {
      const { data, error } = await supabase.from('songs').select('id, title, artist, key, tempo').order('title');
      if (error) throw error;
      return data;
    }
  });

  // --- Mutations ---

  const addSet = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // Use RPC if we wanted robust server-side set appending, but simple insert with current len is mostly safe for sets
      // Assuming gapless is maintained. For perfect safety, we could create append_set RPC, but append_song is the critical one due to high freq.
      const position = setlistData?.sets.length || 0;
      await supabase.from('sets').insert({
        setlist_id: id,
        name: `Set ${position + 1}`,
        position,
        created_by: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Set added" });
    }
  });

  const deleteSet = useMutation({
    mutationFn: async (setId: string) => {
      // Delete will trigger trigger cascade for songs if configured, but lets assume we need to reorder sets after.
      // Actually, deleting a set creates a gap. We should reorder remaining sets.
      // Ideally handled by backend trigger or RPC.
      // For now, client side optimistic reorder request.
      await supabase.from('sets').delete().eq('id', setId);
      
      // We rely on realtime/refetch to show gap, but to fix gaps:
      // We'd call reorder_sets with the new list of IDs minus the deleted one.
      // Let's do that for robustness in onSuccess or just rely on manual reorder later.
      // Better: Use a simple logic here.
      const remainingSets = setlistData?.sets.filter(s => s.id !== setId).map(s => s.id) || [];
      if (remainingSets.length > 0) {
        await supabase.rpc('reorder_sets', { p_setlist_id: id, p_set_ids: remainingSets });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Set deleted" });
    }
  });

  const renameSet = useMutation({
    mutationFn: async ({ setId, name }: { setId: string, name: string }) => {
      await supabase.from('sets').update({ name }).eq('id', setId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setlist', id] })
  });

  const addSongToSet = useMutation({
    mutationFn: async ({ setId, songId }: { setId: string, songId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Use the new RPC to avoid unique constraint violations
      const { error } = await supabase.rpc('append_song_to_set', {
        p_set_id: setId,
        p_song_id: songId,
        p_created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Song added" });
      setSongSearch(""); // Keep dialog open but maybe clear search? Or keep context?
      // Keeping dialog open is handled by state not changing to null
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
  });

  const removeSong = useMutation({
    mutationFn: async (itemLink: any) => {
      await supabase.from('set_songs').delete().eq('id', itemLink.id);
      // Reorder remaining to close gap
      const currentSet = setlistData?.sets.find(s => s.id === itemLink.set_id);
      if (currentSet) {
         const remainingIds = currentSet.songs.filter((s:any) => s.id !== itemLink.id).map((s:any) => s.id);
         await supabase.rpc('reorder_set_songs', { p_set_id: itemLink.set_id, p_song_ids: remainingIds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setlist', id] });
      toast({ title: "Song removed" });
    }
  });

  const reorderSetsMutation = useMutation({
    mutationFn: async (newOrderIds: string[]) => {
       await supabase.rpc('reorder_sets', { p_setlist_id: id, p_set_ids: newOrderIds });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setlist', id] })
  });

  const reorderSongsMutation = useMutation({
    mutationFn: async ({ setId, newOrderIds }: { setId: string, newOrderIds: string[] }) => {
       await supabase.rpc('reorder_set_songs', { p_set_id: setId, p_song_ids: newOrderIds });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setlist', id] })
  });


  // --- Dnd Handlers ---

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setActiveDragItem(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setActiveDragItem(null);

    if (!over) return;

    if (active.id === over.id) return;

    // Handle Set Reordering
    if (active.data.current?.type === 'set' && over.data.current?.type === 'set') {
       const oldIndex = setlistData?.sets.findIndex(s => s.id === active.id) ?? -1;
       const newIndex = setlistData?.sets.findIndex(s => s.id === over.id) ?? -1;
       
       if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(setlistData!.sets, oldIndex, newIndex);
          // Optimistic UI update could happen here, but we just trigger mutation
          reorderSetsMutation.mutate(newOrder.map(s => s.id));
       }
       return;
    }

    // Handle Song Reordering (Strictly within same set for now)
    if (active.data.current?.type === 'song') {
       const activeSong = active.data.current.song;
       // Find which set this song belongs to
       const setId = activeSong.set_id;
       
       // Find the target set from 'over'
       // If over is a song, its data has 'song'. If over is a set container (maybe?), check data.
       const overData = over.data.current;
       let targetSetId = null;

       if (overData?.type === 'song') {
         targetSetId = overData.song.set_id;
       } else if (overData?.type === 'set') {
         targetSetId = overData.set.id; // Dropped onto a set header?
       }

       // Only allow reordering within same set for this iteration
       // Moving between sets requires updating set_id which we can support, but let's stick to reorder first.
       if (targetSetId === setId) {
           const set = setlistData?.sets.find(s => s.id === setId);
           if (!set) return;

           const oldIndex = set.songs.findIndex((s:any) => s.id === active.id);
           const newIndex = set.songs.findIndex((s:any) => s.id === over.id);

           if (oldIndex !== -1 && newIndex !== -1) {
               const newOrder = arrayMove(set.songs, oldIndex, newIndex);
               reorderSongsMutation.mutate({ setId, newOrderIds: newOrder.map((s:any) => s.id) });
           }
       }
    }
  };

  // --- UI State ---
  const [songSearch, setSongSearch] = useState("");
  const [activeSetIdForAdd, setActiveSetIdForAdd] = useState<string | null>(null);

  const filteredSongs = useMemo(() => {
    if (!allSongs) return [];
    return allSongs.filter(s => 
      (s.title.toLowerCase().includes(songSearch.toLowerCase()) || s.artist.toLowerCase().includes(songSearch.toLowerCase()))
    );
  }, [allSongs, songSearch]);

  if (isLoading) return <AdminLayout><div>Loading...</div></AdminLayout>;
  if (!setlistData?.setlist) return <AdminLayout><div>Setlist not found</div></AdminLayout>;

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <AdminLayout>
        <div className="mb-6 sticky top-0 z-20 bg-background/95 backdrop-blur py-4 border-b">
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

        <div className="pb-20">
          <SortableContext 
            items={setlistData.sets.map(s => s.id)} 
            strategy={verticalListSortingStrategy}
          >
            {setlistData.sets.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-medium text-muted-foreground">No sets yet</h3>
                <Button variant="outline" className="mt-4" onClick={() => addSet.mutate()}>Create First Set</Button>
              </div>
            ) : (
              setlistData.sets.map((set: any) => (
                <SortableSetItem 
                  key={set.id} 
                  set={set} 
                  onDelete={(s:any) => { if(confirm(`Delete ${s.name}?`)) deleteSet.mutate(s.id) }}
                  onRename={(id:string, name:string) => renameSet.mutate({setId: id, name})}
                  onAddSong={() => { setActiveSetIdForAdd(set.id); setSongSearch(""); }}
                >
                    <SortableContext 
                      items={set.songs.map((s:any) => s.id)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {set.songs.length === 0 && <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg opacity-50">Empty Set</div>}
                      {set.songs.map((item: any, idx: number) => (
                          <SortableSongItem 
                            key={item.id} 
                            item={item} 
                            index={idx}
                            onRemove={(i:any) => removeSong.mutate(i)} 
                          />
                      ))}
                    </SortableContext>
                </SortableSetItem>
              ))
            )}
          </SortableContext>

          <Button size="lg" className="w-full h-12 text-lg shadow-sm" onClick={() => addSet.mutate()}>
            <Plus className="mr-2 h-5 w-5" /> Add New Set
          </Button>
        </div>

        {/* Drag Overlay for smooth visual feedback */}
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeDragItem ? (
             activeDragItem.type === 'set' ? (
                <Card className="opacity-80 rotate-2 cursor-grabbing">
                   <CardHeader className="p-4 bg-muted/50"><div className="text-lg font-bold">{activeDragItem.set.name}</div></CardHeader>
                </Card>
             ) : (
                <div className="bg-card border p-3 rounded-md shadow-lg rotate-2 cursor-grabbing w-[300px] flex items-center gap-2">
                   <Music2 className="h-4 w-4" />
                   <span className="font-medium">{activeDragItem.song.songs?.title}</span>
                </div>
             )
          ) : null}
        </DragOverlay>

        {/* Add Song Dialog */}
        <Dialog open={!!activeSetIdForAdd} onOpenChange={(open) => !open && setActiveSetIdForAdd(null)}>
          <DialogContent className="sm:max-w-[500px] h-[70vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Song to Set</DialogTitle>
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
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  {filteredSongs.map(song => {
                    const isUsed = setlistData?.usedSongIds.has(song.id);
                    return (
                      <button
                        key={song.id}
                        disabled={isUsed}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                          isUsed 
                            ? "opacity-50 cursor-not-allowed bg-muted/20" 
                            : "hover:bg-muted/50 group"
                        )}
                        onClick={() => {
                          if (!isUsed && activeSetIdForAdd) {
                              addSongToSet.mutate({ setId: activeSetIdForAdd, songId: song.id });
                          }
                        }}
                      >
                        <div className={cn(isUsed && "line-through decoration-muted-foreground decoration-2")}>
                          <p className="font-medium text-sm">{song.title}</p>
                          <p className="text-xs text-muted-foreground">{song.artist}</p>
                        </div>
                        {isUsed ? (
                          <div className="flex items-center text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                              <Check className="h-3 w-3 mr-1" /> Added
                          </div>
                        ) : (
                          <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </DndContext>
  );
};

export default SetlistDetail;