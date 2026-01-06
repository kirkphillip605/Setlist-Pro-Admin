import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Activity, 
  Users, 
  Music, 
  Mic2, 
  ArrowRight, 
  Calendar, 
  Clock, 
  ListMusic,
  Radio
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format, isToday } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  // 1. Stats Query
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [profiles, songs, gigs, activeSessions] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('gigs').select('id', { count: 'exact', head: true }),
        supabase.from('gig_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      
      return {
        users: profiles.count || 0,
        songs: songs.count || 0,
        gigs: gigs.count || 0,
        activeSessions: activeSessions.count || 0,
      };
    }
  });

  // 2. Recent Songs
  const { data: recentSongs } = useQuery({
    queryKey: ['recent-songs'],
    queryFn: async () => {
      const { data } = await supabase.from('songs').select('*').order('created_at', { ascending: false }).limit(5);
      return data || [];
    }
  });

  // 3. Upcoming Gigs
  const { data: upcomingGigs } = useQuery({
    queryKey: ['upcoming-gigs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('gigs')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);
      return data || [];
    }
  });

  // 4. Recent Setlists
  const { data: recentSetlists } = useQuery({
    queryKey: ['recent-setlists'],
    queryFn: async () => {
      const { data } = await supabase
        .from('setlists')
        .select('*, profiles(first_name, last_name)')
        .order('updated_at', { ascending: false })
        .limit(5);
      return data || [];
    }
  });

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your band's application status.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users ?? '-'}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Song Library</CardTitle>
            <Music className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.songs ?? '-'}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">All Time Gigs</CardTitle>
            <Mic2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.gigs ?? '-'}</div>
          </CardContent>
        </Card>

        <Link to="/gig-sessions" className="block group">
           <Card className={`border-l-4 shadow-sm transition-all group-hover:shadow-md ${stats?.activeSessions ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-l-gray-300'}`}>
             <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle>
               <Radio className={`h-4 w-4 ${stats?.activeSessions ? 'text-green-600 animate-pulse' : 'text-gray-400'}`} />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">{stats?.activeSessions ?? 0}</div>
               {stats?.activeSessions ? (
                 <p className="text-xs text-green-600 font-medium mt-1">Live Now &rarr;</p>
               ) : (
                 <p className="text-xs text-muted-foreground mt-1">No live performances</p>
               )}
             </CardContent>
           </Card>
        </Link>
      </div>

      {/* Snapshots Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upcoming Gigs */}
        <Card className="lg:col-span-1 h-full flex flex-col">
          <CardHeader>
             <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-orange-500" /> Upcoming Gigs
             </CardTitle>
             <CardDescription>Next 5 scheduled performances</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
             <div className="space-y-4">
                {upcomingGigs?.length === 0 && <p className="text-muted-foreground text-sm italic">No upcoming gigs found.</p>}
                {upcomingGigs?.map(gig => (
                  <Link key={gig.id} to={`/gigs/${gig.id}`} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                     <div className="bg-muted rounded-md h-12 w-12 flex flex-col items-center justify-center shrink-0 border">
                        <span className="text-xs font-bold text-red-500 uppercase">{format(new Date(gig.start_time), 'MMM')}</span>
                        <span className="text-lg font-bold leading-none">{format(new Date(gig.start_time), 'd')}</span>
                     </div>
                     <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{gig.name}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                           <Clock className="h-3 w-3" /> {format(new Date(gig.start_time), 'h:mm a')} • {gig.venue_name || 'TBD'}
                        </p>
                     </div>
                     {isToday(new Date(gig.start_time)) && <Badge className="bg-green-500">Today</Badge>}
                  </Link>
                ))}
             </div>
             <Button variant="ghost" className="w-full mt-4 text-xs" asChild>
                <Link to="/gigs">View All Gigs <ArrowRight className="ml-1 h-3 w-3"/></Link>
             </Button>
          </CardContent>
        </Card>

        {/* Recently Added Songs */}
        <Card className="lg:col-span-1 h-full flex flex-col">
          <CardHeader>
             <CardTitle className="flex items-center gap-2 text-lg">
                <Music className="h-5 w-5 text-purple-500" /> Recent Songs
             </CardTitle>
             <CardDescription>Newest additions to the library</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
             <div className="space-y-2">
                {recentSongs?.map(song => (
                   <Link key={song.id} to={`/songs/${song.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                      <Avatar className="h-10 w-10 rounded-md border">
                         <AvatarImage src={song.cover_url} />
                         <AvatarFallback><Music className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                         <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{song.title}</p>
                         <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                   </Link>
                ))}
             </div>
             <Button variant="ghost" className="w-full mt-4 text-xs" asChild>
                <Link to="/songs">Go to Library <ArrowRight className="ml-1 h-3 w-3"/></Link>
             </Button>
          </CardContent>
        </Card>

        {/* Recent Setlists */}
        <Card className="lg:col-span-1 h-full flex flex-col">
          <CardHeader>
             <CardTitle className="flex items-center gap-2 text-lg">
                <ListMusic className="h-5 w-5 text-blue-500" /> Setlist Activity
             </CardTitle>
             <CardDescription>Recently updated setlists</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
             <div className="space-y-4">
                {recentSetlists?.map(setlist => (
                   <Link key={setlist.id} to={`/setlists/${setlist.id}`} className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                         <p className="font-medium truncate">{setlist.name}</p>
                         {setlist.is_default && <Badge className="text-[10px] bg-amber-500 h-5 px-1.5">Default</Badge>}
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                         <span>{format(new Date(setlist.updated_at || setlist.created_at), 'MMM d')}</span>
                         <span>by {setlist.profiles?.first_name || 'User'}</span>
                      </div>
                   </Link>
                ))}
             </div>
             <Button variant="ghost" className="w-full mt-4 text-xs" asChild>
                <Link to="/setlists">Manage Setlists <ArrowRight className="ml-1 h-3 w-3"/></Link>
             </Button>
          </CardContent>
        </Card>

      </div>
    </AdminLayout>
  );
};

export default Dashboard;