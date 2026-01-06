import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Trash2, MapPin, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const GigDetail = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // For Venue Search
  const [openVenueSearch, setOpenVenueSearch] = useState(false);
  const [venueQuery, setVenueQuery] = useState("");
  const [venueResults, setVenueResults] = useState<any[]>([]);

  // Form State (initialized when data loads if editing)
  const [formData, setFormData] = useState({
    name: '',
    venue_name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    start_time: '',
    end_time: '',
    notes: ''
  });

  // Fetch Gig if editing
  const { data: gig, isLoading } = useQuery({
    queryKey: ['gig', id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from('gigs').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew
  });

  // Initialize form
  useEffect(() => {
    if (gig) {
      setFormData({
        name: gig.name || '',
        venue_name: gig.venue_name || '',
        address: gig.address || '',
        city: gig.city || '',
        state: gig.state || '',
        zip: gig.zip || '',
        start_time: gig.start_time || '',
        end_time: gig.end_time || '',
        notes: gig.notes || ''
      });
    }
  }, [gig]);

  // Venue Search Mutation
  const searchVenues = useMutation({
    mutationFn: async (query: string) => {
      const { data, error } = await supabase.functions.invoke('places-search', {
        body: { query }
      });
      if (error) throw error;
      return data.items;
    },
    onSuccess: (data) => setVenueResults(data),
    onError: (err: any) => console.error(err)
  });

  const handleVenueSearch = (val: string) => {
    setVenueQuery(val);
    if (val.length > 3) {
      searchVenues.mutate(val);
    }
  };

  const selectVenue = (venue: any) => {
    setFormData(prev => ({
      ...prev,
      venue_name: venue.title,
      address: venue.street || venue.address,
      city: venue.city || '',
      state: venue.state || '',
      zip: venue.zip || ''
    }));
    setOpenVenueSearch(false);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
         // Get current user for created_by
         const { data: { user } } = await supabase.auth.getUser();
         const { error } = await supabase.from('gigs').insert([{ ...data, created_by: user?.id }]);
         if (error) throw error;
      } else {
         const { error } = await supabase.from('gigs').update(data).eq('id', id!);
         if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: isNew ? "Gig created" : "Gig updated" });
      navigate('/gigs');
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Soft Delete
      const { error } = await supabase
        .from('gigs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id!);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Gig deleted" });
      navigate('/gigs');
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Delete failed", description: err.message })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) return <AdminLayout>Loading...</AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-6">
        <Link to="/gigs" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Gigs
        </Link>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">{isNew ? 'Create New Gig' : 'Edit Gig Details'}</h1>
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={() => {
              if(confirm("Delete this gig?")) deleteMutation.mutate();
            }}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete Gig
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Event Name</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                  placeholder="e.g. Summer Festival 2024"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input 
                      type="datetime-local" 
                      value={formData.start_time} 
                      onChange={e => setFormData({...formData, start_time: e.target.value})} 
                      required
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input 
                      type="datetime-local" 
                      value={formData.end_time} 
                      onChange={e => setFormData({...formData, end_time: e.target.value})} 
                    />
                 </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  placeholder="Load in times, contacts, set list info..."
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Venue & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                 <Label>Venue Search</Label>
                 <Popover open={openVenueSearch} onOpenChange={setOpenVenueSearch}>
                   <PopoverTrigger asChild>
                     <Button variant="outline" role="combobox" className="w-full justify-between">
                       {formData.venue_name || "Search for a place..."}
                       <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="p-0" align="start">
                     <Command shouldFilter={false}>
                       <CommandInput placeholder="Type to search places..." value={venueQuery} onValueChange={handleVenueSearch} />
                       <CommandList>
                         {searchVenues.isPending && <div className="p-2 text-sm text-muted-foreground text-center">Searching...</div>}
                         <CommandEmpty>No places found.</CommandEmpty>
                         <CommandGroup>
                           {venueResults.map(venue => (
                             <CommandItem key={venue.id} onSelect={() => selectVenue(venue)}>
                               <MapPin className="mr-2 h-4 w-4" />
                               <div className="flex flex-col">
                                 <span>{venue.title}</span>
                                 <span className="text-xs text-muted-foreground">{venue.address}</span>
                               </div>
                             </CommandItem>
                           ))}
                         </CommandGroup>
                       </CommandList>
                     </Command>
                   </PopoverContent>
                 </Popover>
               </div>
               
               <div className="space-y-2">
                 <Label>Venue Name</Label>
                 <Input 
                   value={formData.venue_name} 
                   onChange={e => setFormData({...formData, venue_name: e.target.value})} 
                 />
               </div>
               <div className="space-y-2">
                 <Label>Address</Label>
                 <Input 
                   value={formData.address} 
                   onChange={e => setFormData({...formData, address: e.target.value})} 
                 />
               </div>
               <div className="grid grid-cols-6 gap-2">
                 <div className="col-span-3 space-y-2">
                   <Label>City</Label>
                   <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                 </div>
                 <div className="col-span-1 space-y-2">
                   <Label>State</Label>
                   <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                 </div>
                 <div className="col-span-2 space-y-2">
                   <Label>Zip</Label>
                   <Input value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} />
                 </div>
               </div>
            </CardContent>
          </Card>
          
          <Button size="lg" className="w-full" type="submit" disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save Gig Details
          </Button>
        </div>
      </form>
    </AdminLayout>
  );
};

export default GigDetail;