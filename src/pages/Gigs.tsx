import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, isPast, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Calendar, Clock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useRealtime } from "@/hooks/use-realtime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Gigs = () => {
  // Realtime updates for 'gigs'
  useRealtime({ table: 'gigs', queryKey: ['gigs'] });

  const { data: gigs, isLoading } = useQuery({
    queryKey: ['gigs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gigs').select('*').order('start_time', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    }
  });

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gigs</h1>
          <p className="text-muted-foreground">Manage upcoming and past performances.</p>
        </div>
        <Button asChild className="shadow-sm">
          <Link to="/gigs/new"><Plus className="mr-2 h-4 w-4" /> Create Gig</Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[180px]">Date</TableHead>
              <TableHead>Event Details</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : gigs?.length === 0 ? (
               <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No gigs scheduled.</TableCell></TableRow>
            ) : gigs?.map((g) => {
              const startDate = g.start_time ? new Date(g.start_time) : null;
              const past = startDate ? isPast(startDate) : false;
              const today = startDate ? isToday(startDate) : false;
              
              return (
                <TableRow key={g.id} className="hover:bg-muted/50 group cursor-pointer transition-colors">
                  <TableCell className="align-top py-4">
                    {startDate ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-sm font-semibold">
                           <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                           {format(startDate, "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                           <Clock className="mr-2 h-3.5 w-3.5" />
                           {format(startDate, "h:mm a")}
                        </div>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="align-top py-4">
                    <Link to={`/gigs/${g.id}`} className="font-semibold text-base hover:text-primary transition-colors block mb-1">
                       {g.name}
                    </Link>
                    {g.notes && <p className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">{g.notes}</p>}
                  </TableCell>
                  <TableCell className="align-top py-4">
                    <div className="flex items-start gap-2">
                       <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                       <div className="flex flex-col">
                          <span className="text-sm font-medium">{g.venue_name || 'TBD'}</span>
                          {(g.city || g.state) && <span className="text-xs text-muted-foreground">{[g.city, g.state].filter(Boolean).join(', ')}</span>}
                       </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top py-4">
                    {today ? (
                        <Badge className="bg-blue-600 animate-pulse">Today</Badge>
                    ) : past ? (
                        <Badge variant="secondary" className="text-muted-foreground">Past</Badge> 
                    ) : (
                        <Badge className="bg-green-600 hover:bg-green-700">Upcoming</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top py-4">
                     <TooltipProvider>
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                <Link to={`/gigs/${g.id}`}>
                                   <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                </Link>
                              </Button>
                           </TooltipTrigger>
                           <TooltipContent>Manage Gig</TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default Gigs;