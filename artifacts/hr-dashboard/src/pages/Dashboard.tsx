import { useState } from "react";
import { useFilters } from "@/contexts/FilterContext";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserCheck, Briefcase, TrendingDown, Clock, Activity, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { 
  useGetResourceCounts, 
  useGetLeaveAnalytics, 
  useGetProductivity, 
  useGetProductivityTrend,
  useGetLaggingResources
} from "@workspace/api-client-react";

export default function Dashboard() {
  const { dateFrom, dateTo, period, applyPreset } = useFilters();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Data Fetching
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["dashboard-summary", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json() as Promise<{ totalEmployees: number; fullTimeCount: number; dtnCount: number }>;
    },
  });
  const { data: resourceCounts, isLoading: loadingCounts } = useGetResourceCounts({ dateFrom, dateTo });
  const { data: leaveAnalytics, isLoading: loadingLeaves } = useGetLeaveAnalytics({ dateFrom, dateTo });
  const { data: productivity, isLoading: loadingProd } = useGetProductivity({ dateFrom, dateTo });
  const { data: trend, isLoading: loadingTrend } = useGetProductivityTrend({ dateFrom, dateTo, period });
  const { data: lagging, isLoading: loadingLagging } = useGetLaggingResources({ dateFrom, dateTo });

  const donutData = productivity ? [
    { name: "Achieved", value: productivity.productivityPercent, color: "hsl(var(--primary))" },
    { name: "Gap", value: Math.max(0, 100 - productivity.productivityPercent), color: "hsl(var(--muted))" }
  ] : [];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl animate-in fade-in duration-500">
      
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Overview</h2>
          <p className="text-muted-foreground mt-1">Key metrics across all teams and projects.</p>
        </div>
        <DateRangeFilter />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Employees" 
          value={summary?.totalEmployees} 
          icon={<Users className="h-5 w-5 text-primary" />} 
          loading={loadingSummary} 
        />
        <StatCard 
          title="Full Time (FT)" 
          value={summary?.fullTimeCount} 
          icon={<UserCheck className="h-5 w-5 text-emerald-400" />} 
          loading={loadingSummary} 
        />
        <StatCard 
          title="DTN Resources" 
          value={summary?.dtnCount} 
          icon={<Briefcase className="h-5 w-5 text-amber-400" />} 
          loading={loadingSummary} 
        />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Resource Count by Project Type
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {loadingCounts ? <LoadingState /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">FT</TableHead>
                    <TableHead className="text-right">DTN</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resourceCounts?.rows.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium text-foreground">{row.category}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.ftCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.dtnCount}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{row.total}</TableCell>
                    </TableRow>
                  ))}
                  {(!resourceCounts?.rows || resourceCounts.rows.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No data available</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" /> Employee Leave Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {loadingLeaves ? <LoadingState /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">FT Leaves</TableHead>
                    <TableHead className="text-right">DTN Leaves</TableHead>
                    <TableHead className="text-right font-bold text-foreground">Total Leaves</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveAnalytics?.rows.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium text-foreground">{row.category}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.ftLeaves}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.dtnLeaves}</TableCell>
                      <TableCell className="text-right font-bold text-amber-400">{row.totalLeaves}</TableCell>
                    </TableRow>
                  ))}
                  {(!leaveAnalytics?.rows || leaveAnalytics.rows.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No data available</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics & Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Productivity Donut */}
        <Card className="flex flex-col border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Resource Productivity
            </CardTitle>
            <CardDescription>Based on allocated vs achieved hours</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center min-h-[200px] relative">
            {loadingProd ? <LoadingState /> : (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-4">
                  <span className="text-4xl font-display font-bold text-foreground">
                    {productivity?.productivityPercent?.toFixed(0) ?? 0}%
                  </span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Productivity</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Trend Line */}
        <Card className="flex flex-col md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-emerald-400" /> Weekly Productivity Trend
              </CardTitle>
            </div>
            {/* Quick Filters inside chart card for cleaner look */}
            <div className="flex bg-muted/50 p-1 rounded-xl">
              <Button 
                variant={period === "week" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 rounded-lg text-xs"
                onClick={() => applyPreset("lastWeek")}
              >
                Last Week
              </Button>
              <Button 
                variant={period === "month" ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 rounded-lg text-xs"
                onClick={() => applyPreset("thisMonth")}
              >
                Monthly
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[200px]">
             {loadingTrend ? <LoadingState /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend?.dataPoints || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 100]}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="productivityPercent" 
                    name="Productivity %"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lagging Resources */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-display font-bold text-foreground">Productivity Lags</h3>
        <p className="text-sm text-muted-foreground">Identify resources with productivity below threshold.</p>
        
        {loadingLagging ? <LoadingState /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {lagging?.categories.map((cat) => (
              <Dialog key={cat.category}>
                <Card className="group border-border/40 hover:border-orange-500/30 transition-all">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{cat.category}</p>
                      <p className="text-2xl font-bold mt-1 text-foreground">{cat.count} Resources</p>
                    </div>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="border-orange-500/20 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 gap-2"
                      >
                        {cat.employees.length} Lagging <ArrowRight className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                  </CardContent>
                </Card>

                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{cat.category} - Lagging Resources</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-y-auto pr-2 mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">Lag (Days)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cat.employees.map((emp) => (
                          <TableRow key={emp.empId}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell className="text-muted-foreground">{emp.doodleId}</TableCell>
                            <TableCell><Badge variant="outline">{emp.team}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Badge variant={emp.lagDays >= 5 ? "destructive" : emp.lagDays >= 2 ? "warning" : "success"}>
                                {emp.lagDays}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {cat.employees.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No lagging resources found for this category.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function StatCard({ title, value, icon, loading }: { title: string, value?: number, icon: React.ReactNode, loading: boolean }) {
  return (
    <Card className="relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-6 flex items-center justify-between relative z-10">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <h3 className="text-4xl font-display font-bold text-foreground tracking-tight">
                {value ?? 0}
              </h3>
            )}
          </div>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-card border border-border/50 flex items-center justify-center shadow-inner">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center text-muted-foreground/50">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

// Simple internal skeleton component
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

import { ArrowRight } from "lucide-react";
