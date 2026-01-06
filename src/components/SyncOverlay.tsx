import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Progress } from "@/components/ui/progress";
import { Loader2, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

export const SyncOverlay = ({ children }: { children: React.ReactNode }) => {
  const { initialize, isInitialized, isLoading, loadingProgress, loadingMessage } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only init if we have a session
    supabase.auth.getSession().then(({ data: { session } }) => {
       if (session && !isInitialized) {
          initialize();
       }
    });
  }, [initialize, isInitialized]);

  // If on public routes, render children immediately
  if (location.pathname === '/login' || location.pathname === '/auth/callback') {
    return <>{children}</>;
  }

  if (!isInitialized || isLoading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
           <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                 <Database className="h-8 w-8 text-primary" />
              </div>
           </div>
           
           <div className="space-y-2">
             <h2 className="text-2xl font-bold tracking-tight">Syncing Database</h2>
             <p className="text-muted-foreground text-sm">
                Fetching latest data... {Math.round(loadingProgress)}%
             </p>
           </div>
           
           <Progress value={loadingProgress} className="h-2" />
           
           <p className="text-xs text-muted-foreground animate-pulse">
             {loadingMessage}
           </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};