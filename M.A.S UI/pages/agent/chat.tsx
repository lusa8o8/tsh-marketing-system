import { useState, useRef, useEffect } from "react";
import { useGetOrgConfig } from "@workspace/api-client-react";
import { Bot, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Mock data for chat
const INITIAL_MESSAGES = [
  {
    id: "1",
    role: "user",
    content: "How did the system perform this week?"
  },
  {
    id: "2",
    role: "coordinator",
    content: "Good week overall. Pipeline A processed 47 comments with 0 errors. Pipeline B drafted 5 posts — 3 approved, 2 pending your review. YouTube engagement is up 12% week-over-week. One urgent escalation in your inbox from an angry student comment on Facebook — worth reviewing today."
  },
  {
    id: "3",
    role: "user",
    content: "Run the engagement pipeline now"
  },
  {
    id: "4",
    role: "coordinator",
    content: "I can run the engagement pipeline for you right now.",
    isConfirmation: true,
    confirmationData: {
      title: "Run Pipeline A — Engagement",
      description: "This will process today's comments and flag any escalations."
    }
  }
];

const SUGGESTIONS = [
  "Run engagement pipeline",
  "How did last week go?",
  "Check ambassador status",
  "What's next on the calendar?"
];

export default function AgentChat() {
  const { data: config } = useGetOrgConfig();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const coordinatorName = "Coordinator"; // Could use config?.org_name if needed

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text: string = inputValue) => {
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "user",
      content: text
    }]);
    setInputValue("");
    
    // Mock response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "coordinator",
        content: "I've noted your request. As a mock interface, I don't process live commands yet, but I'm ready when connected to the live API."
      }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <header className="h-14 border-b px-6 flex items-center shrink-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">Agent Manager</span>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Chat
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex w-full",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex max-w-[80%] gap-3",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}>
                {msg.role === "coordinator" && (
                  <Avatar className="w-8 h-8 border bg-muted shrink-0 mt-1">
                    <AvatarFallback className="bg-transparent">
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className="flex flex-col gap-1">
                  {msg.role === "coordinator" && (
                    <span className="text-[11px] font-medium text-muted-foreground ml-1">
                      {coordinatorName}
                    </span>
                  )}
                  
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm",
                    msg.role === "user" 
                      ? "bg-[#111] text-white rounded-tr-sm" 
                      : "bg-muted/50 border text-foreground rounded-tl-sm"
                  )}>
                    {msg.content}
                  </div>
                  
                  {msg.isConfirmation && msg.confirmationData && (
                    <div className="mt-2 border rounded-xl p-4 bg-card shadow-sm w-full md:w-[350px]">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-foreground">{msg.confirmationData.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 leading-snug">
                            {msg.confirmationData.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full">
                        <Button variant="outline" className="flex-1 h-9 text-xs" onClick={() => handleSend("Cancel pipeline run")}>Cancel</Button>
                        <Button className="flex-1 h-9 text-xs" onClick={() => handleSend("Confirm run")}>Confirm</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 p-6 bg-background border-t">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSend(suggestion)}
                className="px-3 py-1.5 bg-muted/50 hover:bg-muted border rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-muted-foreground/20 rounded-xl bg-muted/30 shadow-sm px-3 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1 transition-shadow">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask the coordinator anything..."
              className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 py-5 px-1 text-sm placeholder:text-muted-foreground"
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg transition-transform active:scale-95"
              disabled={!inputValue.trim()}
              onClick={() => handleSend()}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}