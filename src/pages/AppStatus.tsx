import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const ENVIRONMENTS = ["production", "staging", "development"];
const PLATFORMS = ["ios", "android", "any"];

const AppStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeEnv, setActiveEnv] = useState("production");
  const [activePlatform, setActivePlatform] = useState("ios");

  // Fetch all statuses
  const { data: statuses, isLoading } = useQuery({
    queryKey: ['app_statuses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_statuses').select('*');
      if (error) throw error;
      return data;
    }
  });

  // Get current status object based on selection
  const currentStatus = statuses?.find(
    s => s.environment === activeEnv && s.platform === activePlatform
  );

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      // Upsert based on composite unique key (platform, environment)
      const payload = {
        environment: activeEnv,
        platform: activePlatform,
        ...values,
        changed_at: new Date().toISOString()
      };
      
      // If we have an ID, use it for update, otherwise insert
      if (currentStatus?.id) {
         const { error } = await supabase
           .from('app_statuses')
           .update(payload)
           .eq('id', currentStatus.id);
         if (error) throw error;
      } else {
         const { error } = await supabase
           .from('app_statuses')
           .insert([payload]);
         if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app_statuses'] });
      toast({ title: "Status updated successfully" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const values = {
      is_maintenance: formData.get('is_maintenance') === 'on',
      maintenance_message: formData.get('maintenance_message'),
      requires_update: formData.get('requires_update') === 'on',
      min_version_code: formData.get('min_version_code') ? parseInt(formData.get('min_version_code') as string) : null,
      min_version_name: formData.get('min_version_name'),
      update_url_android: formData.get('update_url_android'),
      update_url_ios: formData.get('update_url_ios'),
      // Dates - simplified for this demo, usually would use a date picker
      // maintenance_started_at: ... 
      // maintenance_expected_end_at: ...
    };

    mutation.mutate(values);
  };

  if (isLoading) return <AdminLayout>Loading...</AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">App Status & Versions</h1>
        <p className="text-muted-foreground">Manage maintenance modes and forced updates per environment.</p>
      </div>

      <Tabs value={activeEnv} onValueChange={setActiveEnv} className="space-y-6">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
          {ENVIRONMENTS.map(env => (
             <TabsTrigger 
               key={env} 
               value={env}
               className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 capitalize"
             >
               {env}
             </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Platform Selector Sidebar */}
          <div className="w-full lg:w-48 flex flex-row lg:flex-col gap-2">
            {PLATFORMS.map(platform => {
              const status = statuses?.find(s => s.environment === activeEnv && s.platform === platform);
              const isMaintenance = status?.is_maintenance;
              
              return (
                <Button
                  key={platform}
                  variant={activePlatform === platform ? "default" : "outline"}
                  onClick={() => setActivePlatform(platform)}
                  className="justify-between uppercase"
                >
                  {platform}
                  {isMaintenance && <AlertTriangle className="h-3 w-3 text-destructive" />}
                </Button>
              );
            })}
          </div>

          {/* Form Content */}
          <Card className="flex-1">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                   <CardTitle className="capitalize">{activePlatform} Configuration</CardTitle>
                   <CardDescription>
                     {activeEnv} environment
                     {currentStatus?.changed_at && ` • Last updated ${format(new Date(currentStatus.changed_at), "MMM d, h:mm a")}`}
                   </CardDescription>
                </div>
                {currentStatus?.is_maintenance ? (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3"/> Maintenance Mode</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="h-3 w-3"/> Operational</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Maintenance Section */}
                <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">Stop users from accessing the app.</p>
                    </div>
                    <Switch name="is_maintenance" defaultChecked={currentStatus?.is_maintenance} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea 
                      name="maintenance_message" 
                      placeholder="e.g. We are performing scheduled maintenance." 
                      defaultValue={currentStatus?.maintenance_message || ''}
                    />
                  </div>
                </div>

                {/* Updates Section - Hide for 'any' if strictly web, but schema allows it. Keeping generic. */}
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Force Update</Label>
                      <p className="text-sm text-muted-foreground">Require users to update to minimum version.</p>
                    </div>
                    <Switch 
                      name="requires_update" 
                      defaultChecked={currentStatus?.requires_update} 
                      disabled={activePlatform === 'any'} // Assuming 'any' implies web which auto-updates
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Version Code (Integer)</Label>
                      <Input type="number" name="min_version_code" defaultValue={currentStatus?.min_version_code || ''} />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Version Name (String)</Label>
                      <Input name="min_version_name" placeholder="1.0.0" defaultValue={currentStatus?.min_version_name || ''} />
                    </div>
                  </div>

                  {activePlatform === 'android' && (
                    <div className="space-y-2">
                      <Label>Play Store URL</Label>
                      <Input name="update_url_android" defaultValue={currentStatus?.update_url_android || ''} />
                    </div>
                  )}

                  {activePlatform === 'ios' && (
                    <div className="space-y-2">
                      <Label>App Store URL</Label>
                      <Input name="update_url_ios" defaultValue={currentStatus?.update_url_ios || ''} />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                   <Button type="submit" disabled={mutation.isPending}>
                     {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     <Save className="mr-2 h-4 w-4" />
                     Save Configuration
                   </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </AdminLayout>
  );
};

export default AppStatus;