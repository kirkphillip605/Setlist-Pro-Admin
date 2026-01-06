import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Trash2, ListMusic, Calendar, Star, User, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/use-realtime";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const Setlists = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("band");

  // Realtime (filter out deleted if possible, but easier to just invalidate)
  useRealtime({ table: 'setlists', queryKey: ['setlists'] });

  const { data, isLoading } = useQuery({
    queryKey: ['setlists'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch setlists (exclude deleted)
      const { data: setlists, error } = await supabase
        .from('setlists')
        .select('*')
        .is('deleted_at', null) // Filter active only
        .order('date', { ascending: false });
      
      if (error) throw error;

      // Fetch profiles manually to map names
      const userIds = Array.from(new Set(setlists.map(s => s.created_by).filter(Boolean)));
      
      let userMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);
          
        profiles?.forEach(p => {
          const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          userMap.set(p.id, name || p.email || 'Unknown');
        });
      }

      const bandSetlists = setlists.filter(s => !s.is_personal);
      // Show ALL personal setlists for admins to manage, not just their own
      const personalSetlists = setlists.filter(s => s.is_personal);

      return { bandSetlists, personalSetlists, userMap, currentUserId: user?.id };
    }
  });

  const deleteSetlist = useMutation({
    mutationFn: async (id: string) => {
      // Soft Delete
      const { error } = await supabase
        .from('setlists')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Setlist deleted" });
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });

  const makeDefault = useMutation({
    mutationFn: async (id: string) => {
      // 1. Unset current default
      await supabase.from('setlists').update({ is_default: false }).eq('is_default', true);
      // 2. Set new default
      const { error } = await supabase.from('setlists').update({ is_default: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Default setlist updated" });
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });

  // Reusable Table Component
  const SetlistTable = ({ list, type }: { list: any[], type: 'band' | 'personal' }) => (
    <div className="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            {type === 'band' && <TableHead className="w-[100px]">Status</TableHead>}
            <TableHead>{type === 'personal' ? "Owner" : "Created By"}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow><TableCell colSpan={type === 'band' ? 5 : 4} className="h-32 text-center text-muted-foreground">No setlists found.</TableCell></TableRow>
          ) : list.map((s) => (
            <TableRow key={s.id} className="hover:bg-muted/50 group">
              <TableCell className="font-medium text-base">
                <div className="flex items-center gap-3">
                   <div className={cn("p-2 rounded-lg", s.is_default ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-muted text-muted-foreground")}>
                      <ListMusic className="h-4 w-4" />
                   </div>
                   <div className="flex flex-col">
                     <span>{s.name}</span>
                     {s.is_tbd && <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">To Be Determined</span>}
                   </div>
                </div>
              </TableCell>
              <TableCell>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {s.date}
                 </div>
              </TableCell>
              {type === 'band' && (
                <TableCell>
                  {s.is_default ? (
                    <Badge className="bg-amber-500 hover:bg-amber-600 gap-1"><Star className="h-3 w-3 fill-current" /> Default</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-amber-500" onClick={() => makeDefault.mutate(s.id)}>
                      Make Default
                    </Button>
                  )}
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                   <User className="h-3.5 w-3.5" />
                   <span className={cn(type === 'personal' && "font-medium text-foreground")}>
                     {s.created_by ? (data?.userMap?.get(s.created_by) || 'Unknown') : '-'}
                   </span>
                </div>
              </TableCell>
              <TableCell className="flex items-center justify-end space-x-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" asChild className="hover:text-primary">
                        <Link to={`/setlists/${s.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Setlist</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Setlist?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete "{s.name}" and all its sets. This action can be undone from the Trash.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteSetlist.mutate(s.id)} className="bg-destructive hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">Setlists</h1>
           <p className="text-muted-foreground">Organize your songs into performance sets.</p>
        </div>
        <Button disabled variant="outline" className="opacity-50 cursor-not-allowed"><Plus className="mr-2 h-4 w-4" /> New Setlist (App Only)</Button>
      </div>

      <Tabs defaultValue="band" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="band" className="gap-2"><Users className="h-4 w-4"/> Band Setlists</TabsTrigger>
          <TabsTrigger value="personal" className="gap-2"><User className="h-4 w-4"/> User Setlists</TabsTrigger>
        </TabsList>

        <TabsContent value="band" className="space-y-4">
           {isLoading ? <div className="p-8 text-center">Loading...</div> : <SetlistTable list={data?.bandSetlists || []} type="band" />}
        </TabsContent>

        <TabsContent value="personal" className="space-y-4">
           {isLoading ? <div className="p-8 text-center">Loading...</div> : <SetlistTable list={data?.personalSetlists || []} type="personal" />}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
};

export default Setlists;