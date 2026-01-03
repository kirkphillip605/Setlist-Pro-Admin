import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminRoute from "./components/AdminRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AuditLogs from "./pages/AuditLogs";
import Profiles from "./pages/Profiles";
import Songs from "./pages/Songs";
import Gigs from "./pages/Gigs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          <Route path="/gigs" element={<AdminRoute><Gigs /></AdminRoute>} />
          
          {/* Fallback routes */}
          <Route path="/setlists" element={<AdminRoute><Dashboard /></AdminRoute>} /> {/* Placeholder */}
          <Route path="/app-status" element={<AdminRoute><Dashboard /></AdminRoute>} /> {/* Placeholder */}
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;