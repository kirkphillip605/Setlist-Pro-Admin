import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Music, 
  Mic2, 
  ListMusic, 
  Activity, 
  Smartphone,
  LogOut,
  Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { Logo } from "@/components/Logo";
import { useStore } from "@/lib/store";
import { SyncStatus } from "@/components/SyncStatus";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Radio, label: "Live Sessions", path: "/gig-sessions" },
  { icon: Users, label: "Users & Profiles", path: "/profiles" },
  { icon: Music, label: "Songs", path: "/songs" },
  { icon: Mic2, label: "Gigs", path: "/gigs" },
  { icon: ListMusic, label: "Setlists", path: "/setlists" },
  { icon: Smartphone, label: "App Status", path: "/app-status" },
  { icon: Activity, label: "Audit Logs", path: "/audit-logs" },
];

export const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const resetStore = useStore(state => state.reset);

  const handleLogout = async () => {
    // 1. Clear Local Store & DB
    await resetStore();
    
    // 2. Sign Out Supabase
    await supabase.auth.signOut();
    
    // 3. Redirect
    navigate("/login");
  };

  return (
    <div className="h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col fixed left-0 top-0 border-r border-sidebar-border transition-colors duration-300">
      <div className="p-6 h-16 flex items-center">
        <Logo />
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-4">
        <SyncStatus />
        
        <div className="space-y-2">
          <ModeToggle />
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 px-2"
            onClick={handleLogout}
          >
            <LogOut className="h-[1.2rem] w-[1.2rem] mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};