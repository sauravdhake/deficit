import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { FilterProvider } from "@/contexts/FilterContext";
import { Header } from "@/components/layout/Header";
import Dashboard from "@/pages/Dashboard";
import EmployeeList from "@/pages/EmployeeList";
import EmployeeReport from "@/pages/EmployeeReport";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function NotFound() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center px-4">
      <h2 className="text-4xl font-bold text-foreground">404</h2>
      <p className="mt-2 text-muted-foreground">Page not found.</p>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/employees/:empId" component={EmployeeReport} />
      <Route path="/employees" component={EmployeeList} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FilterProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              <Router />
            </main>
          </div>
        </WouterRouter>
        <Toaster />
      </FilterProvider>
    </QueryClientProvider>
  );
}

export default App;
