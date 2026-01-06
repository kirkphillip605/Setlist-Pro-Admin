import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Progress } from "@/components/ui/progress";
import { Loader2, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

export const SyncOverlay = ({ children }: { children: React.ReactNode }) => {
  const { initialize, isInitialized, isLoading, loadingProgress, loadingMessage } = useStore();
  const [authChecked, setAuthChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // If no session, we mark auth as checked and do NOT initialize sync.
        // This allows the router to render (which will redirect to /login or show public pages)
        setAuthChecked(true);
      } else {
        // If session exists, we initialize the store (which sets isLoading=true)
        if (!isInitialized) {
           await initialize();
        }
        setAuthChecked(true);
      }
    };

    checkAuth();

    // Listen for auth changes to trigger init or reset
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
         initialize();
      } else if (event === 'SIGNED_OUT') {
         // Data clearing is handled by the logout button, but good to ensure here just in case?
         // Actually, calling reset() here might be safer in the layout component 
         // to avoid race conditions during render.
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize, isInitialized]);

  // Public Routes Check
  const isPublicRoute = location.pathname === '/login' || location.pathname === '/auth/callback';

  // If we haven't checked auth yet, show a minimal spinner (not the full sync overlay)
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If we are on a public route, just render.
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // If authenticated but syncing/loading
  if (isLoading && !isPublicRoute) {
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