import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Progress } from "@/components/ui/progress";
import { Loader2, Database } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";

export const SyncOverlay = ({ children }: { children: React.ReactNode }) => {
  const { initialize, isInitialized, isLoading, loadingProgress, loadingMessage } = useStore();
  const { session, loading: authLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Only attempt to initialize store if auth is done loading and we have a session
    if (!authLoading && session && !isInitialized) {
       initialize();
    }
  }, [authLoading, session, initialize, isInitialized]);

  // Public Routes Check
  const isPublicRoute = location.pathname === '/login' || location.pathname === '/auth/callback';

  // While AuthProvider is loading initially, show a spinner to prevent flickering
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If we are on a public route, or if we have no session (which will be redirected by AdminRoute), just render children
  if (isPublicRoute || !session) {
    return <>{children}</>;
  }

  // If authenticated but local store syncing is in progress
  if (isLoading) {
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