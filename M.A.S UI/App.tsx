import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

// Import pages
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
          <Redirect to="/inbox" />
        </Route>
        <Route path="/inbox" component={Inbox} />
        <Route path="/content" component={Content} />
        <Route path="/metrics" component={Metrics} />
        <Route path="/ambassadors" component={Ambassadors} />
        <Route path="/calendar" component={Calendar} />
        
        <Route path="/agent">
          <Redirect to="/agent/overview" />
        </Route>
        <Route path="/agent/overview" component={AgentOverview} />
        <Route path="/agent/chat" component={AgentChat} />
        <Route path="/agent/settings" component={AgentSettings} />
        
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;