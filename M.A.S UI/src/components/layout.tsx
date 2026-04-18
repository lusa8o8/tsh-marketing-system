import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Sparkles,
  Bell,
  LayoutList,
  BarChart2,
  Users,
  CalendarDays,
  Bot,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useGetInboxSummary, useGetOrgConfig } from "@/lib/api";
import { signOut } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/samm", label: "samm", icon: Sparkles },
  { href: "/inbox", label: "Inbox", icon: Bell },
  { href: "/content", label: "Content", icon: LayoutList },
  { href: "/metrics", label: "Metrics", icon: BarChart2 },
  { href: "/ambassadors", label: "Ambassadors", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/operations", label: "Operations", icon: Bot, isPrefix: true },
];

const operationsSubnav = [
  { path: "/operations/overview", label: "Overview" },
  { path: "/operations/settings", label: "Settings" },
  { path: "/operations/manual", label: "Manual" },
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const [location] = useLocation();
  const { data: summary } = useGetInboxSummary();
  const { data: config } = useGetOrgConfig();
  const isOperationsActive = location.startsWith("/operations");
  const workspaceName = config?.org_name ?? "Workspace";
  const accountLabel = config?.full_name ?? config?.org_name ?? "Operations";
  const moduleSettings = ((config?.platform_connections as Record<string, any> | undefined)?.modules ?? {}) as Record<string, { enabled?: boolean }>;
  const ambassadorsEnabled = moduleSettings.ambassadors?.enabled !== false;
  const visibleNavItems = navItems.filter((item) => item.href !== "/ambassadors" || ambassadorsEnabled);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold lowercase tracking-[0.22em] text-sidebar-foreground/52">samm</p>
          <h1 className="text-base font-semibold leading-tight text-sidebar-foreground">{workspaceName}</h1>
          <p className="text-xs font-medium text-sidebar-foreground/46">coordinated workspace</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleNavItems.map((item) => {
          const isActive = item.isPrefix ? location.startsWith(item.href) : location === item.href;

          return (
            <div key={item.href}>
              <Link href={item.href} onClick={onNavigate}>
                <div
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  {item.href === "/inbox" && summary?.unread ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {summary.unread}
                    </span>
                  ) : null}
                </div>
              </Link>

              {item.href === "/operations" && isOperationsActive && (
                <div className="ml-9 mt-1 space-y-1 border-l border-sidebar-border/50 pl-2">
                  {operationsSubnav.map((sub) => (
                    <Link key={sub.path} href={sub.path} onClick={onNavigate}>
                      <div
                        className={cn(
                          "cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                          location === sub.path
                            ? "bg-sidebar-accent/50 text-sidebar-accent-foreground"
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

      <div className="mt-auto border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 rounded-full border border-sidebar-border bg-sidebar-accent">
            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
              {workspaceName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{accountLabel}</p>
            <p className="text-[11px] text-sidebar-foreground/46">workspace account</p>
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
            <LogOut className="h-4 w-4" />
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
  const workspaceName = config?.org_name ?? "Workspace";

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[220px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          className="absolute right-3 top-3 rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <main className="ml-0 flex min-h-screen flex-1 flex-col overflow-hidden md:ml-[220px]">
        <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <button
            className="-ml-1 rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold lowercase tracking-[0.2em] text-foreground/46">samm</p>
            <p className="truncate text-sm font-medium text-foreground">{workspaceName}</p>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}

