import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Trash2, ListMusic, Calendar } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Setlists = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Realtime
  useRealtime({ table: 'setlists', queryKey: ['setlists'] });

  const { data, isLoading } = useQuery({
    queryKey: ['setlists'],
    queryFn: async () => {
      // Fetch setlists
      const { data: setlists, error } = await supabase
        .from('setlists')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;

      // Fetch profiles manually to map names
      const userIds = Array.from(new Set(setlists.map(s => s.created_by).filter(Boolean)));
      
      let userMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
          
        profiles?.forEach(p => {
          userMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim());
        });
      }

      return { setlists, userMap };
    }
  });

  const deleteSetlist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('setlists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Realtime handles this, but optimistically:
      queryClient.invalidateQueries({ queryKey: ['setlists'] });
      toast({ title: "Setlist deleted successfully" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">Setlists</h1>
           <p className="text-muted-foreground">Manage and organize song collections.</p>
        </div>
        <Button disabled variant="outline" className="opacity-50 cursor-not-allowed"><Plus className="mr-2 h-4 w-4" /> Create Setlist (App Only)</Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : data?.setlists?.length === 0 ? (
               <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No setlists found.</TableCell></TableRow>
            ) : data?.setlists?.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/50 group">
                <TableCell className="font-medium text-base">
                  <div className="flex items-center gap-2">
                     <ListMusic className="h-4 w-4 text-primary" />
                     {s.name}
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {s.date}
                   </div>
                </TableCell>
                <TableCell>
                  {s.is_personal ? <Badge variant="secondary">Personal</Badge> : <Badge variant="outline">Band</Badge>}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {s.created_by ? (data?.userMap?.get(s.created_by) || 'Unknown') : '-'}
                  </span>
                </TableCell>
                <TableCell className="flex items-center justify-end space-x-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to={`/setlists/${s.id}`}>
                          <Button variant="ghost" size="icon" className="hover:text-primary">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>View Details</TooltipContent>
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
                          This will permanently delete "{s.name}" and all its associated sets. This action cannot be undone.
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
    </AdminLayout>
  );
};

export default Setlists;