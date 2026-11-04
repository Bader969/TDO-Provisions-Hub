import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowUpDown,
  Download,
  Search,
  Trash2,
  RefreshCw,
  FileSearch,
  Plus,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  PROVIDER_EXTRA_COLUMNS,
  ProviderId,
  providerById,
} from "@/lib/providers";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReconciliationDialog } from "./ReconciliationDialog";
import { exportMultiSheetAbrechnung } from "@/lib/abrechnung-export";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  booked: "bg-green-500/10 text-green-700 dark:text-green-300",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-300",
  review: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  booked: "Gebucht",
  cancelled: "Storniert",
  review: "Prüfung",
};

export function RecordsTable({ provider }: { provider: ProviderId }) {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [vbFilter, setVbFilter] = useState("__all__");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "record_date", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newTariff, setNewTariff] = useState("");
  const [newTippgeber, setNewTippgeber] = useState("");
  const [newProvision, setNewProvision] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  const meta = providerById(provider);
  const extraCols = PROVIDER_EXTRA_COLUMNS[provider] ?? [];

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("provider", provider)
      .order("record_date", { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`records-${provider}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "records", filter: `provider=eq.${provider}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row: any = payload.new;
            setRows((prev) => [row, ...prev]);
            setHighlightedIds((prev) => new Set(prev).add(row.id));
            setTimeout(() => {
              setHighlightedIds((prev) => {
                const n = new Set(prev);
                n.delete(row.id);
                return n;
              });
            }, 3000);
          } else if (payload.eventType === "UPDATE") {
            setRows((prev) =>
              prev.map((r) => (r.id === (payload.new as any).id ? payload.new : r))
            );
          } else if (payload.eventType === "DELETE") {
            setRows((prev) => prev.filter((r) => r.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const vbList = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.tippgeber?.trim()) s.add(r.tippgeber.trim());
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const displayedRows = useMemo(() => {
    if (vbFilter === "__all__") return rows;
    return rows.filter(
      (r) => (r.tippgeber || "").trim().toLowerCase() === vbFilter.toLowerCase()
    );
  }, [rows, vbFilter]);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("records")
      .update({ status: newStatus as any })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      toast.success(`Status auf "${STATUS_LABELS[newStatus] || newStatus}" geändert`);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const prov = newProvision ? parseFloat(newProvision.replace(",", ".")) : null;
    const { error } = await supabase.from("records").insert({
      provider,
      status: "open",
      customer_name: newCustomer.trim() || null,
      tariff: newTariff.trim() || null,
      tippgeber: newTippgeber.trim() || null,
      provision: Number.isFinite(prov as number) ? prov : null,
      record_date: newDate || new Date().toISOString().slice(0, 10),
      data: {},
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Auftrag gespeichert");
      setAddOpen(false);
      setNewCustomer("");
      setNewTariff("");
      setNewProvision("");
      fetchData();
    }
  };

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "record_date",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Datum <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? format(new Date(v), "dd.MM.yyyy") : "—";
        },
      },
      {
        accessorKey: "customer_name",
        header: "Kunde",
        cell: ({ getValue }) => (
          <span className="font-medium">{(getValue() as string) ?? "—"}</span>
        ),
      },
      {
        accessorKey: "tariff",
        header: "Tarif / Produkt",
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        accessorKey: "tippgeber",
        header: "Tippgeber (VB)",
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      ...extraCols.map<ColumnDef<any>>((col) => ({
        id: col.key,
        header: col.label,
        accessorFn: (row: any) => row.data?.[col.key] ?? "",
        cell: ({ getValue }) => (getValue() as string) || "—",
      })),
      {
        accessorKey: "provision",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Provision <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return v != null
            ? new Intl.NumberFormat("de-DE", {
                style: "currency",
                currency: "EUR",
              }).format(v)
            : "—";
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row, getValue }) => {
          const s = (getValue() as string) || "open";
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="focus:outline-none">
                  <Badge
                    variant="secondary"
                    className={`cursor-pointer ${STATUS_COLORS[s] ?? ""}`}
                  >
                    {STATUS_LABELS[s] ?? s}
                  </Badge>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["open", "booked", "review", "cancelled"] as const).map((st) => (
                  <DropdownMenuItem
                    key={st}
                    onClick={() => updateStatus(row.original.id, st)}
                  >
                    {STATUS_LABELS[st]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraCols]
  );

  const table = useReactTable({
    data: displayedRows,
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    initialState: { pagination: { pageSize: 25 } },
  });

  const exportRows = (asXlsx: boolean) => {
    const selected = table.getSelectedRowModel().rows;
    const source = selected.length
      ? selected.map((r) => r.original)
      : table.getFilteredRowModel().rows.map((r) => r.original);

    if (!source.length) {
      toast.error("Keine Datensätze zum Exportieren");
      return;
    }

    const flat = source.map((r: any) => {
      const base: any = {
        Datum: r.record_date,
        Kunde: r.customer_name,
        Tarif: r.tariff,
        Tippgeber: r.tippgeber,
        Provision: r.provision,
        Status: r.status,
        Notiz: r.notes,
      };
      extraCols.forEach((c) => {
        base[c.label] = r.data?.[c.key] ?? "";
      });
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, meta?.label ?? provider);
    const filename = `${meta?.label ?? provider}_${format(new Date(), "yyyy-MM-dd")}.${
      asXlsx ? "xlsx" : "csv"
    }`;
    if (asXlsx) XLSX.writeFile(wb, filename);
    else XLSX.writeFile(wb, filename, { bookType: "csv" });
    toast.success(`${source.length} Datensätze exportiert`);
  };

  const deleteSelected = async () => {
    const ids = table.getSelectedRowModel().rows.map((r: any) => r.original.id);
    if (!ids.length) return;
    if (!confirm(`${ids.length} Datensätze löschen?`)) return;
    const { error } = await supabase.from("records").delete().in("id", ids);
    if (error) toast.error(error.message);
    else {
      toast.success("Gelöscht");
      setRowSelection({});
      fetchData();
    }
  };

  const total = rows.reduce((sum, r) => sum + (Number(r.provision) || 0), 0);
  const filteredTotal = table
    .getFilteredRowModel()
    .rows.reduce((sum, r: any) => sum + (Number(r.original.provision) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: meta?.color }}
          />
          <h1 className="text-2xl font-bold">{meta?.label}</h1>
          <Badge variant="outline">{displayedRows.length} Datensätze</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Auftrag anlegen
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReconcileOpen(true)}>
            <FileSearch className="mr-1.5 h-4 w-4" /> Listen vergleichen
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Aktualisieren
          </Button>
          {isAdmin && Object.keys(rowSelection).length > 0 && (
            <Button variant="destructive" size="sm" onClick={deleteSelected}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Download className="mr-1.5 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportRows(true)}>
                Excel (.xlsx) – {meta?.label}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportRows(false)}>
                CSV – {meta?.label}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  exportMultiSheetAbrechnung(displayedRows, {
                    vbName: vbFilter === "__all__" ? meta?.label : vbFilter,
                  })
                }
              >
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                12-Blatt Abrechnung (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Gesamt" value={formatEur(total)} />
        <StatCard label="Gefiltert" value={formatEur(filteredTotal)} />
        <StatCard
          label="Offen"
          value={String(displayedRows.filter((r) => r.status === "open").length)}
        />
        <StatCard
          label="Gebucht"
          value={String(displayedRows.filter((r) => r.status === "booked").length)}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche nach Kunde, Tarif, Auftragsnummer, Zählernummer…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={vbFilter} onValueChange={setVbFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tippgeber (VB) filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Tippgeber ({rows.length})</SelectItem>
            {vbList.map((vb) => (
              <SelectItem key={vb} value={vb}>
                {vb}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Lade…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Noch keine Datensätze für diesen Filter. Sobald WhatsApp-Nachrichten eintreffen oder Listen importiert werden, erscheinen sie hier in Echtzeit.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={
                    highlightedIds.has((row.original as any).id)
                      ? "animate-pulse bg-primary/5"
                      : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Seite {table.getState().pagination.pageIndex + 1} von{" "}
          {table.getPageCount() || 1}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Zurück
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Weiter
          </Button>
        </div>
      </div>

      <ReconciliationDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        hubRecords={rows}
        defaultProvider={provider}
        onRecordsChanged={fetchData}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Auftrag für {meta?.label} anlegen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRecord} className="space-y-3">
            <div className="space-y-1">
              <Label>Kundenname</Label>
              <Input
                required
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="z.B. Max Mustermann"
              />
            </div>
            <div className="space-y-1">
              <Label>Tarif / Produkt</Label>
              <Input
                value={newTariff}
                onChange={(e) => setNewTariff(e.target.value)}
                placeholder="z.B. DSL 100 / SimplyGreen 24"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tippgeber (VB)</Label>
                <Input
                  value={newTippgeber}
                  onChange={(e) => setNewTippgeber(e.target.value)}
                  placeholder="z.B. Ghaith Abojamil"
                />
              </div>
              <div className="space-y-1">
                <Label>Provision (€)</Label>
                <Input
                  value={newProvision}
                  onChange={(e) => setNewProvision(e.target.value)}
                  placeholder="z.B. 110"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Auftragsdatum</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit">Speichern</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
