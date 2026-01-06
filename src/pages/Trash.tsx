import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RotateCcw, 
  Trash2, 
  Music, 
  ListMusic, 
  Mic2, 
  Search, 
  AlertTriangle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

const Trash = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // --- Fetchers ---

  const { data: deletedSongs, isLoading: songsLoading } = useQuery({
    queryKey: ['trash', 'songs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: deletedSetlists, isLoading: setlistsLoading } = useQuery({
    queryKey: ['trash', 'setlists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: deletedGigs, isLoading: gigsLoading } = useQuery({
    queryKey: ['trash', 'gigs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gigs')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // --- Mutations ---

  const restoreItem = useMutation({
    mutationFn: async ({ table, id }: { table: string, id: string }) => {
      // Setting deleted_at to NULL triggers the UNDELETE logic in the DB triggers
      // which handles cascading restores for setlists -> sets -> songs automatically.
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: null })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({ title: "Item restored successfully" });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      // Invalidate the active lists as well so the item reappears there immediately
      queryClient.invalidateQueries({ queryKey: [variables.table] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Restore failed", description: err.message })
  });

  // Hard Delete (Permanent)
  const permanentDelete = useMutation({
    mutationFn: async ({ table, id }: { table: string, id: string }) => {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Permanently deleted" });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Delete failed", description: err.message })
  });


  // --- Helper Components ---

  const TrashTable = ({ 
    data, 
    table, 
    labelKey = 'name', 
    icon: Icon 
  }: { 
    data: any[], 
    table: string, 
    labelKey?: string, 
    icon: any 
  }) => {
    
    const filtered = data?.filter(item => 
      item[labelKey]?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
           <Trash2 className="h-10 w-10 opacity-20 mb-3" />
           <p>Trash is empty</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-muted rounded-md text-muted-foreground">
                        <Icon className="h-4 w-4" />
                     </div>
                     <div className="flex flex-col">
                        <span>{item[labelKey]}</span>
                        <span className="text-xs text-muted-foreground font-mono">{item.id.slice(0,8)}</span>
                     </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                   {item.deleted_at && formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                   <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 gap-1 hover:bg-green-50 hover:text-green-600 hover:border-green-200 dark:hover:bg-green-900/20"
                        onClick={() => restoreItem.mutate({ table, id: item.id })}
                        disabled={restoreItem.isPending}
                      >
                         <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button size="sm" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive p-0">
                              <Trash2 className="h-4 w-4" />
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
                            <AlertDialogDescription>
                               This action cannot be undone. This record will be forever removed from the database.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                               className="bg-destructive hover:bg-destructive/90"
                               onClick={() => permanentDelete.mutate({ table, id: item.id })}
                            >
                               Delete Forever
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                   </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
             <Trash2 className="h-8 w-8 text-muted-foreground" /> Data Restore
          </h1>
          <p className="text-muted-foreground">Recover deleted items or remove them permanently.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 mb-6 max-w-sm">
        <Search className="text-muted-foreground h-4 w-4" />
        <Input 
          placeholder="Search deleted items..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9"
        />
      </div>

      <Tabs defaultValue="setlists" className="space-y-6">
        <TabsList>
          <TabsTrigger value="setlists" className="gap-2">
             <ListMusic className="h-4 w-4"/> Setlists 
             {deletedSetlists?.length ? <Badge variant="secondary" className="ml-1 px-1 h-5 text-[10px]">{deletedSetlists.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="songs" className="gap-2">
             <Music className="h-4 w-4"/> Songs
             {deletedSongs?.length ? <Badge variant="secondary" className="ml-1 px-1 h-5 text-[10px]">{deletedSongs.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="gigs" className="gap-2">
             <Mic2 className="h-4 w-4"/> Gigs
             {deletedGigs?.length ? <Badge variant="secondary" className="ml-1 px-1 h-5 text-[10px]">{deletedGigs.length}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setlists">
           {setlistsLoading ? <div>Loading...</div> : <TrashTable data={deletedSetlists || []} table="setlists" icon={ListMusic} />}
           <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-sm flex gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>Restoring a setlist will automatically restore all Sets and Set Songs that were deleted along with it.</p>
           </div>
        </TabsContent>

        <TabsContent value="songs">
           {songsLoading ? <div>Loading...</div> : <TrashTable data={deletedSongs || []} table="songs" labelKey="title" icon={Music} />}
        </TabsContent>

        <TabsContent value="gigs">
           {gigsLoading ? <div>Loading...</div> : <TrashTable data={deletedGigs || []} table="gigs" labelKey="name" icon={Mic2} />}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default Trash;