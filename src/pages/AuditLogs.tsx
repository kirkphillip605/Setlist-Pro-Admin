import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  Search, 
  Filter, 
  Activity, 
  PauseCircle, 
  PlayCircle,
  ExternalLink
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// --- Types & Helpers ---

const OPERATIONS = ["INSERT", "UPDATE", "DELETE", "UNDELETE", "REORDER"];
const TABLES = ["songs", "gigs", "setlists", "profiles", "app_statuses", "banned_users", "sets", "set_songs"];

const getBadgeColor = (op: string) => {
  switch (op) {
    case 'INSERT': return "bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 border-green-200 dark:border-green-900";
    case 'DELETE': return "bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/25 border-red-200 dark:border-red-900";
    case 'UNDELETE': return "bg-teal-500/15 text-teal-700 dark:text-teal-400 hover:bg-teal-500/25 border-teal-200 dark:border-teal-900";
    case 'UPDATE': return "bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25 border-blue-200 dark:border-blue-900";
    case 'REORDER': return "bg-purple-500/15 text-purple-700 dark:text-purple-400 hover:bg-purple-500/25 border-purple-200 dark:border-purple-900";
    default: return "bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-200";
  }
};

const getLinkForRecord = (table: string, id: string) => {
  switch(table) {
    case 'songs': return `/songs/${id}`;
    case 'gigs': return `/gigs/${id}`;
    case 'setlists': return `/setlists/${id}`;
    // sets/set_songs link to their setlist parent usually, logic handled in row render
    default: return null;
  }
};

// Type for the resolution function
type IdResolver = (id: string) => string | null;

// --- Sub-components ---

const JsonValue = ({ value, resolve }: { value: any, resolve: IdResolver }) => {
  // If value is a UUID string, try to resolve it
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    const name = resolve(value);
    if (name) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 text-primary/80">
                {value.slice(0, 8)}...
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-popover text-popover-foreground border shadow-md font-medium z-50">
              {name}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  }
  // Render generic values
  if (value === null) return <span className="text-muted-foreground italic">null</span>;
  if (typeof value === 'boolean') return <span className={value ? "text-green-600" : "text-red-600"}>{String(value)}</span>;
  return <span>{String(value)}</span>;
};

