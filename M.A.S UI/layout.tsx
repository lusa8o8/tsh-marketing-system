import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  LayoutList,
  BarChart2,
  Users,
  CalendarDays,
  Bot,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useGetInboxSummary, useGetOrgConfig } from "@/lib/api";
import { signOut } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/inbox", label: "Inbox", icon: Bell },
  { href: "/content", label: "Content", icon: LayoutList },
  { href: "/metrics", label: "Metrics", icon: BarChart2 },
  { href: "/ambassadors", label: "Ambassadors", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/agent", label: "Agent Manager", icon: Bot, isPrefix: true },
];

const agentSubnav = [
  { path: "/agent/overview", label: "Overview" },
  { path: "/agent/chat", label: "Chat" },
  { path: "/agent/settings", label: "Settings" },
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const [location] = useLocation();
  const { data: summary } = useGetInboxSummary();
  const { data: config } = useGetOrgConfig();
  const isAgentActive = location.startsWith("/agent");

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <div className="p-4 flex flex-col gap-1 border-b border-sidebar-border">
        <h1 className="font-bold text-lg leading-tight">{config?.org_name ?? "TSH"}</h1>
        <p className="text-xs text-muted-foreground font-medium">Marketing OS</p>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.isPrefix
            ? location.startsWith(item.href)
            : location === item.href;

          return (
            <div key={item.href}>
              <Link href={item.href} onClick={onNavigate}>
                <div
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </div>
                  {item.href === "/inbox" && summary?.unread ? (
                    <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {summary.unread}
                    </span>
                  ) : null}
                </div>
              </Link>

              {item.href === "/agent" && isAgentActive && (
                <div className="ml-9 mt-1 space-y-1 border-l border-sidebar-border/50 pl-2">
                  {agentSubnav.map((sub) => (
                    <Link key={sub.path} href={sub.path} onClick={onNavigate}>
                      <div
                        className={cn(
                          "px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors",
                          location === sub.path
                            ? "text-sidebar-accent-foreground bg-sidebar-accent/50"
                            : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                        )}
                      >
                        {sub.label}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 rounded-full bg-sidebar-accent border border-sidebar-border">
            <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-accent-foreground">
              {config?.org_name?.slice(0, 2).toUpperCase() ?? "OP"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {config?.full_name ?? config?.org_name ?? "TSH Operations"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              void handleSignOut();
            }}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { data: config } = useGetOrgConfig();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="min-h-[100dvh] flex bg-background">
      <aside className="hidden md:flex w-[220px] fixed inset-y-0 left-0 flex-col bg-sidebar border-r border-sidebar-border z-20 text-sidebar-foreground">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "md:hidden fixed inset-y-0 left-0 flex flex-col w-[260px] bg-sidebar border-r border-sidebar-border z-40 text-sidebar-foreground transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          className="absolute top-3 right-3 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <main className="flex-1 md:ml-[220px] flex flex-col overflow-hidden min-h-screen">
        <div className="md:hidden flex items-center gap-3 h-12 px-4 border-b bg-background/95 backdrop-blur sticky top-0 z-10 shrink-0">
          <button
            className="p-1.5 -ml-1 rounded-md text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">{config?.org_name ?? "TSH"} Marketing OS</span>
        </div>

        {children}
      </main>
    </div>
  );
}
