import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import AdminRoute from "./components/AdminRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AuditLogs from "./pages/AuditLogs";
import Profiles from "./pages/Profiles";
import Songs from "./pages/Songs";
import SongDetail from "./pages/SongDetail";
import Gigs from "./pages/Gigs";
import GigDetail from "./pages/GigDetail";
import Setlists from "./pages/Setlists";
import SetlistDetail from "./pages/SetlistDetail";
import AppStatus from "./pages/AppStatus";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
            <Route path="/profiles" element={<AdminRoute><Profiles /></AdminRoute>} />
            
            <Route path="/songs" element={<AdminRoute><Songs /></AdminRoute>} />
            <Route path="/songs/:id" element={<AdminRoute><SongDetail /></AdminRoute>} />
            
            <Route path="/gigs" element={<AdminRoute><Gigs /></AdminRoute>} />
            <Route path="/gigs/:id" element={<AdminRoute><GigDetail /></AdminRoute>} />
            
            <Route path="/setlists" element={<AdminRoute><Setlists /></AdminRoute>} />
            <Route path="/setlists/:id" element={<AdminRoute><SetlistDetail /></AdminRoute>} />
            
            <Route path="/app-status" element={<AdminRoute><AppStatus /></AdminRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;