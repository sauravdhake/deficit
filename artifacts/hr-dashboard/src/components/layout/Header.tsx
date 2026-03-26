import { Link, useLocation } from "wouter";
import { ArrowRight, Activity, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">
              HR Productivity Dashboard
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Company Resource & Performance Overview</p>
          </div>
        </Link>
        
        <nav className="flex items-center gap-4">
          {location !== "/employees" && (
            <Link href="/employees" className="inline-block">
              <Button variant="secondary" className="gap-2 group">
                <Users className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                Employee List
                <ArrowRight className="h-4 w-4 ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
