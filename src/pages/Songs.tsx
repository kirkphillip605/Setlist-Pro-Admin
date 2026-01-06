import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Music, Disc, ArrowRight, Music2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Songs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [importQuery, setImportQuery] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enable Realtime
  useRealtime({ table: 'songs', queryKey: ['songs', searchTerm] });

  // Local Search
  const { data: songs, isLoading } = useQuery({
    queryKey: ['songs', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('songs')
        .select('*')
        .is('deleted_at', null) // Filter active only
        .order('created_at', { ascending: false });
      
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const songData = {
        title: track.title,
        artist: track.artist,
        cover_url: track.cover_url,
        spotify_url: track.spotify_url,
        created_by: user.id,
        duration: track.duration_ms ? new Date(track.duration_ms).toISOString().substr(14, 5) : null
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
      // Query invalidation handled by realtime, but good to have explicit here too
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    },
    onError: (err: any) => {
      setIsImporting(false);
      toast({ variant: "destructive", title: "Import failed", description: err.message });
    }
  });

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Songs</h1>
            <p className="text-muted-foreground">Manage your musical repertoire.</p>
        </div>
        
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm"><Plus className="mr-2 h-4 w-4" /> Add Song</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Music2 className="h-5 w-5 text-green-500" />
                Import from Spotify
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 my-2">
              <Input 
                placeholder="Search by song or artist..." 
                value={importQuery}
                onChange={(e) => setImportQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchSpotify.mutate(importQuery)}
                className="flex-1"
              />
              <Button onClick={() => searchSpotify.mutate(importQuery)} disabled={searchSpotify.isPending}>
                {searchSpotify.isPending ? "Searching..." : "Search"}
              </Button>
            </div>
            
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2 mt-2">
                {searchResults.map((track) => (
                  <div key={track.spotify_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 rounded-md border">
                        <AvatarImage src={track.cover_url} />
                        <AvatarFallback><Music className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold line-clamp-1 text-sm">{track.title}</p>
                        <p className="text-xs text-muted-foreground">{track.artist}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => importSong.mutate(track)}
                      disabled={isImporting}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download className="h-3 w-3 mr-1" /> Import
                    </Button>
                  </div>
                ))}
                {searchResults.length === 0 && !searchSpotify.isPending && (
                   <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
                     <Search className="h-10 w-10 opacity-20 mb-2" />
                     <p>{importQuery ? "No results found." : "Search to find songs to add."}</p>
                   </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2 mb-4 bg-background p-1 rounded-md border max-w-sm">
        <Search className="ml-2 text-muted-foreground h-4 w-4" />
        <Input 
          placeholder="Filter library..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-0 focus-visible:ring-0 h-8 shadow-none"
        />
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
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
               <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading songs...</TableCell></TableRow>
            ) : songs?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No songs found.</TableCell></TableRow>
            ) : songs?.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/50 group">
                <TableCell>
                  <Avatar className="h-12 w-12 rounded-md shadow-sm border">
                    <AvatarImage src={s.cover_url} alt={s.title} className="object-cover" />
                    <AvatarFallback className="rounded-md bg-muted"><Disc className="h-6 w-6 text-muted-foreground opacity-50" /></AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium text-base">
                  <Link to={`/songs/${s.id}`} className="hover:underline decoration-primary decoration-2 underline-offset-4">{s.title}</Link>
                  {s.is_retired && <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">Retired</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.artist}</TableCell>
                <TableCell>
                  {s.key ? <Badge variant="outline" className="font-mono">{s.key}</Badge> : <span className="text-muted-foreground/30">-</span>}
                </TableCell>
                <TableCell>
                  {s.tempo ? <span className="font-mono text-sm text-muted-foreground">{s.tempo} BPM</span> : <span className="text-muted-foreground/30">-</span>}
                </TableCell>
                <TableCell className="text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/songs/${s.id}`}>
                             <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Details</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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