const JsonDiff = ({ oldData, newData, resolve }: { oldData: any, newData: any, resolve: IdResolver }) => {
  if (!oldData && !newData) return <span className="text-muted-foreground">No data recorded</span>;

  // Filter out meta keys
  const ignoredKeys = ['updated_at', 'last_updated_by', 'created_at', 'created_by', 'deleted_by', 'version'];
  const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]))
    .filter(k => !ignoredKeys.includes(k));

  if (allKeys.length === 0) return <div className="text-muted-foreground italic text-sm">No significant changes.</div>;

  return (
    <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-md text-xs font-mono overflow-x-auto border">
      <table className="w-full">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            <th className="pb-2 w-[150px]">Field</th>
            <th className="pb-2 text-red-600 dark:text-red-400 w-[40%]">Old Value</th>
            <th className="pb-2 text-green-600 dark:text-green-400 w-[40%]">New Value</th>
          </tr>
        </thead>
        <tbody>
          {allKeys.map(key => {
            const oldVal = oldData?.[key];
            const newVal = newData?.[key];
            const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            if (!hasChanged) return null;

            return (
              <tr key={key} className="border-b border-muted/40 last:border-0 hover:bg-muted/20">
                <td className="py-2 pr-4 font-semibold text-foreground/80 align-top">{key}</td>
                <td className="py-2 pr-4 text-red-600 dark:text-red-400 break-all align-top">
                   <div className="max-h-[100px] overflow-y-auto">
                      <JsonValue value={oldVal} resolve={resolve} />
                   </div>
                </td>
                <td className="py-2 text-green-600 dark:text-green-400 break-all align-top">
                   <div className="max-h-[100px] overflow-y-auto">
                      <JsonValue value={newVal} resolve={resolve} />
                   </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const AuditLogs = () => {
  const [page, setPage] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [recordIdFilter, setRecordIdFilter] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const PAGE_SIZE = 50;

  // Access local store for efficient resolving
  const { profiles, songs, gigs, setlists, sets } = useStore();

  // Optimized resolver function
  const resolveRecordName = useCallback((id: string): string | null => {
    if (!id) return null;

    // 1. Profiles
    if (profiles[id]) {
      const p = profiles[id];
      return `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unknown User';
    }

    // 2. Songs
    if (songs[id]) return songs[id].title;

    // 3. Setlists
    if (setlists[id]) return setlists[id].name;

    // 4. Gigs
    if (gigs[id]) return gigs[id].name;

    // 5. Sets (Resolve to "Setlist Name • Set Name")
    if (sets[id]) {
      const s = sets[id];
      const sl = setlists[s.setlist_id];
      return sl ? `${sl.name} • ${s.name}` : s.name;
    }

    return null;
  }, [profiles, songs, gigs, setlists, sets]);


  // --- Realtime Subscription ---
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel('public:audit_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          const matchesTable = selectedTable === 'all' || payload.new.table_name === selectedTable;
          const matchesOp = selectedOperations.length === 0 || selectedOperations.includes(payload.new.operation);
          
          if (matchesTable && matchesOp) {
             queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, selectedTable, selectedOperations, queryClient]);


  // --- Data Fetching ---

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, selectedTable, selectedOperations, recordIdFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('changed_at', { ascending: false });
      
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedTable !== "all") query = query.eq('table_name', selectedTable);
      if (selectedOperations.length > 0) query = query.in('operation', selectedOperations);
      if (recordIdFilter) query = query.eq('record_id', recordIdFilter);

      const { data, count, error } = await query;
      if (error) throw error;
      return { data, count };
    },
    refetchOnWindowFocus: false,
  });

  // --- Event Handlers ---

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const toggleOperation = (op: string) => {
    setSelectedOperations(prev => 
      prev.includes(op) ? prev.filter(o => o !== op) : [...prev, op]
    );
  };

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-8 w-8 text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground">Comprehensive history of system activities.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={isLive ? "default" : "outline"}
              onClick={() => setIsLive(!isLive)}
              className={cn("gap-2 min-w-[120px]", isLive && "animate-pulse bg-green-600 hover:bg-green-700 text-white border-green-600")}
            >
              {isLive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
              {isLive ? "Live Streaming" : "Paused"}
            </Button>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
             
             {/* Operations Filter */}
             <div className="flex-1 w-full space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Operations</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {selectedOperations.length === 0 ? "All Operations" : `${selectedOperations.length} Selected`}
                      <Filter className="h-3 w-3 opacity-50 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Filter by Operation</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {OPERATIONS.map(op => (
                      <DropdownMenuCheckboxItem 
                        key={op}
                        checked={selectedOperations.includes(op)}
                        onCheckedChange={() => toggleOperation(op)}
                      >
                        <Badge variant="outline" className={cn("mr-2 font-mono text-[10px]", getBadgeColor(op).split(' ')[0])}>
                          {op}
                        </Badge>
                      </DropdownMenuCheckboxItem>
                    ))}
                    {selectedOperations.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem 
                           checked={false} 
                           onCheckedChange={() => setSelectedOperations([])}
                           className="text-muted-foreground justify-center"
                        >
                           Clear Filters
                        </DropdownMenuCheckboxItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
             </div>

             {/* Table Filter */}
             <div className="flex-1 w-full space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Table</label>
                <div className="relative">
                   <select 
                     className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                     value={selectedTable}
                     onChange={(e) => setSelectedTable(e.target.value)}
                   >
                     <option value="all">All Tables</option>
                     {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none" />
                </div>
             </div>

             {/* Record ID Search */}
             <div className="flex-[2] w-full space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Record ID Search</label>
                <div className="relative">
                   <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Search by UUID..." 
                     className="pl-8 font-mono text-xs" 
                     value={recordIdFilter}
                     onChange={(e) => setRecordIdFilter(e.target.value)}
                   />
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <div className="rounded-md border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[100px]">Operation</TableHead>
              <TableHead className="w-[150px]">Table</TableHead>
              <TableHead>Record Details</TableHead>
              <TableHead className="w-[200px]">Changed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                   <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                   Loading audit trail...
                </TableCell>
              </TableRow>
            ) : logsData?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                   No logs found matching criteria.
                </TableCell>
              </TableRow>
            ) : (
              logsData?.data?.map((log) => {
                const link = getLinkForRecord(log.table_name, log.record_id || '');
                const resolvedName = resolveRecordName(log.record_id || '');
                const changerName = resolveRecordName(log.changed_by || '');
                const isExpanded = expandedRows.has(log.id);

                return (
                  <React.Fragment key={log.id}>
                    <TableRow 
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors border-l-4", 
                        isExpanded ? "bg-muted/30 border-l-primary" : "border-l-transparent"
                      )}
                      onClick={() => toggleRow(log.id)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.changed_at ? format(new Date(log.changed_at), "MMM d, HH:mm:ss") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("font-mono font-normal text-[10px]", getBadgeColor(log.operation))}>
                          {log.operation}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm text-foreground/80">{log.table_name}</TableCell>
                      <TableCell>
                         <div className="flex flex-col">
                            <span className="font-medium text-sm flex items-center gap-2">
                              {resolvedName || <span className="text-muted-foreground italic text-xs">Deleted or Unknown Record</span>}
                              
                              {log.table_name === 'set_songs' && !resolvedName && (
                                <span className="text-xs text-muted-foreground">(Set Song)</span>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-mono text-muted-foreground">{log.record_id?.slice(0, 8)}...</span>
                               {link && (
                                 <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Link to={link} onClick={(e) => e.stopPropagation()} className="hover:text-primary">
                                           <ExternalLink className="h-3 w-3 opacity-50 hover:opacity-100" />
                                        </Link>
                                      </TooltipTrigger>
                                      <TooltipContent>View Record</TooltipContent>
                                    </Tooltip>
                                 </TooltipProvider>
                               )}
                            </div>
                         </div>
                      </TableCell>
                      <TableCell>
                         {changerName ? (
                            <div className="flex items-center gap-2">
                               <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                  {changerName.charAt(0)}
                               </div>
                               <span className="text-sm">{changerName}</span>
                            </div>
                         ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                         )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent bg-muted/10">
                        <TableCell colSpan={6} className="p-4 pl-12">
                           <JsonDiff oldData={log.old_record} newData={log.new_record} resolve={resolveRecordName} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Footer / Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="text-xs text-muted-foreground">
          Showing {logsData?.data?.length || 0} recent events
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <div className="text-xs font-mono px-2">Page {page + 1}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={!logsData?.data || logsData.data.length < PAGE_SIZE}
          >
            Next
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AuditLogs;