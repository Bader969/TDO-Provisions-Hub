import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  FileSearch,
  Download,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PROVIDERS, ProviderId } from "@/lib/providers";
import { AbrechnungRecord } from "@/lib/abrechnung-export";
import {
  ReconciliationSummary,
  exportReconciliationReport,
  parseUploadedExcelOrCsv,
  reconcileRecords,
} from "@/lib/reconciliation";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hubRecords: AbrechnungRecord[];
  defaultProvider?: ProviderId;
  onRecordsChanged?: () => void;
}

export function ReconciliationDialog({
  open,
  onOpenChange,
  hubRecords,
  defaultProvider = "Strom",
  onRecordsChanged,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fallbackProvider, setFallbackProvider] = useState<ProviderId>(defaultProvider);
  const [defaultVb, setDefaultVb] = useState<string>("Ghaith Abojamil");
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { rows, sheetsProcessed } = await parseUploadedExcelOrCsv(
        file,
        fallbackProvider,
        defaultVb
      );
      if (rows.length === 0) {
        toast.error("Keine gültigen Auftragszeilen in der Datei gefunden.");
        setLoading(false);
        return;
      }

      const relevantHub =
        sheetsProcessed.length === 1 && rows.length > 0
          ? hubRecords.filter((h) => h.provider === rows[0].provider)
          : hubRecords;

      const result = reconcileRecords(file.name, rows, relevantHub, sheetsProcessed);
      setSummary(result);
      toast.success(
        `${rows.length} Zeilen aus "${file.name}" erfolgreich mit ${relevantHub.length} Hub-Aufträgen abgeglichen.`
      );
    } catch (err: any) {
      toast.error(`Fehler beim Lesen der Datei: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleImportMissingToHub = async () => {
    if (!summary || summary.missingInHub.length === 0) return;
    setImporting(true);
    try {
      const toInsert = summary.missingInHub
        .map((item) => item.uploaded)
        .filter(Boolean)
        .map((u) => ({
          provider: u!.provider,
          status: "booked" as const,
          customer_name: u!.customer_name,
          tariff: u!.tariff,
          tippgeber: u!.tippgeber || defaultVb || null,
          provision: u!.provision,
          record_date: u!.record_date || new Date().toISOString().slice(0, 10),
          notes: u!.extra?.buchungsgrund || `Import aus ${summary.fileName}`,
          data: u!.extra || {},
        }));

      const { error } = await supabase.from("records").insert(toInsert);
      if (error) throw error;

      toast.success(`${toInsert.length} fehlende Aufträge wurden in den Hub importiert!`);
      onRecordsChanged?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Import fehlgeschlagen: ${err?.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleApplyProvisionUpdates = async () => {
    if (!summary || summary.diffMatches.length === 0) return;
    setImporting(true);
    try {
      let updated = 0;
      for (const item of summary.diffMatches) {
        if (!item.hubRecord || !item.uploaded) continue;
        if (Math.abs(item.provisionDiff) >= 0.01) {
          const { error } = await supabase
            .from("records")
            .update({
              provision: item.uploaded.provision,
              status: "booked",
            })
            .eq("id", item.hubRecord.id);
          if (!error) updated++;
        }
      }
      toast.success(`${updated} Provisionen im Hub auf den Wert der Excel-Liste aktualisiert!`);
      onRecordsChanged?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Aktualisierung fehlgeschlagen: ${err?.message || String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            Listen-Vergleich & Excel/CSV-Import (Reconciliation)
          </DialogTitle>
          <DialogDescription>
            Lade eine Abrechnungsliste (Einzel-Blatt oder 12-Blatt-Gesamtabrechnung wie{" "}
            <code>Beispielliste.xlsx</code>) hoch, um Aufträge, Kundennamen und Provisionen
            automatisch mit dem Hub abzugleichen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Standard-Anbieter (falls 1-Blatt-Datei)</Label>
              <Select
                value={fallbackProvider}
                onValueChange={(v) => setFallbackProvider(v as ProviderId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Standard-Tippgeber (falls Spalte leer)</Label>
              <Input
                value={defaultVb}
                onChange={(e) => setDefaultVb(e.target.value)}
                placeholder="z.B. Ghaith Abojamil"
              />
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {loading ? "Analysiere Datei..." : "Excel / CSV hochladen"}
              </Button>
            </div>
          </div>

          {summary && (
            <div className="space-y-4">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    <span>Exakt identisch</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">
                    {summary.exactMatches.length}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Kunde & Provision stimmen
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 font-medium">
                    <span>Abweichungen</span>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">
                    {summary.diffMatches.length}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Provision oder Schreibweise
                  </div>
                </div>

                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                  <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-medium">
                    <span>Fehlt im Hub</span>
                    <PlusCircle className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">
                    {summary.missingInHub.length}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Nur in hochgeladener Datei
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <span>Summe Datei vs. Hub</span>
                  </div>
                  <div className="text-sm font-bold mt-1 tabular-nums">
                    {summary.uploadedProvisionSum.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    Hub:{" "}
                    {summary.hubProvisionSum.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </div>
                </div>
              </div>

              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="all">
                    Exakt ({summary.exactMatches.length})
                  </TabsTrigger>
                  <TabsTrigger value="diff">
                    Abweichungen ({summary.diffMatches.length})
                  </TabsTrigger>
                  <TabsTrigger value="missing_hub">
                    Fehlt im Hub ({summary.missingInHub.length})
                  </TabsTrigger>
                  <TabsTrigger value="missing_list">
                    Fehlt in Liste ({summary.missingInList.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-3">
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr className="text-left border-b border-border">
                          <th className="p-2">Anbieter</th>
                          <th className="p-2">Kunde</th>
                          <th className="p-2">Tarif / Produkt</th>
                          <th className="p-2">Tippgeber</th>
                          <th className="p-2 text-right">Provision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {summary.exactMatches.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-muted-foreground">
                              Keine exakten Übereinstimmungen in dieser Ansicht.
                            </td>
                          </tr>
                        ) : (
                          summary.exactMatches.map((m) => (
                            <tr key={m.id}>
                              <td className="p-2 font-medium">{m.uploaded?.provider}</td>
                              <td className="p-2">{m.uploaded?.customer_name}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[200px]">
                                {m.uploaded?.tariff}
                              </td>
                              <td className="p-2">{m.uploaded?.tippgeber}</td>
                              <td className="p-2 text-right font-medium tabular-nums">
                                {(m.uploaded?.provision ?? 0).toLocaleString("de-DE", {
                                  style: "currency",
                                  currency: "EUR",
                                })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="diff" className="mt-3 space-y-2">
                  {summary.diffMatches.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleApplyProvisionUpdates}
                        disabled={importing}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Alle Provisionen aus Excel-Liste übernehmen
                      </Button>
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr className="text-left border-b border-border">
                          <th className="p-2">Anbieter</th>
                          <th className="p-2">Kunde (Liste / Hub)</th>
                          <th className="p-2">Abweichung</th>
                          <th className="p-2 text-right">Liste €</th>
                          <th className="p-2 text-right">Hub €</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {summary.diffMatches.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-muted-foreground">
                              Keine Abweichungen gefunden.
                            </td>
                          </tr>
                        ) : (
                          summary.diffMatches.map((m) => (
                            <tr key={m.id}>
                              <td className="p-2 font-medium">{m.uploaded?.provider}</td>
                              <td className="p-2">
                                <div>{m.uploaded?.customer_name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  Hub: {m.hubRecord?.customer_name}
                                </div>
                              </td>
                              <td className="p-2 text-amber-600 dark:text-amber-400">
                                {m.differences.join(" • ")}
                              </td>
                              <td className="p-2 text-right font-semibold tabular-nums">
                                {(m.uploaded?.provision ?? 0).toFixed(2)} €
                              </td>
                              <td className="p-2 text-right text-muted-foreground tabular-nums">
                                {Number(m.hubRecord?.provision ?? 0).toFixed(2)} €
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="missing_hub" className="mt-3 space-y-2">
                  {summary.missingInHub.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleImportMissingToHub}
                        disabled={importing}
                      >
                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                        {importing
                          ? "Importiere..."
                          : `Alle ${summary.missingInHub.length} fehlenden Aufträge in Hub importieren`}
                      </Button>
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr className="text-left border-b border-border">
                          <th className="p-2">Blatt / Anbieter</th>
                          <th className="p-2">Datum</th>
                          <th className="p-2">Kunde</th>
                          <th className="p-2">Tarif</th>
                          <th className="p-2">Tippgeber</th>
                          <th className="p-2 text-right">Provision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {summary.missingInHub.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-muted-foreground">
                              Alle Zeilen aus der Datei sind bereits im Hub vorhanden!
                            </td>
                          </tr>
                        ) : (
                          summary.missingInHub.map((m) => (
                            <tr key={m.id}>
                              <td className="p-2">
                                <Badge variant="outline">{m.uploaded?.provider}</Badge>
                              </td>
                              <td className="p-2 tabular-nums">
                                {m.uploaded?.record_date || "—"}
                              </td>
                              <td className="p-2 font-medium">{m.uploaded?.customer_name}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[180px]">
                                {m.uploaded?.tariff}
                              </td>
                              <td className="p-2">{m.uploaded?.tippgeber}</td>
                              <td className="p-2 text-right font-medium tabular-nums">
                                {(m.uploaded?.provision ?? 0).toFixed(2)} €
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="missing_list" className="mt-3">
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0">
                        <tr className="text-left border-b border-border">
                          <th className="p-2">Anbieter</th>
                          <th className="p-2">Datum</th>
                          <th className="p-2">Kunde</th>
                          <th className="p-2">Tarif</th>
                          <th className="p-2">Tippgeber</th>
                          <th className="p-2 text-right">Provision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {summary.missingInList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-muted-foreground">
                              Keine fehlenden Hub-Aufträge.
                            </td>
                          </tr>
                        ) : (
                          summary.missingInList.map((m) => (
                            <tr key={m.id}>
                              <td className="p-2 font-medium">{m.hubRecord?.provider}</td>
                              <td className="p-2 tabular-nums">
                                {m.hubRecord?.record_date || "—"}
                              </td>
                              <td className="p-2">{m.hubRecord?.customer_name}</td>
                              <td className="p-2 text-muted-foreground truncate max-w-[180px]">
                                {m.hubRecord?.tariff}
                              </td>
                              <td className="p-2">{m.hubRecord?.tippgeber}</td>
                              <td className="p-2 text-right tabular-nums">
                                {Number(m.hubRecord?.provision ?? 0).toFixed(2)} €
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {summary && (
            <Button
              variant="outline"
              onClick={() => exportReconciliationReport(summary)}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Abgleich-Bericht (.xlsx) exportieren
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
