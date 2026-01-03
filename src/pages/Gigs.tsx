import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const Gigs = () => {
  const { data: gigs, isLoading } = useQuery({
    queryKey: ['gigs'],
    queryFn: async () => {
      const { data } = await supabase.from('gigs').select('*').order('start_time', { ascending: false }).limit(50);
      return data;
    }
  });

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Gigs</h1>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>
            ) : gigs?.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>{g.venue_name || '-'}</TableCell>
                <TableCell>{g.start_time ? format(new Date(g.start_time), "MMM d, yyyy") : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default Gigs;