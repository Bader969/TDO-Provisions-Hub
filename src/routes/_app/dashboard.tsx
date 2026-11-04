import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PROVIDERS } from "@/lib/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  FileSpreadsheet,
  FileSearch,
  RefreshCw,
  MessageSquare,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
} from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AbrechnungRecord } from "@/lib/abrechnung-export";
import { AbrechnungExportDialog } from "@/components/AbrechnungExportDialog";
import { ReconciliationDialog } from "@/components/ReconciliationDialog";
import { TDO_GROUP_CHAT_ID } from "@/lib/whatsapp-parser";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type Stat = { id: string; provider: string; path: string; color: string; current: number; count: number };

type RangeKey =
  | "this_month"
  | "last_month"
  | "last_3"
  | "last_6"
  | "last_12"
  | "this_year"
  | "all"
  | "custom";

function Dashboard() {
  const [rows, setRows] = useState<AbrechnungRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingWa, setSyncingWa] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [selectedVb, setSelectedVb] = useState<string>("__all__");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());
  const [exportOpen, setExportOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("records")
      .select("*")
      .order("record_date", { ascending: false });
    setRows((data ?? []) as AbrechnungRecord[]);
    setLoading(false);
  }, []);

  const syncWhatsAppGroup = useCallback(
    async (silent = false) => {
      if (!silent) setSyncingWa(true);
      try {
        const res = await fetch("/api/public/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", chatId: TDO_GROUP_CHAT_ID }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.newlySynced > 0) {
            toast.success(
              `${data.newlySynced} neue(r) Auftrag/Aufträge aus WhatsApp-Gruppe synchronisiert!`
            );
            await load();
          } else if (!silent) {
            toast.info(
              `WhatsApp-Gruppe (${TDO_GROUP_CHAT_ID}) ist aktuell (${data.scannedMessages ?? 0} Nachrichten geprüft).`
            );
          }
        }
      } catch (e) {
        if (!silent) {
          toast.error("Synchronisation mit OpenWA fehlgeschlagen.");
        }
      } finally {
        if (!silent) setSyncingWa(false);
      }
    },
    [load]
  );

  useEffect(() => {
    load();
    // Silent background sync with OpenWA group on mount
    syncWhatsAppGroup(true);

    const channel = supabase
      .channel("dashboard-records")
      .on("postgres_changes", { event: "*", schema: "public", table: "records" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, syncWhatsAppGroup]);

  const vbList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.tippgeber?.trim()) set.add(r.tippgeber.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const { from, to, label } = useMemo(() => {
    const now = new Date();
    switch (rangeKey) {
      case "this_month":
        return {
          from: startOfMonth(now),
          to: endOfMonth(now),
          label: format(now, "MMMM yyyy", { locale: de }),
        };
      case "last_month": {
        const m = subMonths(now, 1);
        return {
          from: startOfMonth(m),
          to: endOfMonth(m),
          label: format(m, "MMMM yyyy", { locale: de }),
        };
      }
      case "last_3":
        return {
          from: startOfMonth(subMonths(now, 2)),
          to: endOfMonth(now),
          label: "Letzte 3 Monate",
        };
      case "last_6":
        return {
          from: startOfMonth(subMonths(now, 5)),
          to: endOfMonth(now),
          label: "Letzte 6 Monate",
        };
      case "last_12":
        return {
          from: startOfMonth(subMonths(now, 11)),
          to: endOfMonth(now),
          label: "Letzte 12 Monate",
        };
      case "this_year":
        return {
          from: startOfYear(now),
          to: endOfYear(now),
          label: format(now, "yyyy"),
        };
      case "all":
        return { from: null as Date | null, to: null as Date | null, label: "Alle Zeiträume" };
      case "custom":
        return {
          from: customFrom ?? null,
          to: customTo ?? null,
          label:
            customFrom && customTo
              ? `${format(customFrom, "dd.MM.yyyy")} – ${format(customTo, "dd.MM.yyyy")}`
              : "Zeitraum wählen",
        };
    }
  }, [rangeKey, customFrom, customTo]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.status === "cancelled") return false;
      if (
        selectedVb !== "__all__" &&
        (r.tippgeber || "").trim().toLowerCase() !== selectedVb.toLowerCase()
      ) {
        return false;
      }
      const dateStr = r.record_date ?? r.created_at;
      if (dateStr) {
        const date = new Date(dateStr);
        if (from && date < from) return false;
        if (to && date > to) return false;
      }
      return true;
    });
  }, [rows, selectedVb, from, to]);

  const stats = useMemo<Stat[]>(() => {
    const byProv: Record<string, Stat> = {};
    PROVIDERS.forEach((p) => {
      byProv[p.id] = {
        id: p.id,
        provider: p.label,
        path: p.path,
        color: p.color,
        current: 0,
        count: 0,
      };
    });
    filteredRows.forEach((r) => {
      const stat = byProv[r.provider];
      if (!stat) return;
      stat.current = Math.round((stat.current + (Number(r.provision) || 0)) * 100) / 100;
      stat.count += 1;
    });
    return Object.values(byProv);
  }, [filteredRows]);

  const total = Math.round(stats.reduce((s, x) => s + x.current, 0) * 100) / 100;
  const totalCount = stats.reduce((s, x) => s + x.count, 0);
  const activeProvidersCount = stats.filter((s) => s.count > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <Badge variant="outline" className="text-xs font-normal gap-1">
              <MessageSquare className="h-3 w-3 text-emerald-500" />
              WhatsApp Gruppe: {TDO_GROUP_CHAT_ID}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Provisionsübersicht – {label}{" "}
            {selectedVb !== "__all__" ? `• Vermittler: ${selectedVb}` : "• Alle Vermittler"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncWhatsAppGroup(false)}
            disabled={syncingWa}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", syncingWa && "animate-spin")} />
            {syncingWa ? "Synchronisiere..." : "WhatsApp Sync"}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setReconcileOpen(true)}>
            <FileSearch className="mr-1.5 h-4 w-4" />
            Listen vergleichen / Import
          </Button>

          <Button size="sm" onClick={() => setExportOpen(true)}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            12-Blatt Abrechnung (.xlsx)
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedVb} onValueChange={setSelectedVb}>
            <SelectTrigger className="w-[210px] h-9">
              <SelectValue placeholder="Alle Vermittler" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Vermittler ({rows.length})</SelectItem>
              {vbList.map((vb) => (
                <SelectItem key={vb} value={vb}>
                  {vb}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Zeiträume</SelectItem>
            <SelectItem value="this_year">Dieses Jahr</SelectItem>
            <SelectItem value="this_month">Aktueller Monat</SelectItem>
            <SelectItem value="last_month">Letzter Monat</SelectItem>
            <SelectItem value="last_3">Letzte 3 Monate</SelectItem>
            <SelectItem value="last_6">Letzte 6 Monate</SelectItem>
            <SelectItem value="last_12">Letzte 12 Monate</SelectItem>
            <SelectItem value="custom">Eigener Zeitraum</SelectItem>
          </SelectContent>
        </Select>

        {rangeKey === "custom" && (
          <>
            <DatePick date={customFrom} onSelect={setCustomFrom} placeholder="Von" />
            <DatePick date={customTo} onSelect={setCustomTo} placeholder="Bis" />
          </>
        )}
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gesamtprovision ({label})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary tabular-nums">{formatEur(total)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Summe aller aktiven Provisionen
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aufträge gesamt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{totalCount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Erfasste Verträge & Buchungen
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aktive Anbieter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {activeProvidersCount} / {PROVIDERS.length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Anbieter mit Aufträgen im Zeitraum
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All 11 Provider Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {stats.map((s) => (
          <Link
            key={s.id}
            to="/providers/$slug"
            params={{ slug: s.path }}
            className="block transition-transform hover:-translate-y-0.5"
          >
            <Card className="h-full hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{s.provider}</CardTitle>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold tabular-nums">{formatEur(s.current)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.count} Aufträge</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Provision pro Anbieter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Lade…
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="provider" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(v: number) => formatEur(v)}
                  />
                  <Bar dataKey="current" name="Provision" fill="oklch(0.55 0.2 260)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <AbrechnungExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        records={filteredRows}
        initialVb={selectedVb}
      />

      <ReconciliationDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        hubRecords={filteredRows}
        onRecordsChanged={load}
      />
    </div>
  );
}

function DatePick({
  date,
  onSelect,
  placeholder,
}: {
  date: Date | undefined;
  onSelect: (d: Date | undefined) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[150px] h-9 justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd.MM.yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
