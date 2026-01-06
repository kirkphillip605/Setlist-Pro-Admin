import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, CalendarDays, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const Gigs = () => {
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
        <Button asChild>
          <Link to="/gigs/new"><Plus className="mr-2 h-4 w-4" /> Create Gig</Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Event Name</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : gigs?.length === 0 ? (
               <TableRow><TableCell colSpan={5} className="h-24 text-center">No gigs scheduled.</TableCell></TableRow>
            ) : gigs?.map((g) => {
              const startDate = g.start_time ? new Date(g.start_time) : null;
              const isPast = startDate && startDate < new Date();
              
              return (
                <TableRow key={g.id} className="hover:bg-muted/50 group">
                  <TableCell className="font-mono text-sm">
                    {startDate ? (
                      <div className="flex flex-col">
                        <span className="font-bold">{format(startDate, "MMM d, yyyy")}</span>
                        <span className="text-muted-foreground text-xs">{format(startDate, "h:mm a")}</span>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/gigs/${g.id}`} className="hover:underline text-base">{g.name}</Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                       {g.venue_name && <MapPin className="h-3.5 w-3.5" />}
                       {g.venue_name || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isPast ? <Badge variant="secondary">Past</Badge> : <Badge className="bg-green-600 hover:bg-green-700">Upcoming</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="sm" asChild>
                       <Link to={`/gigs/${g.id}`}>Manage</Link>
                     </Button>
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