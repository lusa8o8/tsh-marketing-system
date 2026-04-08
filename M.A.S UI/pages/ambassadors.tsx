import { useState } from "react";
import { useListAmbassadors, useUpdateAmbassador, useDeleteAmbassador, useCreateAmbassador, getListAmbassadorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Flag, Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function Ambassadors() {
  const { data: ambassadors, isLoading } = useListAmbassadors();
  const queryClient = useQueryClient();

  const updateMutation = useUpdateAmbassador({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAmbassadorsQueryKey() })
    }
  });

  const deleteMutation = useDeleteAmbassador({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAmbassadorsQueryKey() })
    }
  });

  const createMutation = useCreateAmbassador({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAmbassadorsQueryKey() });
        setCreateOpen(false);
      }
    }
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", university: "", weekly_reach: 0 });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ data: formData });
  };

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-background">
        <h1 className="font-semibold text-lg">Ambassadors</h1>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Ambassador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Ambassador</DialogTitle>
              <DialogDescription>
                Register a new student ambassador for the platform.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="university">University</Label>
                <Input id="university" value={formData.university} onChange={e => setFormData({ ...formData, university: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reach">Weekly Reach</Label>
                <Input id="reach" type="number" min="0" value={formData.weekly_reach} onChange={e => setFormData({ ...formData, weekly_reach: parseInt(e.target.value) || 0 })} required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  Create Ambassador
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto border rounded-lg bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>University</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Check-in</TableHead>
                <TableHead className="text-right">Weekly Reach</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : ambassadors?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>No ambassadors yet — recruit your first one.</p>
                  </TableCell>
                </TableRow>
              ) : (
                ambassadors?.map((ambassador) => (
                  <TableRow key={ambassador.id}>
                    <TableCell className="font-medium">{ambassador.name}</TableCell>
                    <TableCell>{ambassador.university}</TableCell>
                    <TableCell>
                      <Badge variant={
                        ambassador.status === 'active' ? 'default' : 
                        ambassador.status === 'flagged' ? 'secondary' : 'outline'
                      } className={cn(
                        "capitalize text-[10px] font-medium",
                        ambassador.status === 'active' && "bg-green-100 text-green-800 hover:bg-green-100 border-green-200",
                        ambassador.status === 'flagged' && "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200"
                      )}>
                        {ambassador.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {ambassador.last_checkin ? `${formatDistanceToNow(new Date(ambassador.last_checkin))} ago` : "Never"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {ambassador.weekly_reach.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {ambassador.status !== 'flagged' && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => updateMutation.mutate({ id: ambassador.id, data: { status: 'flagged' } })}
                            title="Flag issue"
                          >
                            <Flag className="w-4 h-4" />
                          </Button>
                        )}
                        {ambassador.status === 'flagged' && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => updateMutation.mutate({ id: ambassador.id, data: { status: 'active' } })}
                            title="Resolve flag"
                          >
                            <Flag className="w-4 h-4 fill-current" />
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Remove ${ambassador.name}?`)) {
                              deleteMutation.mutate({ id: ambassador.id });
                            }
                          }}
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}