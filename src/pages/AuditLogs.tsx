import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Component to visualize JSON diffs
const JsonDiff = ({ oldData, newData }: { oldData: any, newData: any }) => {
  if (!oldData && !newData) return <span className="text-gray-400">No data</span>;

  // Simple key-value display for this example
  const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]));

  return (
    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md text-sm font-mono overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-slate-200 dark:border-slate-800">
            <th className="pb-2">Field</th>
            <th className="pb-2 text-red-600 dark:text-red-400">Old Value</th>
            <th className="pb-2 text-green-600 dark:text-green-400">New Value</th>
          </tr>
        </thead>
        <tbody>
          {allKeys.map(key => {
            const oldVal = oldData?.[key];
            const newVal = newData?.[key];
            const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            if (!hasChanged) return null; // Only show changes

            return (
              <tr key={key} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">{key}</td>
                <td className="py-2 pr-4 text-red-600 dark:text-red-400 break-all">
                   {JSON.stringify(oldVal) || 'null'}
                </td>
                <td className="py-2 text-green-600 dark:text-green-400 break-all">
                   {JSON.stringify(newVal) || 'null'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {allKeys.every(k => JSON.stringify(oldData?.[k]) === JSON.stringify(newData?.[k])) && (
        <div className="text-center text-gray-500 italic py-2">No visible changes recorded</div>
      )}
    </div>
  );
};

const AuditLogs = () => {
  const [page, setPage] = useState(0);
  const [filterTable, setFilterTable] = useState<string>("all");
  const [filterOperation, setFilterOperation] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 20;

  // Fetch Users for mapping
  const { data: usersMap } = useQuery({
    queryKey: ['users-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, email');
      const map = new Map();
      data?.forEach(u => {
        const name = u.first_name || u.last_name 
          ? `${u.first_name || ''} ${u.last_name || ''}`.trim() 
          : u.email;
        map.set(u.id, name);
      });
      return map;
    }
  });

  // Fetch Logs
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, filterTable, filterOperation],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('changed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterTable !== "all") query = query.eq('table_name', filterTable);
      if (filterOperation !== "all") query = query.eq('operation', filterOperation);

      const { data, count, error } = await query;
      if (error) throw error;
      return { data, count };
    }
  });

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const getBadgeColor = (op: string) => {
    switch (op) {
      case 'INSERT': return "bg-green-500 hover:bg-green-600";
      case 'DELETE': return "bg-red-500 hover:bg-red-600";
      case 'UPDATE': return "bg-blue-500 hover:bg-blue-600";
      default: return "bg-gray-500";
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Track all changes across your system.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
               <label className="text-sm font-medium mb-1.5 block">Operation</label>
               <Select value={filterOperation} onValueChange={setFilterOperation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Operations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Operations</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Table Name</label>
              <Input 
                placeholder="Filter by table name..." 
                value={filterTable === "all" ? "" : filterTable}
                onChange={(e) => setFilterTable(e.target.value || "all")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <div className="rounded-md border bg-white dark:bg-card shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Changed By</TableHead>
              <TableHead>Record ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading logs...
                </TableCell>
              </TableRow>
            ) : logs?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs?.data?.map((log) => (
                <>
                  <TableRow 
                    key={log.id} 
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => toggleRow(log.id)}
                  >
                    <TableCell>
                      {expandedRows.has(log.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.changed_at ? format(new Date(log.changed_at), "MMM d, HH:mm:ss") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getBadgeColor(log.operation)}>
                        {log.operation}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.table_name}</TableCell>
                    <TableCell>
                      {log.changed_by && usersMap 
                        ? (usersMap.get(log.changed_by) || <span className="text-muted-foreground text-xs font-mono">{log.changed_by.slice(0,8)}...</span>)
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.record_id?.slice(0, 8)}...
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(log.id) && (
                    <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                      <TableCell colSpan={6} className="p-0">
                        <div className="p-4">
                           <h4 className="font-semibold mb-2 text-sm">Change Details</h4>
                           <JsonDiff oldData={log.old_record} newData={log.new_record} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination Controls */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          Page {page + 1}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(p => p + 1)}
          disabled={!logs?.data || logs.data.length < PAGE_SIZE}
        >
          Next
        </Button>
      </div>
    </AdminLayout>
  );
};

export default AuditLogs;