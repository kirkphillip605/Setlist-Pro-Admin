import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { session, loading: authLoading } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for the AuthProvider to initialize
    if (authLoading) return;

    if (!session) {
      navigate("/login");
      return;
    }

    const checkRole = async () => {
      try {
        // Check for is_super_admin flag in the public.profiles table
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_super_admin')
          .eq('id', session.user.id)
          .single();

        if (error || !profile?.is_super_admin) {
          console.error("Access denied: User is not a super admin", error);
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }

      } catch (error) {
        console.error("Role check failed", error);
        navigate("/login");
      } finally {
        setCheckingRole(false);
      }
    };

    checkRole();
  }, [session, authLoading, navigate]);

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return authorized ? <>{children}</> : (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-muted-foreground mb-4">You do not have super admin privileges.</p>
      <div className="space-y-2">
        <button onClick={() => navigate("/login")} className="block w-full text-primary hover:underline">
          Return to Login
        </button>
      </div>
    </div>
  );
};

export default AdminRoute;