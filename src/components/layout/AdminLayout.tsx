import { AdminSidebar } from "./AdminSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <AdminSidebar />
      <div className="pl-64">
        <ScrollArea className="h-screen">
          <main className="p-8 max-w-7xl mx-auto">
            {children}
          </main>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminLayout;