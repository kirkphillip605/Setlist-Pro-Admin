import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Music2 } from "lucide-react";

const SetlistDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: setlist, isLoading } = useQuery({
    queryKey: ['setlist', id],
    queryFn: async () => {
      // Fetch Setlist
      const { data: setlistData, error: setlistError } = await supabase
        .from('setlists')
        .select('*')
        .eq('id', id!)
        .single();
      
      if (setlistError) throw setlistError;

      // Fetch Creator Name
      let creatorName = 'Unknown';
      if (setlistData.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', setlistData.created_by)
          .single();
        if (profile) {
          creatorName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        }
      }

      // Fetch Sets
      const { data: setsData, error: setsError } = await supabase
        .from('sets')
        .select('*')
        .eq('setlist_id', id!)
        .order('position');

      if (setsError) throw setsError;

      // Fetch all songs for these sets
      const setIds = setsData.map(s => s.id);
      let setSongsData: any[] = [];
      
      if (setIds.length > 0) {
        const { data: songsResult, error: songsError } = await supabase
          .from('set_songs')
          .select('*, songs(*)')
          .in('set_id', setIds)
          .order('position');
        
        if (songsError) throw songsError;
        setSongsData = songsResult;
      }

      // Merge data
      const setsWithSongs = setsData.map(set => ({
        ...set,
        songs: setSongsData.filter(ss => ss.set_id === set.id)
      }));

      return {
        ...setlistData,
        creatorName,
        sets: setsWithSongs
      };
    }
  });

  if (isLoading) return <AdminLayout><div>Loading...</div></AdminLayout>;
  if (!setlist) return <AdminLayout><div>Setlist not found</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link to="/setlists" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Setlists
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{setlist.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <span>{setlist.date}</span>
              <span>•</span>
              <span>Created by {setlist.creatorName}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {setlist.is_personal && <Badge variant="secondary">Personal</Badge>}
            {setlist.is_tbd && <Badge variant="outline">TBD</Badge>}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {setlist.sets?.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No sets defined in this setlist.
            </CardContent>
          </Card>
        ) : (
          setlist.sets?.map((set: any) => (
            <Card key={set.id}>
              <CardHeader className="pb-3 bg-muted/30">
                <CardTitle className="text-lg font-medium flex justify-between">
                   <span>{set.name}</span>
                   <Badge variant="outline">{set.songs.length} Songs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {set.songs.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No songs in this set.</p>
                ) : (
                  <div className="space-y-1">
                     {set.songs.map((item: any, idx: number) => (
                       <div key={item.id} className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded-md group">
                         <div className="flex items-center gap-3">
                           <span className="text-muted-foreground font-mono w-6 text-sm">{idx + 1}</span>
                           <div>
                             <p className="font-medium text-sm">{item.songs?.title}</p>
                             <p className="text-xs text-muted-foreground">{item.songs?.artist}</p>
                           </div>
                         </div>
                         <div className="flex items-center gap-4 text-xs text-muted-foreground opacity-60 group-hover:opacity-100">
                           {item.songs?.key && <span className="flex items-center"><Music2 className="w-3 h-3 mr-1"/> {item.songs.key}</span>}
                           {item.songs?.tempo && <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {item.songs.tempo}</span>}
                         </div>
                       </div>
                     ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
};

export default SetlistDetail;