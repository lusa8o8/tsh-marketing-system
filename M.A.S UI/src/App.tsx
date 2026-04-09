import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import { getActiveSession, supabase } from "@/lib/supabase";

import Inbox from "@/pages/inbox";
import Content from "@/pages/content";
import Metrics from "@/pages/metrics";
import Ambassadors from "@/pages/ambassadors";
import Calendar from "@/pages/calendar";
import AgentOverview from "@/pages/agent/overview";
import AgentChat from "@/pages/agent/chat";
import AgentSettings from "@/pages/agent/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/">
          <Redirect to="/samm" />
        </Route>
        <Route path="/samm" component={AgentChat} />
        <Route path="/inbox" component={Inbox} />
        <Route path="/content" component={Content} />
        <Route path="/metrics" component={Metrics} />
        <Route path="/ambassadors" component={Ambassadors} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/agent">
          <Redirect to="/operations/overview" />
        </Route>
        <Route path="/agent/overview">
          <Redirect to="/operations/overview" />
        </Route>
        <Route path="/agent/chat">
          <Redirect to="/samm" />
        </Route>
        <Route path="/agent/settings">
          <Redirect to="/operations/settings" />
        </Route>
        <Route path="/operations">
          <Redirect to="/operations/overview" />
        </Route>
        <Route path="/operations/overview" component={AgentOverview} />
        <Route path="/operations/settings" component={AgentSettings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getActiveSession()
      .then((nextSession) => {
        if (!isMounted) return;
        setSession(nextSession ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);

      if (nextSession) {
        void queryClient.invalidateQueries();
      } else {
        queryClient.clear();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card px-6 py-5 text-sm text-muted-foreground shadow-sm">
          Checking session...
        </div>
      </div>
    );
  }

  return session ? <Router /> : <Login />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
