import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, CloudOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const SyncStatus = () => {
  const { lastSyncedAt, syncDeltas, isOnline } = useStore();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleSync = async () => {
    setIsSpinning(true);
    await syncDeltas();
    setTimeout(() => setIsSpinning(false), 500); // Visual feedback
  };

  return (
    <div className="px-2 py-1 flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-start">
               <div className="flex items-center text-[10px] text-muted-foreground gap-1.5 font-medium">
                  {isOnline ? (
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  ) : (
                    <CloudOff className="h-3 w-3 text-muted-foreground" />
                  )}
                  {lastSyncedAt ? (
                    <span>Updated {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}</span>
                  ) : (
                    <span>Not synced</span>
                  )}
               </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Database Version: {useStore.getState().lastSyncedVersion}</p>
            <p>Status: {isOnline ? 'Online' : 'Offline'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 text-muted-foreground hover:text-foreground" 
        onClick={handleSync}
        disabled={!isOnline}
      >
        <RefreshCw className={cn("h-3 w-3", isSpinning && "animate-spin")} />
      </Button>
    </div>
  );
};