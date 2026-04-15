import { useState } from "react";
import {
  useListCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  getListCalendarEventsQueryKey,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, CheckCircle2, Clock, Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";



type EventFormData = {
  event_type: string;
  event_date: string;
  event_end_date: string;
  label: string;
  universities: string[];
  creative_override_allowed: boolean;
};

function EventForm({
  value,
  onChange,
  onSubmit,
  isPending,
  submitLabel,
}: {
  value: EventFormData;
  onChange: (v: EventFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  submitLabel: string;
}) {

  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Event Type</Label>
          <Select value={value.event_type} onValueChange={(v) => onChange({ ...value, event_type: v })}>
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
          <Label>Start Date</Label>
          <Input
            type="date"
            value={value.event_date}
            onChange={(e) => onChange({ ...value, event_date: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>End Date <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            type="date"
            value={value.event_end_date}
            min={value.event_date}
            onChange={(e) => onChange({ ...value, event_end_date: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">For events that run over several days, like sales windows, conferences, or festivals.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Label / Description</Label>
        <Input
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="e.g. Grand opening weekend"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Audience Tags <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          value={value.universities.join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              universities: e.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
          placeholder="e.g. students, staff, shoppers, vendors"
        />
        <p className="text-[11px] text-muted-foreground">
          Use short labels for the people this event matters to. Leave blank if it is a general event.
        </p>
      </div>
      {["holiday", "graduation", "other"].includes(value.event_type) && (
        <div className="flex items-start gap-3 rounded-md border border-amber-100 bg-amber-50/50 p-3">
          <Switch
            checked={value.creative_override_allowed}
            onCheckedChange={(v) => onChange({ ...value, creative_override_allowed: v })}
          />
          <div>
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <Sparkles className="h-3 w-3" /> Allow creative deviation
            </Label>
            <p className="mt-0.5 text-[11px] leading-snug text-amber-700/80">
              Permits the design agent to deviate from the brand palette within the accent color family. Use for seasonal or celebratory events.
            </p>
          </div>
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

const BLANK_FORM: EventFormData = {
  event_type: "exam",
  event_date: new Date().toISOString().split("T")[0],
  event_end_date: "",
  label: "",
  universities: [],
  creative_override_allowed: false,
};

export default function Calendar() {
  const { data: events, isLoading } = useListCalendarEvents();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCalendarEventsQueryKey() });

  const createMutation = useCreateCalendarEvent({
    mutation: { onSuccess: () => { invalidate(); setCreateOpen(false); } },
  });
  const updateMutation = useUpdateCalendarEvent({
    mutation: { onSuccess: () => { invalidate(); setEditEvent(null); } },
  });
  const deleteMutation = useDeleteCalendarEvent({
    mutation: {
      onSuccess: () => { invalidate(); setDeleteId(null); },
      onError: (err: any) => toast({ title: "Failed to delete event", description: err?.message ?? "Unknown error", variant: "destructive" }),
    },
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EventFormData>(BLANK_FORM);

  const [editEvent, setEditEvent] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EventFormData>(BLANK_FORM);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openEdit(event: any) {
    setEditForm({
      event_type: event.event_type,
      event_date: event.event_date,
      event_end_date: event.event_end_date ?? "",
      label: event.label,
      universities: event.universities ?? [],
      creative_override_allowed: event.creative_override_allowed ?? false,
    });
    setEditEvent(event);
  }

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(244,241,235,0.45)_0%,rgba(244,241,235,0)_30%)]">
      <header className="shrink-0 border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Event Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upcoming dates and trigger windows that samm can plan work around.
            </p>
          </div>

          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (open) setCreateForm(BLANK_FORM);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Event</DialogTitle>
              </DialogHeader>
              <EventForm
                value={createForm}
                onChange={setCreateForm}
                onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ data: createForm }); }}
                isPending={createMutation.isPending}
                submitLabel="Save Event"
              />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Edit dialog */}
      <Dialog open={!!editEvent} onOpenChange={(open) => { if (!open) setEditEvent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <EventForm
            value={editForm}
            onChange={setEditForm}
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({ id: editEvent.id, data: editForm });
            }}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Any automations tied to this event will stop using it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto max-w-4xl space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                <Skeleton className="h-14 w-14 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))
          ) : events?.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <CalendarDays className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>No upcoming events yet.</p>
            </div>
          ) : (
            events?.map((event) => {
              const date = new Date(event.event_date);
              const isToday = new Date().toDateString() === date.toDateString();
              const isPast = date < new Date() && !isToday;

              return (
                <div
                  key={event.id}
                  className={cn(
                    "flex items-center gap-5 rounded-xl border border-border bg-card p-4 shadow-sm transition-opacity",
                    isPast && "bg-muted/30 opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border",
                      isToday
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : isPast
                        ? "border-muted-foreground/20 bg-muted text-muted-foreground"
                        : "border-blue-100 bg-blue-50 text-blue-700"
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {date.toLocaleString("default", { month: "short" })}
                    </span>
                    <span className="mt-1 text-xl font-bold leading-none">{date.getDate()}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <h3 className={cn("truncate text-[15px] font-semibold", isPast && "text-muted-foreground")}>
                        {event.label}
                      </h3>
                      <Badge variant="outline" className="h-5 text-[10px] font-medium capitalize">
                        {event.event_type}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {event.universities.map((uni: string) => (
                        <Badge
                          key={uni}
                          variant="secondary"
                          className="bg-muted text-[10px] font-medium text-muted-foreground hover:bg-muted"
                        >
                          {uni}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex w-20 flex-col items-center justify-center gap-1 text-center">
                      {event.triggered ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="text-[10px] font-medium text-green-600">Triggered</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-5 w-5 text-muted-foreground/50" />
                          <span className="text-[10px] font-medium text-muted-foreground">Pending</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(event)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(event.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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


