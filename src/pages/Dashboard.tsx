import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Users, 
  Music, 
  Mic2, 
  ArrowRight, 
  Calendar, 
  Clock, 
  ListMusic,
  Radio
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { format, isToday } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useItems } from "@/lib/store";

const Dashboard = () => {
  // Use local store data - INSTANT ACCESS
  const profiles = useItems('profiles');
  const songs = useItems('songs');
  const gigs = useItems('gigs');
  const setlists = useItems('setlists');
  const sessions = useItems('gig_sessions');
  const activeSessions = sessions.filter((s:any) => s.is_active);

  // Derived state (sorting happens on client now, which is fine for < 1000 items)
  const recentSongs = [...songs]
    .sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const upcomingGigs = [...gigs]
    .filter((g:any) => new Date(g.start_time) >= new Date())
    .sort((a:any, b:any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5);

  const recentSetlists = [...setlists]
    .sort((a:any, b:any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 5);

  // Helper to find profile name
  const getProfileName = (id: string) => {
    const p = profiles.find((p:any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  };

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
            <div className="text-2xl font-bold">{profiles.length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Song Library</CardTitle>
            <Music className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{songs.length}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">All Time Gigs</CardTitle>
            <Mic2 className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gigs.length}</div>
          </CardContent>
        </Card>

        <Link to="/gig-sessions" className="block group">
           <Card className={`border-l-4 shadow-sm transition-all group-hover:shadow-md ${activeSessions.length > 0 ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20' : 'border-l-gray-300'}`}>
             <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle>
               <Radio className={`h-4 w-4 ${activeSessions.length > 0 ? 'text-green-600 animate-pulse' : 'text-gray-400'}`} />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">{activeSessions.length}</div>
               {activeSessions.length > 0 ? (
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
                {upcomingGigs.length === 0 && <p className="text-muted-foreground text-sm italic">No upcoming gigs found.</p>}
                {upcomingGigs.map((gig:any) => (
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
                {recentSongs.map((song:any) => (
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
                {recentSetlists.map((setlist:any) => (
                   <Link key={setlist.id} to={`/setlists/${setlist.id}`} className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                         <p className="font-medium truncate">{setlist.name}</p>
                         {setlist.is_default && <Badge className="text-[10px] bg-amber-500 h-5 px-1.5">Default</Badge>}
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                         <span>{format(new Date(setlist.updated_at || setlist.created_at), 'MMM d')}</span>
                         <span>by {getProfileName(setlist.created_by)}</span>
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