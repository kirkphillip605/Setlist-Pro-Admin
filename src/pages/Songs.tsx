import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Music, Disc } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const Songs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [importQuery, setImportQuery] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local Search
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

  // Spotify Search Mutation
  const searchSpotify = useMutation({
    mutationFn: async (query: string) => {
      const { data, error } = await supabase.functions.invoke('spotify-search', {
        body: { query }
      });
      if (error) throw error;
      return data.tracks;
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Search failed", description: err.message });
    }
  });

  // Import Song Mutation
  const importSong = useMutation({
    mutationFn: async (track: any) => {
      setIsImporting(true);
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const songData = {
        title: track.title,
        artist: track.artist,
        cover_url: track.cover_url,
        spotify_url: track.spotify_url,
        created_by: user.id,
        // Optional: Pre-fill tempo/key if you had an API for audio analysis
      };

      const { error } = await supabase.from('songs').insert([songData]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Song imported successfully" });
      setIsImportOpen(false);
      setSearchResults([]);
      setImportQuery("");
      setIsImporting(false);
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    },
    onError: (err: any) => {
      setIsImporting(false);
      toast({ variant: "destructive", title: "Import failed", description: err.message });
    }
  });

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
            <p className="text-muted-foreground">Manage your repertoire.</p>
        </div>
        
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Song</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Import from Spotify</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 my-2">
              <Input 
                placeholder="Search by song or artist..." 
                value={importQuery}
                onChange={(e) => setImportQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchSpotify.mutate(importQuery)}
              />
              <Button onClick={() => searchSpotify.mutate(importQuery)} disabled={searchSpotify.isPending}>
                {searchSpotify.isPending ? "Searching..." : "Search"}
              </Button>
            </div>
            
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2">
                {searchResults.map((track) => (
                  <div key={track.spotify_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 rounded-md">
                        <AvatarImage src={track.cover_url} />
                        <AvatarFallback><Music className="h-6 w-6" /></AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium line-clamp-1">{track.title}</p>
                        <p className="text-sm text-muted-foreground">{track.artist}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => importSong.mutate(track)}
                      disabled={isImporting}
                    >
                      Import
                    </Button>
                  </div>
                ))}
                {searchResults.length === 0 && !searchSpotify.isPending && (
                   <div className="text-center text-muted-foreground py-8">
                     {importQuery ? "No results found." : "Search to find songs to add."}
                   </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2 mb-4 bg-card p-2 rounded-md border max-w-sm">
        <Search className="text-muted-foreground h-4 w-4" />
        <Input 
          placeholder="Filter library..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 focus-visible:ring-0 h-8"
        />
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Artwork</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead className="w-[100px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : songs?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">No songs found.</TableCell></TableRow>
            ) : songs?.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/50 group">
                <TableCell>
                  <Avatar className="h-10 w-10 rounded-md">
                    <AvatarImage src={s.cover_url} alt={s.title} className="object-cover" />
                    <AvatarFallback className="rounded-md bg-muted"><Disc className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">
                  <Link to={`/songs/${s.id}`} className="hover:underline">{s.title}</Link>
                </TableCell>
                <TableCell>{s.artist}</TableCell>
                <TableCell>{s.key || <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell>{s.tempo || <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/songs/${s.id}`}>Edit</Link>
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