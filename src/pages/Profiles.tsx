import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, RefreshCw, Trash2, Shield, Key, LogOut, Unlink, UserCog, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Helper to call our edge function
const callAdminApi = async (action: string, payload: any = {}) => {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, payload }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

const Profiles = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // --- Queries ---

  // 1. Fetch Public Profiles (DB)
  const { data: profiles, isLoading: isProfilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // 2. Fetch Auth Users (Edge Function)
  const { data: authUsers, isLoading: isAuthLoading, refetch: refetchAuth } = useQuery({
    queryKey: ['admin-auth-users'],
    queryFn: async () => {
      const data = await callAdminApi('listUsers', { page: 1, perPage: 100 });
      return data.users;
    }
  });

  // Combine data
  const combinedUsers = profiles?.map(profile => {
    const authUser = authUsers?.find((u: any) => u.id === profile.id);
    return { ...profile, auth: authUser };
  }) || [];

  // --- Mutations ---

  const createUserMutation = useMutation({
    mutationFn: async (formData: any) => {
      return callAdminApi('createUser', {
        email: formData.email,
        password: formData.password || undefined, // If empty, supabase might auto-gen or we should handle it
        emailConfirm: true,
        userMetadata: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: formData.role
        }
      });
    },
    onSuccess: () => {
      toast({ title: "User created successfully" });
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-auth-users'] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Failed to create user", description: err.message })
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      // 1. Update Auth (Edge Function) for sensitive stuff like email, password, metadata
      if (data.password || data.email || data.user_metadata) {
        await callAdminApi('updateUser', {
          userId: data.id,
          attributes: {
            email: data.email,
            password: data.password,
            user_metadata: data.user_metadata
          }
        });
      }

      // 2. Update Public Profile (DB) for app specific fields
      if (data.profileUpdates) {
        const { error } = await supabase.from('profiles').update(data.profileUpdates).eq('id', data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "User updated successfully" });
      setIsDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-auth-users'] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Update failed", description: err.message })
  });

  const logoutUserMutation = useMutation({
    mutationFn: async (userId: string) => callAdminApi('logoutUser', { userId }),
    onSuccess: () => toast({ title: "User sessions invalidated (Logout forced)" }),
    onError: (err: any) => toast({ variant: "destructive", title: "Action failed", description: err.message })
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => callAdminApi('deleteUser', { userId }),
    onSuccess: () => {
      toast({ title: "User deleted" });
      setIsDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-auth-users'] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Delete failed", description: err.message })
  });

  const unlinkIdentityMutation = useMutation({
    mutationFn: async ({ userId, identityId }: { userId: string, identityId: string }) => 
      callAdminApi('unlinkIdentity', { userId, identityId }),
    onSuccess: () => {
      toast({ title: "Identity unlinked" });
      queryClient.invalidateQueries({ queryKey: ['admin-auth-users'] });
      // Close/re-open logic to refresh details would be ideal, but for now we invalidate
      refetchAuth(); 
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Unlink failed", description: err.message })
  });


  // --- Event Handlers ---

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    createUserMutation.mutate({
      email: formData.get('email'),
      password: formData.get('password'), // Optional
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      role: formData.get('role')
    });
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    // Construct updates
    const updates: any = {
      id: selectedUser.id,
      profileUpdates: {
        first_name: formData.get('firstName'),
        last_name: formData.get('lastName'),
        role: formData.get('role'),
        is_active: formData.get('is_active') === 'on',
        is_super_admin: formData.get('is_super_admin') === 'on',
        position: formData.get('position') || 'Other'
      },
      // Sync names to auth metadata as requested
      user_metadata: {
        first_name: formData.get('firstName'),
        last_name: formData.get('lastName'),
        role: formData.get('role') // Keep roles in sync
      }
    };

    updateUserMutation.mutate(updates);
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    updateUserMutation.mutate({
      id: selectedUser.id,
      password: formData.get('newPassword')
    });
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for(let i=0; i<12; i++) pass += chars[Math.floor(Math.random()*chars.length)];
    
    const passwordInput = document.getElementById("create-password") as HTMLInputElement;
    if(passwordInput) {
        passwordInput.value = pass;
        passwordInput.type = "text"; // Show it briefly or let user toggle
    }
  };

  const openDetail = (user: any) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">Users & Profiles</h1>
           <p className="text-muted-foreground">Manage system access, roles, and user details.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => { queryClient.invalidateQueries(); toast({description: "Refreshing..."}) }}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card card-shadow overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Auth Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isProfilesLoading || isAuthLoading ? (
               <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading users...</TableCell></TableRow>
            ) : combinedUsers.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(user)}>
                <TableCell>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarFallback>{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-medium">{user.first_name} {user.last_name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit">{user.role}</Badge>
                        {user.is_super_admin && <Badge className="w-fit bg-primary text-primary-foreground">Super Admin</Badge>}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex gap-1">
                        {user.auth?.identities?.map((id: any) => (
                            <Badge key={id.id} variant="secondary" className="capitalize">{id.provider}</Badge>
                        ))}
                        {!user.auth && <span className="text-muted-foreground text-sm">-</span>}
                    </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "default" : "destructive"}>
                    {user.is_active ? 'Active' : 'Banned/Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Manage</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* CREATE USER DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
                Create a new user account manually. They will be sent a confirmation email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" name="firstName" required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" name="lastName" required />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <Label htmlFor="create-password">Password</Label>
                    <span className="text-xs text-primary cursor-pointer hover:underline" onClick={generatePassword}>Generate Random</span>
                </div>
                <Input id="create-password" name="password" type="password" placeholder="Leave empty to auto-generate" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" defaultValue="standard">
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="standard">Standard User</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* USER DETAIL SHEET/DIALOG */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 gap-0">
          <div className="p-6 pb-2 border-b">
            <DialogTitle className="text-2xl flex items-center gap-2">
                {selectedUser?.first_name} {selectedUser?.last_name}
                {selectedUser?.is_super_admin && <Shield className="h-5 w-5 text-primary" />}
            </DialogTitle>
            <DialogDescription>{selectedUser?.email}</DialogDescription>
          </div>
          
          <Tabs defaultValue="profile" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-2 border-b bg-muted/30">
                <TabsList>
                    <TabsTrigger value="profile">Profile & Role</TabsTrigger>
                    <TabsTrigger value="security">Security & Access</TabsTrigger>
                    <TabsTrigger value="raw">Raw Data</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="profile" className="flex-1 overflow-y-auto p-6 space-y-6">
                <form id="update-profile-form" onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input name="firstName" defaultValue={selectedUser?.first_name} />
                        </div>
                        <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input name="lastName" defaultValue={selectedUser?.last_name} />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Role</Label>
                            <Select name="role" defaultValue={selectedUser?.role || 'standard'}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="standard">Standard</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Position</Label>
                            <Input name="position" defaultValue={selectedUser?.position} placeholder="e.g. Guitarist" />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-medium text-sm text-muted-foreground">Account Status</h3>
                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <Label>Active Status</Label>
                                <div className="text-xs text-muted-foreground">Disable to prevent login</div>
                            </div>
                            <Switch name="is_active" defaultChecked={selectedUser?.is_active} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <Label className="text-primary font-bold">Super Admin Access</Label>
                                <div className="text-xs text-muted-foreground">Grants full access to this console</div>
                            </div>
                            <Switch name="is_super_admin" defaultChecked={selectedUser?.is_super_admin} />
                        </div>
                    </div>
                    <Button type="submit" className="w-full mt-4" disabled={updateUserMutation.isPending}>Save Changes</Button>
                </form>
            </TabsContent>

            <TabsContent value="security" className="flex-1 overflow-y-auto p-6 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4"/> Password Reset</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordReset} className="flex gap-2 items-end">
                            <div className="flex-1 space-y-2">
                                <Label>New Password</Label>
                                <Input name="newPassword" type="password" placeholder="Enter new password" minLength={6} required />
                            </div>
                            <Button type="submit" variant="secondary">Update</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><Unlink className="h-4 w-4"/> Linked Identities</CardTitle>
                        <CardDescription>Manage social logins connected to this account</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {selectedUser?.auth?.identities?.length > 0 ? (
                            selectedUser.auth.identities.map((id: any) => (
                                <div key={id.id} className="flex items-center justify-between p-2 border rounded text-sm">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="capitalize">{id.provider}</Badge>
                                        <span className="text-muted-foreground text-xs font-mono">{id.id}</span>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 text-destructive hover:text-destructive"
                                        onClick={() => unlinkIdentityMutation.mutate({ userId: selectedUser.id, identityId: id.id })}
                                    >
                                        Unlink
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No linked identities (Email/Password only).</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-destructive/20 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="text-base text-destructive flex items-center gap-2"><Shield className="h-4 w-4"/> Danger Zone</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-sm">Force Logout</h4>
                                <p className="text-xs text-muted-foreground">Invalidate all active sessions for this user.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => logoutUserMutation.mutate(selectedUser.id)}>
                                <LogOut className="mr-2 h-3 w-3" /> Sign Out User
                            </Button>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-destructive/20">
                            <div>
                                <h4 className="font-medium text-sm text-destructive">Delete Account</h4>
                                <p className="text-xs text-muted-foreground">Permanently remove this user and their data.</p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => {
                                if(confirm("Are you sure? This cannot be undone.")) deleteUserMutation.mutate(selectedUser.id)
                            }}>
                                <Trash2 className="mr-2 h-3 w-3" /> Delete User
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="raw" className="flex-1 overflow-y-auto p-6">
                <pre className="text-xs font-mono bg-muted p-4 rounded overflow-auto h-full">
                    {JSON.stringify(selectedUser, null, 2)}
                </pre>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
};

export default Profiles;