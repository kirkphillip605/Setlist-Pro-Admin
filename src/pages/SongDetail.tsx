import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Trash2, ExternalLink, Music2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const SongDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useQuery({
    queryKey: ['song', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('songs').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from('songs').update(values).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Song updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['song', id] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Update failed", description: err.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('songs').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Song deleted" });
      navigate('/songs');
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Delete failed", description: err.message })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    // We do NOT include spotify_url or cover_url here as they are read-only from import
    updateMutation.mutate({
      title: formData.get('title'),
      artist: formData.get('artist'),
      key: formData.get('key'),
      tempo: formData.get('tempo'),
      duration: formData.get('duration'),
      lyrics: formData.get('lyrics'),
      note: formData.get('note'),
    });
  };

  if (isLoading) return <AdminLayout>Loading...</AdminLayout>;
  if (!song) return <AdminLayout>Song not found</AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link to="/songs" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Songs
        </Link>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
             <Avatar className="h-20 w-20 rounded-lg shadow-sm border">
                <AvatarImage src={song.cover_url} alt={song.title} />
                <AvatarFallback className="rounded-lg"><Music2 className="h-10 w-10 text-muted-foreground"/></AvatarFallback>
             </Avatar>
             <div>
                <h1 className="text-3xl font-bold">{song.title}</h1>
                <p className="text-xl text-muted-foreground">{song.artist}</p>
             </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => {
             if(confirm("Are you sure you want to delete this song?")) deleteMutation.mutate();
          }}>
             <Trash2 className="mr-2 h-4 w-4" /> Delete Song
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Metadata */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input name="title" defaultValue={song.title} required />
              </div>
              <div className="space-y-2">
                <Label>Artist</Label>
                <Input name="artist" defaultValue={song.artist} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input name="key" defaultValue={song.key || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Tempo (BPM)</Label>
                  <Input name="tempo" defaultValue={song.tempo || ''} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input name="duration" defaultValue={song.duration || ''} placeholder="e.g. 3:45" />
              </div>
              
              {song.spotify_url && (
                <div className="space-y-2 pt-2">
                  <Label>Spotify</Label>
                  <Button type="button" variant="outline" className="w-full gap-2" asChild>
                    <a href={song.spotify_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4"/> Open in Spotify
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Button type="submit" size="lg" className="w-full" disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>

        {/* Right Column: Content */}
        <div className="space-y-6 lg:col-span-2">
           <Card className="h-full flex flex-col">
             <CardHeader>
               <CardTitle>Lyrics & Notes</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 flex-1">
               <div className="space-y-2 flex-1">
                 <Label>Lyrics</Label>
                 <Textarea 
                   name="lyrics" 
                   defaultValue={song.lyrics || ''} 
                   className="min-h-[400px] font-mono leading-relaxed resize-y"
                   placeholder="Enter lyrics here..."
                 />
               </div>
               <div className="space-y-2">
                 <Label>Performance Notes</Label>
                 <Textarea 
                   name="note" 
                   defaultValue={song.note || ''} 
                   placeholder="Specific details about the performance, patches, etc."
                   className="min-h-[100px]"
                 />
               </div>
             </CardContent>
           </Card>
        </div>
      </form>
    </AdminLayout>
  );
};

export default SongDetail;