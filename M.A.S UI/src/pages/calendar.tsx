import { useState } from "react";
import { useListCalendarEvents, useCreateCalendarEvent, getListCalendarEventsQueryKey } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const UNI_OPTIONS = ["UNZA", "CBU", "MU", "ZCAS", "DMI"];

export default function Calendar() {
  const { data: events, isLoading } = useListCalendarEvents();
  const queryClient = useQueryClient();

  const createMutation = useCreateCalendarEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCalendarEventsQueryKey() });
        setCreateOpen(false);
      }
    }
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    event_type: "exam" as any,
    event_date: new Date().toISOString().split('T')[0],
    label: "",
    universities: [] as string[]
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ data: formData });
  };

  const toggleUni = (uni: string) => {
    setFormData(prev => ({
      ...prev,
      universities: prev.universities.includes(uni)
        ? prev.universities.filter(u => u !== uni)
        : [...prev.universities, uni]
    }));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-6 flex items-center justify-between shrink-0 bg-background">
        <h1 className="font-semibold text-lg">Academic Calendar</h1>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Calendar Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <Select value={formData.event_type} onValueChange={v => setFormData({...formData, event_type: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="registration">Registration</SelectItem>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="orientation">Orientation</SelectItem>
                      <SelectItem value="graduation">Graduation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Label / Description</Label>
                <Input value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} placeholder="e.g. End of Semester Exams" required />
              </div>
              <div className="space-y-2">
                <Label>Universities</Label>
                <div className="flex flex-wrap gap-2">
                  {UNI_OPTIONS.map(uni => (
                    <Badge 
                      key={uni}
                      variant={formData.universities.includes(uni) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleUni(uni)}
                    >
                      {uni}
                    </Badge>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || formData.universities.length === 0}>
                  Save Event
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 bg-card flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))
          ) : events?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No upcoming academic events.</p>
            </div>
          ) : (
            events?.map(event => {
              const date = new Date(event.event_date);
              const isToday = new Date().toDateString() === date.toDateString();
              const isPast = date < new Date() && !isToday;
              
              return (
                <div key={event.id} className={cn(
                  "border rounded-lg p-4 bg-card shadow-sm flex items-center gap-5 transition-opacity",
                  isPast && "opacity-60 bg-muted/30"
                )}>
                  <div className={cn(
                    "flex flex-col items-center justify-center w-16 h-16 rounded-md shrink-0 border",
                    isToday ? "bg-primary/10 border-primary/20 text-primary" : 
                    isPast ? "bg-muted border-muted-foreground/20 text-muted-foreground" : 
                    "bg-blue-50 border-blue-100 text-blue-700"
                  )}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {date.toLocaleString('default', { month: 'short' })}
                    </span>
                    <span className="text-xl font-bold leading-none mt-1">
                      {date.getDate()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className={cn("font-semibold text-[15px] truncate", isPast && "text-muted-foreground")}>
                        {event.label}
                      </h3>
                      <Badge variant="outline" className="text-[10px] capitalize h-5 font-medium">
                        {event.event_type}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {event.universities.map(uni => (
                        <Badge key={uni} variant="secondary" className="text-[10px] bg-muted hover:bg-muted font-medium text-muted-foreground">
                          {uni}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex flex-col items-center justify-center gap-1 w-20 text-center">
                    {event.triggered ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="text-[10px] font-medium text-green-600">Triggered</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-5 h-5 text-muted-foreground/50" />
                        <span className="text-[10px] font-medium text-muted-foreground">Pending</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
