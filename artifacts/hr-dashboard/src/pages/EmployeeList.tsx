import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useFilters } from "@/contexts/FilterContext";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { useGetEmployees, useSaveEmployeeComment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search, Loader2, MessageSquareText, Download, Check, Pencil, X,
  ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function LagBadge({ days }: { days: number }) {
  if (days === 0) return <Badge variant="success" className="font-mono tabular-nums">{days}</Badge>;
  if (days <= 2) return <Badge variant="warning" className="font-mono tabular-nums">{days}</Badge>;
  return <Badge variant="destructive" className="font-mono tabular-nums">{days}</Badge>;
}

function InlineCommentCell({
  empId, initialComment, dateFrom, dateTo,
}: {
  empId: number;
  initialComment: string | null;
  dateFrom: string;
  dateTo: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialComment ?? "");
  const { mutate: saveComment, isPending } = useSaveEmployeeComment();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleSave = () => {
    saveComment({ empId, data: { comment: value } }, {
      onSuccess: () => {
        setEditing(false);
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        toast({ title: "Comment saved" });
      },
      onError: () => {
        toast({ title: "Failed to save comment", variant: "destructive" });
      },
    });
  };

  const handleCancel = () => {
    setValue(initialComment ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[200px]">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 text-xs py-1 px-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-400" onClick={handleSave} disabled={isPending}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={handleCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group/comment max-w-[200px]">
      {value ? (
        <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
          <MessageSquareText className="h-3 w-3 shrink-0 text-primary" />
          {value}
        </span>
      ) : (
        <span className="italic text-xs text-muted-foreground/40">—</span>
      )}
      <button
        onClick={handleEdit}
        className="ml-1 opacity-0 group-hover/comment:opacity-100 transition-opacity"
        title="Edit comment"
      >
        <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}

const getInitials = (f: string, l: string) => `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();

interface PmEntry { pmComment: string | null; pmCommentCount: number; pmCommentRecent: Array<{ comment: string; date: string }> }

function PmCommentCell({ emp }: { emp: PmEntry }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!emp.pmComment) return <span className="italic text-xs text-muted-foreground/40">—</span>;
  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-start gap-1 max-w-[200px] text-left group/pm"
        onClick={() => setOpen((o) => !o)}
        title="Click to expand PM comments"
      >
        <MessageSquareText className="h-3 w-3 shrink-0 text-amber-400 mt-0.5" />
        <span className="truncate text-xs text-muted-foreground group-hover/pm:text-foreground transition-colors">{emp.pmComment}</span>
        {emp.pmCommentCount > 1 && (
          <span className="shrink-0 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5 leading-none">
            +{emp.pmCommentCount - 1}
          </span>
        )}
      </button>
      {open && emp.pmCommentRecent.length > 0 && (
        <div className="absolute z-50 top-6 left-0 w-72 bg-card border border-border/60 rounded-lg shadow-xl p-3 space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">PM Comments ({emp.pmCommentCount})</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          {emp.pmCommentRecent.map((c, i) => (
            <div key={i} className={`text-xs ${i > 0 ? "pt-2 border-t border-border/40" : ""}`}>
              <p className="text-foreground/90 leading-relaxed">{c.comment}</p>
              <p className="text-muted-foreground mt-0.5">{c.date}</p>
            </div>
          ))}
          {emp.pmCommentCount > 3 && (
            <p className="text-xs text-muted-foreground/60 italic border-t border-border/40 pt-2">
              + {emp.pmCommentCount - 3} more — open employee report to see all
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type SortKey = "lagDays" | "totalLeaves" | "finalTotal" | "earnedLeaves" | "sickLeaves";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40 inline-block" />;
  return dir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1 text-primary inline-block" />
    : <ChevronDown className="h-3 w-3 ml-1 text-primary inline-block" />;
}

export default function EmployeeList() {
  const { dateFrom, dateTo, setDateRange, setPeriod } = useFilters();
  const dateRangeValue: DateRange | undefined = {
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(dateTo) : undefined,
  };

  const handleCustomDateChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setPeriod("custom" as any);
      setDateRange(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"));
    }
  };

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lagFilter, setLagFilter] = useState<"all" | "has_lag" | "on_track">("all");
  const [leaveFilter, setLeaveFilter] = useState<"all" | "took_leave" | "took_earned" | "took_sick" | "negative_balance">("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const PAGE_SIZE = 50;

  const { data, isLoading } = useGetEmployees({
    search: search || undefined,
    dateFrom,
    dateTo,
    page,
    limit: PAGE_SIZE,
    lagFilter: lagFilter === "all" ? undefined : lagFilter,
    leaveFilter: leaveFilter === "all" ? undefined : leaveFilter,
  } as any);

  const handleExportCsv = () => {
    const params = new URLSearchParams({ dateFrom, dateTo });
    window.open(`/api/employees/export?${params.toString()}`, "_blank");
  };

  const sortedEmployees = (() => {
    const list = data?.employees ?? [];
    if (!sortKey) return list;
    return [...list].sort((a, b) => {
      const aVal = sortKey === "finalTotal" ? ((a as any).finalTotal ?? a.totalLeaves) : (a as any)[sortKey] ?? 0;
      const bVal = sortKey === "finalTotal" ? ((b as any).finalTotal ?? b.totalLeaves) : (b as any)[sortKey] ?? 0;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  })();

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1400px] animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-end justify-between mb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Employee List</h2>
          <p className="text-muted-foreground mt-1">HR Leave &amp; Productivity Monitoring</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DatePickerWithRange
            value={dateRangeValue}
            onChange={handleCustomDateChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="flex items-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search bar + filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or employee ID..."
            className="pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
          {(["all", "has_lag", "on_track"] as const).map((val) => {
            const labels: Record<string, string> = { all: "All", has_lag: "Lagging", on_track: "On Track" };
            const isActive = lagFilter === val;
            const accentClass =
              val === "has_lag"
                ? isActive ? "bg-destructive text-destructive-foreground" : "text-destructive/70 hover:text-destructive"
                : val === "on_track"
                ? isActive ? "bg-emerald-600 text-white" : "text-emerald-500/80 hover:text-emerald-500"
                : isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground";
            return (
              <button key={val} onClick={() => { setLagFilter(val); setPage(1); }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${accentClass}`}>
                {labels[val]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
          {(["all", "took_earned", "took_sick", "took_leave", "negative_balance"] as const).map((val) => {
            const labels: Record<string, string> = {
              all: "All Leaves",
              took_earned: "Earned",
              took_sick: "Sick",
              took_leave: "Any Leave",
              negative_balance: "Negative Balance",
            };
            const isActive = leaveFilter === val;
            const accentClass =
              val === "negative_balance"
                ? isActive ? "bg-rose-600 text-white" : "text-rose-400/80 hover:text-rose-400"
                : isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground";
            return (
              <button key={val} onClick={() => { setLeaveFilter(val); setPage(1); }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${accentClass}`}>
                {labels[val]}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden border-border/40">
        <div className="bg-muted/20 px-6 py-3 border-b border-border/40 flex justify-between items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            Showing {data?.employees.length ?? 0} of {data?.total ?? 0} employees
          </span>
          {/* Pagination — top right corner */}
          {(data?.total ?? 0) > 0 && (() => {
            const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
            const pageWindow = 2;
            const startPage = Math.max(1, page - pageWindow);
            const endPage = Math.min(totalPages, page + pageWindow);
            const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
            return (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {startPage > 1 && (
                  <>
                    <button
                      onClick={() => setPage(1)}
                      className="h-7 w-7 rounded text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >1</button>
                    {startPage > 2 && <span className="text-muted-foreground text-xs px-0.5">…</span>}
                  </>
                )}
                {pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {endPage < totalPages && (
                  <>
                    {endPage < totalPages - 1 && <span className="text-muted-foreground text-xs px-0.5">…</span>}
                    <button
                      onClick={() => setPage(totalPages)}
                      className="h-7 w-7 rounded text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >{totalPages}</button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })()}
        </div>

        {isLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[220px]">EMPLOYEE</TableHead>
                  <TableHead className="whitespace-nowrap">EMP ID</TableHead>
                  <TableHead>TEAM</TableHead>
                  <TableHead>GRADE</TableHead>
                  <TableHead
                    className="text-center whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("earnedLeaves")}
                  >
                    EL TAKEN<SortIcon active={sortKey === "earnedLeaves"} dir={sortDir} />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap text-rose-400">EL DEFICIT</TableHead>
                  <TableHead
                    className="text-center whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("sickLeaves")}
                  >
                    SL TAKEN<SortIcon active={sortKey === "sickLeaves"} dir={sortDir} />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap text-rose-400">SL DEFICIT</TableHead>
                  <TableHead className="text-center whitespace-nowrap">OTHER L.</TableHead>
                  <TableHead
                    className="text-center whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("totalLeaves")}
                  >
                    TOTAL L.<SortIcon active={sortKey === "totalLeaves"} dir={sortDir} />
                  </TableHead>
                  <TableHead
                    className="text-center whitespace-nowrap font-bold cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("finalTotal")}
                  >
                    FINAL TOTAL<SortIcon active={sortKey === "finalTotal"} dir={sortDir} />
                  </TableHead>
                  <TableHead
                    className="text-center whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                    onClick={() => handleSort("lagDays")}
                  >
                    LAG DAYS<SortIcon active={sortKey === "lagDays"} dir={sortDir} />
                  </TableHead>
                  <TableHead className="min-w-[160px]">HR COMMENT</TableHead>
                  <TableHead className="min-w-[160px]">PM COMMENT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEmployees.map((emp) => (
                  <TableRow key={emp.empId} className="group">
                    <TableCell>
                      <Link href={`/employees/${emp.empId}`} className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-bold text-secondary-foreground group-hover:ring-2 ring-primary/20 transition-all shrink-0">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors text-sm leading-tight">
                            {emp.firstName} {emp.lastName}
                          </div>
                          {(emp as any).leftOn && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-medium text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded px-1.5 py-0.5">
                                Left {(emp as any).leftOn}
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{emp.doodleId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background text-xs max-w-[120px] truncate">{emp.team}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{emp.grade || "—"}</TableCell>
                    <TableCell className="text-center text-sm">{emp.earnedLeaves || "—"}</TableCell>
                    <TableCell className="text-center text-sm">
                      {(emp as any).elDeficit > 0
                        ? <span className="font-semibold text-rose-400">-{(emp as any).elDeficit}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm">{emp.sickLeaves || "—"}</TableCell>
                    <TableCell className="text-center text-sm">
                      {(emp as any).slDeficit > 0
                        ? <span className="font-semibold text-rose-400">-{(emp as any).slDeficit}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm">{(emp as any).otherLeaves || "—"}</TableCell>
                    <TableCell className="text-center text-sm">{emp.totalLeaves || "—"}</TableCell>
                    <TableCell className="text-center text-sm font-bold">
                      {(() => {
                        const ft = (emp as any).finalTotal ?? emp.totalLeaves;
                        return ft < 0
                          ? <span className="text-rose-400">{ft}</span>
                          : <span className="text-foreground">{ft}</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
                      <LagBadge days={emp.lagDays} />
                    </TableCell>
                    <TableCell>
                      <InlineCommentCell
                        empId={emp.empId}
                        initialComment={emp.hrComment ?? null}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                      />
                    </TableCell>
                    <TableCell>
                      <PmCommentCell emp={emp as any} />
                    </TableCell>
                  </TableRow>
                ))}

                {data?.employees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12 text-muted-foreground">
                      No employees found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Bottom quick-nav — only shows when there are multiple pages */}
        {(data?.total ?? 0) > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border/40">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Page {page} of {Math.ceil((data?.total ?? 0) / PAGE_SIZE)}
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil((data?.total ?? 0) / PAGE_SIZE)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
