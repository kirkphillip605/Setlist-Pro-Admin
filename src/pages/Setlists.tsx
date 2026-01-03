import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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

const Setlists = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['setlists'],
    queryFn: async () => {
      // Fetch setlists without the complex join that was causing 400 errors
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
        <h1 className="text-2xl font-bold">Setlists</h1>
        {/* Placeholder for Create Action */}
        <Button disabled variant="outline"><Plus className="mr-2 h-4 w-4" /> Create Setlist (Coming Soon)</Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : data?.setlists?.length === 0 ? (
               <TableRow><TableCell colSpan={4} className="h-24 text-center">No setlists found.</TableCell></TableRow>
            ) : data?.setlists?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.date}</TableCell>
                <TableCell>
                  {s.created_by ? (data?.userMap?.get(s.created_by) || 'Unknown') : '-'}
                </TableCell>
                <TableCell className="flex items-center space-x-2">
                  <Link to={`/setlists/${s.id}`}>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Setlist?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the setlist "{s.name}" and all its associated sets.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteSetlist.mutate(s.id)} className="bg-destructive text-destructive-foreground">
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