import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useFilters } from "@/contexts/FilterContext";
import { useGetEmployeeReport, useSaveEmployeeComment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Calendar, Sun, TrendingDown, MessageSquare, Loader2, Save, Bot, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

function LagLevel({ lagDays }: { lagDays: number }) {
  if (lagDays === 0) return <Badge variant="success">On Track</Badge>;
  if (lagDays <= 2) return <Badge variant="warning">Moderate Lag</Badge>;
  return <Badge variant="destructive">High Lag</Badge>;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const h = payload[0]?.value ?? 0;
  return (
    <div className="bg-card border border-border/60 rounded-lg p-3 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-foreground">{h}h logged</p>
      {h === 0 && <p className="text-destructive mt-1">No EOD submitted</p>}
    </div>
  );
};

export default function EmployeeReport() {
  const [, params] = useRoute("/employees/:empId");
  const empId = Number(params?.empId);
  const { dateFrom, dateTo } = useFilters();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useGetEmployeeReport(empId, { dateFrom, dateTo });
  const { mutate: saveComment, isPending: isSaving } = useSaveEmployeeComment();
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (report?.hrComment !== undefined) {
      setCommentText(report.hrComment || "");
    }
  }, [report?.hrComment]);

  const handleSaveComment = () => {
    saveComment({ empId, data: { comment: commentText } }, {
      onSuccess: () => {
        toast({ title: "Comment saved", description: "HR comment updated." });
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save comment.", variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold">Employee not found</h2>
        <Link href="/employees"><Button className="mt-4">Back to List</Button></Link>
      </div>
    );
  }

  const initials = `${report.firstName.charAt(0)}${report.lastName.charAt(0)}`.toUpperCase();
  const lagIsHighlight = report.lagDays >= 3;

  const trendData = (report.productivityTrend ?? []).map((p) => ({
    date: p.date.slice(5), // show MM-DD
    hours: p.hoursLogged,
    isLag: p.hoursLogged === 0,
  }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-in fade-in duration-500">
      <Link href="/employees" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6 group">
        <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Employee List
      </Link>

      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-foreground">Employee Report</h2>
        <p className="text-muted-foreground mt-1">
          Leave &amp; Productivity Overview — {dateFrom} to {dateTo}
        </p>
      </div>

      {/* Profile + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="md:col-span-1 bg-gradient-to-b from-card to-card/50">
          <CardContent className="p-6 flex flex-col items-center text-center pt-8">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-primary/20 mb-4 ring-4 ring-background">
              {initials}
            </div>
            <h3 className="text-2xl font-display font-bold text-foreground">
              {report.firstName} {report.lastName}
            </h3>
            <p className="text-sm font-mono text-muted-foreground mt-1">{report.doodleId}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Badge variant="secondary" className="px-3 py-1 text-sm">{report.team}</Badge>
              {report.grade && <Badge variant="outline" className="px-3 py-1 text-sm">{report.grade}</Badge>}
              {report.isDtn && <Badge variant="warning" className="px-3 py-1 text-sm">DTN</Badge>}
            </div>
            {report.category && (
              <p className="text-xs text-muted-foreground mt-3 font-mono bg-muted px-3 py-1 rounded-full">
                {report.category}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <Card className="border-border/40">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">EL Taken</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{report.earnedLeaves}</p>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Calendar className="h-5 w-5" /></div>
              </div>
              {(report as any).elDeficit > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-1.5">
                  <span className="text-xs text-rose-400 font-medium">EL Deficit:</span>
                  <span className="text-sm font-bold text-rose-400">-{(report as any).elDeficit}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">SL Taken</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{report.sickLeaves}</p>
                </div>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><Sun className="h-5 w-5" /></div>
              </div>
              {(report as any).slDeficit > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-500/10 border border-rose-500/20 px-3 py-1.5">
                  <span className="text-xs text-rose-400 font-medium">SL Deficit:</span>
                  <span className="text-sm font-bold text-rose-400">-{(report as any).slDeficit}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-muted/10">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leaves Taken</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{report.totalLeaves}</p>
                  {((report as any).elDeficit > 0 || (report as any).slDeficit > 0) && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Final Total (after deficit)</p>
                      <p className={`text-xl font-bold mt-0.5 ${(report as any).finalTotal < 0 ? "text-rose-400" : "text-foreground"}`}>
                        {(report as any).finalTotal ?? report.totalLeaves}
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Calendar className="h-5 w-5" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className={lagIsHighlight ? "border-destructive/40 bg-destructive/5" : "border-border/40"}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Productivity Lag</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-3xl font-bold text-foreground">{report.lagDays}</p>
                    <span className="text-sm text-muted-foreground">
                      days / {report.expectedDays} working
                    </span>
                  </div>
                  <div className="mt-2">
                    <LagLevel lagDays={report.lagDays} />
                  </div>
                </div>
                <div className={`p-2 rounded-lg ${lagIsHighlight ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Productivity Trend Chart */}
      {trendData.length > 0 && (
        <Card className="mb-6 border-border/40">
          <CardHeader className="bg-muted/20 border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" /> Daily EOD Hours Logged
            </CardTitle>
            <CardDescription>
              Hours submitted per day — {report.daysLogged} of {report.expectedDays} days logged
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="eodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <ReferenceLine y={8} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "8h", position: "right", fontSize: 10, fill: "hsl(var(--primary))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#eodGrad)"
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const isLag = payload.hours === 0;
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={isLag ? 4 : 3}
                        fill={isLag ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                        stroke="hsl(var(--background))"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Red dots indicate no EOD submitted. Reference line = 8h expected.
            </p>
          </CardContent>
        </Card>
      )}

      {/* PM Comments (Read-only) */}
      {(report.pmComments ?? []).length > 0 && (
        <Card className="mb-6 border-amber-500/20">
          <CardHeader className="bg-amber-500/5 border-b border-border/40">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-amber-400" /> PM Comments
            </CardTitle>
            <CardDescription>Feedback added by the Project Manager in D360. Read-only.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {(report.pmComments ?? []).map((c, i) => (
              <div key={i} className="border border-border/40 rounded-lg p-4 bg-muted/10">
                <p className="text-sm text-foreground leading-relaxed">{c.comment}</p>
                <p className="text-xs text-muted-foreground mt-2">{c.date}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* HR Comments */}
      <Card className="border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="bg-muted/20 border-b border-border/40">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> HR Comments &amp; Notes
          </CardTitle>
          <CardDescription>
            Internal notes regarding employee performance and leaves. Not visible to the employee.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {/* Manager comments reference — always visible so HR can read before writing */}
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/20 bg-amber-500/10">
              <Bot className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Manager's Notes (Read-only)</span>
            </div>
            <div className="p-4">
              {(report.pmComments ?? []).length > 0 ? (
                <div className="space-y-3">
                  {(report.pmComments ?? []).map((c, i) => (
                    <div key={i} className={i > 0 ? "pt-3 border-t border-amber-500/15" : ""}>
                      <p className="text-sm text-foreground/90 leading-relaxed">{c.comment}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.date}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">No manager notes added yet.</p>
              )}
            </div>
          </div>

          <div>
            <Textarea
              placeholder="Add comments about this employee..."
              className="min-h-[140px] resize-y bg-background/50 border-border focus-visible:ring-primary/50 text-base p-4"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleSaveComment}
                disabled={isSaving || commentText === (report.hrComment || "")}
                className="gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Saving..." : "Save Comment"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
