import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, Download, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PROVIDERS } from "@/lib/providers";
import {
  AbrechnungRecord,
  VbSettlementSettings,
  calculateProviderSums,
  exportMultiSheetAbrechnung,
} from "@/lib/abrechnung-export";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: AbrechnungRecord[];
  initialVb?: string;
}

export function AbrechnungExportDialog({
  open,
  onOpenChange,
  records,
  initialVb = "__all__",
}: Props) {
  const [selectedVb, setSelectedVb] = useState<string>(initialVb || "__all__");
  const [vorMonatAmount, setVorMonatAmount] = useState<string>("-640");
  const [vorMonatLabel, setVorMonatLabel] = useState<string>("TDO-Academy");
  const [vorschussAmount, setVorschussAmount] = useState<string>("-3650");
  const [vorschussLabel, setVorschussLabel] = useState<string>("3000 Vorschuss Sep26");
  const [ohneMwst1, setOhneMwst1] = useState<string>("1100");
  const [mitMwst1, setMitMwst1] = useState<string>("2579.71");
  const [ohneMwst2, setOhneMwst2] = useState<string>("913");
  const [mitMwst2, setMitMwst2] = useState<string>("2295");
  const [extraCol2, setExtraCol2] = useState<string>("2210");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialVb) setSelectedVb(initialVb);
  }, [initialVb]);

  const vbList = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.tippgeber?.trim()) set.add(r.tippgeber.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (selectedVb === "__all__") return records;
    return records.filter(
      (r) => (r.tippgeber || "").trim().toLowerCase() === selectedVb.toLowerCase()
    );
  }, [records, selectedVb]);

  const providerSums = useMemo(
    () => calculateProviderSums(filteredRecords),
    [filteredRecords]
  );

  const totalProvision = useMemo(
    () =>
      Math.round(
        Object.values(providerSums).reduce((acc, v) => acc + v, 0) * 100
      ) / 100,
    [providerSums]
  );

  // Load saved settlement settings when VB changes
  useEffect(() => {
    if (!open) return;
    const vbKey = selectedVb === "__all__" ? "Ghaith Abojamil" : selectedVb;
    (async () => {
      const { data } = await (supabase as any)
        .from("vb_settlement_settings")
        .select("*")
        .eq("vb_name", vbKey)
        .maybeSingle();

      if (data) {
        setVorMonatAmount(String(data.vor_monat_amount ?? 0));
        setVorMonatLabel(String(data.vor_monat_label ?? "TDO-Academy"));
        setVorschussAmount(String(data.vorschuss_amount ?? 0));
        setVorschussLabel(String(data.vorschuss_label ?? "Vorschuss"));
        setOhneMwst1(String(data.ohne_mwst_1 ?? 0));
        setMitMwst1(String(data.mit_mwst_1 ?? 0));
        setOhneMwst2(String(data.ohne_mwst_2 ?? 0));
        setMitMwst2(String(data.mit_mwst_2 ?? 0));
        setExtraCol2(String(data.extra_col_2 ?? 0));
      } else if (vbKey.toLowerCase().includes("ghaith")) {
        setVorMonatAmount("-640");
        setVorMonatLabel("TDO-Academy");
        setVorschussAmount("-3650");
        setVorschussLabel("3000 Vorschuss Sep26");
        setOhneMwst1("1100");
        setMitMwst1("2579.71");
        setOhneMwst2("913");
        setMitMwst2("2295");
        setExtraCol2("2210");
      } else {
        setVorMonatAmount("0");
        setVorMonatLabel("Vor Monat");
        setVorschussAmount("0");
        setVorschussLabel("Vorschuss");
        setOhneMwst1("0");
        setMitMwst1(String(totalProvision));
        setOhneMwst2("0");
        setMitMwst2("0");
        setExtraCol2("0");
      }
    })();
  }, [open, selectedVb, totalProvision]);

  const vorMonatNum = parseFloat(vorMonatAmount.replace(",", ".")) || 0;
  const vorschussNum = parseFloat(vorschussAmount.replace(",", ".")) || 0;
  const sumAfterVorMonat = Math.round((totalProvision + vorMonatNum) * 100) / 100;

  const buildSettings = (): VbSettlementSettings => ({
    vb_name: selectedVb === "__all__" ? "Alle Vermittler" : selectedVb,
    vor_monat_amount: vorMonatNum,
    vor_monat_label: vorMonatLabel,
    vorschuss_amount: vorschussNum,
    vorschuss_label: vorschussLabel,
    ohne_mwst_1: parseFloat(ohneMwst1.replace(",", ".")) || 0,
    mit_mwst_1: parseFloat(mitMwst1.replace(",", ".")) || 0,
    ohne_mwst_2: parseFloat(ohneMwst2.replace(",", ".")) || 0,
    mit_mwst_2: parseFloat(mitMwst2.replace(",", ".")) || 0,
    extra_col_2: parseFloat(extraCol2.replace(",", ".")) || 0,
  });

  const handleSaveSettings = async () => {
    const vbKey = selectedVb === "__all__" ? "Ghaith Abojamil" : selectedVb;
    setSaving(true);
    const s = buildSettings();
    const { error } = await (supabase as any).from("vb_settlement_settings").upsert(
      {
        ...s,
        vb_name: vbKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "vb_name" }
    );
    setSaving(false);
    if (error) {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    } else {
      toast.success(`Abrechnungs-Einstellungen für ${vbKey} gespeichert.`);
    }
  };

  const handleExport = () => {
    const s = buildSettings();
    exportMultiSheetAbrechnung(filteredRecords, {
      vbName: selectedVb === "__all__" ? "Gesamt" : selectedVb,
      settings: s,
    });
    toast.success("12-Blatt Provisionsabrechnung (.xlsx) wurde heruntergeladen.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Komplette Provisionsabrechnung exportieren (12 Tabellenblätter)
          </DialogTitle>
          <DialogDescription>
            Erzeugt die originalgetreue Multi-Sheet Excel-Datei (<code>Übersicht</code> +{" "}
            <code>Strom</code>, <code>VF</code>, <code>1u1</code>, <code>O2</code>,{" "}
            <code>Ayyildiz</code>, <code>check</code>, <code>Yourfone</code>, <code>DAK</code>,{" "}
            <code>BKK</code>, <code>BigDirek</code>, <code>viactiv</code>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Vermittler / Tippgeber (VB)</Label>
              <Select value={selectedVb} onValueChange={setSelectedVb}>
                <SelectTrigger>
                  <SelectValue placeholder="Vermittler wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alle Vermittler ({records.length} Aufträge)</SelectItem>
                  {vbList.map((vb) => (
                    <SelectItem key={vb} value={vb}>
                      {vb}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Aktive Aufträge (ohne Storno)</div>
                <div className="text-lg font-semibold tabular-nums">
                  {filteredRecords.filter((r) => r.status !== "cancelled").length} Verträge
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Summe Anbieter</div>
                <div className="text-lg font-semibold text-primary tabular-nums">
                  {totalProvision.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Preview of Sheet 1: Übersicht */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-muted/60 px-3 py-2 text-xs font-medium flex items-center justify-between">
              <span>Vorschau Blatt 1: „Übersicht“ (alle 11 Anbieter)</span>
              <span className="text-muted-foreground">Automatische Summierung pro Reiter</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 text-xs">
              {PROVIDERS.map((p) => {
                const val = providerSums[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded border border-border/60 px-2.5 py-1.5 bg-card"
                  >
                    <span className="font-medium">{p.label}</span>
                    <span
                      className={`tabular-nums ${
                        val > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {val > 0
                        ? val.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Adjustments: Vor Monat, Vorschuss, ohne/mit MwSt */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Abzüge & Verrechnung (Übersicht)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Vor Monat (€)</Label>
                  <Input
                    value={vorMonatAmount}
                    onChange={(e) => setVorMonatAmount(e.target.value)}
                    placeholder="-640"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bezeichnung Vor Monat</Label>
                  <Input
                    value={vorMonatLabel}
                    onChange={(e) => setVorMonatLabel(e.target.value)}
                    placeholder="TDO-Academy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Vorschuss (€)</Label>
                  <Input
                    value={vorschussAmount}
                    onChange={(e) => setVorschussAmount(e.target.value)}
                    placeholder="-3650"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bezeichnung Vorschuss</Label>
                  <Input
                    value={vorschussLabel}
                    onChange={(e) => setVorschussLabel(e.target.value)}
                    placeholder="3000 Vorschuss Sep26"
                  />
                </div>
              </div>

              <div className="pt-1 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Summe nach Vor Monat:</span>
                <span className="font-semibold tabular-nums">
                  {sumAfterVorMonat.toLocaleString("de-DE", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                MwSt.-Aufteilung (ohne / mit MwSt)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Zeile 1: ohne MwSt</Label>
                  <Input value={ohneMwst1} onChange={(e) => setOhneMwst1(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zeile 1: mit MwSt</Label>
                  <Input value={mitMwst1} onChange={(e) => setMitMwst1(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Zeile 2: ohne</Label>
                  <Input value={ohneMwst2} onChange={(e) => setOhneMwst2(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zeile 2: mit MwSt</Label>
                  <Input value={mitMwst2} onChange={(e) => setMitMwst2(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zusatzspalte</Label>
                  <Input value={extraCol2} onChange={(e) => setExtraCol2(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleSaveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Speichert..." : "Werte für VB speichern"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" />
              Als 12-Blatt Excel (.xlsx) herunterladen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
