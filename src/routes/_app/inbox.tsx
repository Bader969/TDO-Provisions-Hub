import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageSquare,
} from "lucide-react";
import { TDO_GROUP_CHAT_ID } from "@/lib/whatsapp-parser";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inbox")({
  component: Inbox,
});

function Inbox() {
  const { isAdmin } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("raw_messages")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setMsgs(data ?? []);
    setLoading(false);
  }, []);

  const syncOpenWa = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/public/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", chatId: TDO_GROUP_CHAT_ID, full: true }),
      });
      const data = await res.json();
      if (data.newlySynced > 0) {
        toast.success(
          `${data.newlySynced} neue(r) Auftrag/Aufträge aus WhatsApp-Gruppe synchronisiert!`
        );
      } else {
        toast.info(
          `Alle ${data.scannedMessages ?? 0} Nachrichten aus ${TDO_GROUP_CHAT_ID} sind bereits synchronisiert.`
        );
      }
      await load();
    } catch (e: any) {
      toast.error("Fehler bei der OpenWA-Synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load();
    const channel = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "raw_messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, load]);

  if (!isAdmin) {
    return <div className="text-muted-foreground">Nur für Administratoren.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">WhatsApp-Eingang</h1>
            <Badge variant="outline" className="gap-1">
              <MessageSquare className="h-3 w-3 text-emerald-500" />
              Gruppe: {TDO_GROUP_CHAT_ID}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Eingehende WhatsApp-Nachrichten (OpenWA & Twilio) und KI-Parse-Status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={syncOpenWa} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronisiere Gruppe..." : "WhatsApp-Gruppe jetzt synchronisieren"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
          </Button>
        </div>
      </div>

      {msgs.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Noch keine Nachrichten empfangen. Klicke oben auf „WhatsApp-Gruppe jetzt
            synchronisieren“.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {msgs.map((m) => {
          const parsedProvider = m.ai_response?.provider;
          const parsedLine = m.ai_response?.lines?.[0];
          return (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm">
                        {m.from_name ?? m.from_number ?? "Unbekannt"}
                      </CardTitle>
                      {parsedProvider && parsedProvider !== "UNKNOWN" && (
                        <Badge variant="outline">{parsedProvider}</Badge>
                      )}
                      {parsedLine?.tippgeber && (
                        <Badge variant="secondary">VB: {parsedLine.tippgeber}</Badge>
                      )}
                      {m.pdf_filename && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <FileText className="h-3 w-3 text-primary" />
                          {m.pdf_filename}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(m.received_at), "dd.MM.yyyy HH:mm")}
                      {m.chat_id ? ` • ${m.chat_id}` : ""}
                    </div>
                  </div>
                  {m.processed ? (
                    m.parse_error ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="h-3 w-3" /> Fehler
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-green-500/10 text-green-700 dark:text-green-300"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Verarbeitet
                      </Badge>
                    )
                  ) : (
                    <Badge variant="outline">In Warteschlange</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded bg-muted p-2.5 text-xs font-mono">
                  {m.body}
                </pre>
                {m.parse_error && (
                  <div className="mt-2 text-xs text-destructive">{m.parse_error}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
