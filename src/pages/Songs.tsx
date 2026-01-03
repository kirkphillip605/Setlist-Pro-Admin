import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Songs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: songs, isLoading } = useQuery({
    queryKey: ['songs', searchTerm],
    queryFn: async () => {
      let query = supabase.from('songs').select('*').order('title');
      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    }
  });

  const saveSong = useMutation({
    mutationFn: async (songData: any) => {
      if (songData.id) {
        const { error } = await supabase.from('songs').update(songData).eq('id', songData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('songs').insert([songData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      setIsDialogOpen(false);
      setEditingSong(null);
      toast({ title: "Song saved successfully" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error saving song", description: error.message });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates = {
      id: editingSong?.id,
      title: formData.get('title'),
      artist: formData.get('artist'),
      key: formData.get('key'),
      tempo: formData.get('tempo'),
      // created_by is handled by RLS/Trigger usually, or we can assume current user if needed, 
      // but for admin tool we might need to set it if table requires NOT NULL and no default.
      // The schema says created_by is UUID NOT NULL. We need to fetch current user.
    };
    
    // We need to inject the user ID if creating
    if (!updates.id) {
        supabase.auth.getUser().then(({data}) => {
             if (data.user) {
                 saveSong.mutate({ ...updates, created_by: data.user.id });
             }
        });
    } else {
        saveSong.mutate(updates);
    }
  };

  const openEdit = (song: any) => {
    setEditingSong(song);
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingSong(null);
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Songs</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Song</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSong ? 'Edit Song' : 'Add New Song'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={editingSong?.title} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="artist">Artist</Label>
                <Input id="artist" name="artist" defaultValue={editingSong?.artist} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="key">Key</Label>
                  <Input id="key" name="key" defaultValue={editingSong?.key} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tempo">Tempo</Label>
                  <Input id="tempo" name="tempo" defaultValue={editingSong?.tempo} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <Search className="text-muted-foreground h-5 w-5" />
        <Input 
          placeholder="Search songs..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : songs?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">No songs found.</TableCell></TableRow>
            ) : songs?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.title}</TableCell>
                <TableCell>{s.artist}</TableCell>
                <TableCell>{s.key || '-'}</TableCell>
                <TableCell>{s.tempo || '-'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default Songs;