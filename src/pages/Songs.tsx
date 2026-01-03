import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Songs = () => {
  const { data: songs, isLoading } = useQuery({
    queryKey: ['songs'],
    queryFn: async () => {
      const { data } = await supabase.from('songs').select('*').limit(50);
      return data;
    }
  });

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-6">Songs</h1>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Tempo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading ? (
               <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>
            ) : songs?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.title}</TableCell>
                <TableCell>{s.artist}</TableCell>
                <TableCell>{s.key || '-'}</TableCell>
                <TableCell>{s.tempo || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default Songs;