import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, MessageSquare, RefreshCw } from "lucide-react";
import {
  DEFAULT_OPENWA_BASE_URL,
  DEFAULT_OPENWA_SESSION_ID,
  TDO_GROUP_CHAT_ID,
} from "@/lib/whatsapp-parser";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/whatsapp`
      : "https://tdo-provisions-hub.vercel.app/api/public/whatsapp";

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");
      const merged = (profiles ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? [])
          .filter((r: any) => r.user_id === p.id)
          .map((r: any) => r.role),
      }));
      setMembers(merged);
    })();
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="text-muted-foreground">Nur für Administratoren.</div>;
  }

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    if (isCurrentlyAdmin) {
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
    }
    toast.success("Rolle aktualisiert");
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    setMembers(
      (profiles ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? [])
          .filter((r: any) => r.user_id === p.id)
          .map((r: any) => r.role),
      }))
    );
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/public/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", chatId: TDO_GROUP_CHAT_ID, full: true }),
      });
      const data = await res.json();
      toast.success(
        `Synchronisation abgeschlossen: ${data.newlySynced ?? 0} neue Aufträge (${
          data.scannedMessages ?? 0
        } Gruppennachrichten geprüft).`
      );
    } catch {
      toast.error("Fehler bei der Synchronisation.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
              OpenWA WhatsApp-Gruppen-Anbindung
            </CardTitle>
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Aktiv & Verbunden
            </Badge>
          </div>
          <CardDescription>
            Empfängt und sortiert alle Aufträge aus der WhatsApp-Gruppe{" "}
            <strong>TDO Provision-Hub</strong> automatisch nach Anbieter, Kunde, Tarif,
            Datum und Tippgeber (VB).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <div>
              <span className="text-muted-foreground block">WhatsApp Gruppen-ID:</span>
              <code className="font-semibold">{TDO_GROUP_CHAT_ID}</code>
            </div>
            <div>
              <span className="text-muted-foreground block">OpenWA Server & Session:</span>
              <code className="font-semibold">
                {DEFAULT_OPENWA_BASE_URL} ({DEFAULT_OPENWA_SESSION_ID.slice(0, 8)}…)
              </code>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Unterstützt sowohl Echtzeit-Webhooks als auch aktiven Gruppen-Abruf inkl.
              PDF-Zuordnung.
            </span>
            <Button size="sm" onClick={handleManualSync} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchronisiere..." : "Jetzt Gruppe synchronisieren"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook-Endpunkt (OpenWA & Twilio)</CardTitle>
          <CardDescription>
            Öffentliche HTTP POST / GET Route für eingehende WhatsApp-Events von OpenWA
            oder Twilio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm break-all">
              {webhookUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team & Rollen</CardTitle>
          <CardDescription>
            Admins können Datensätze löschen und den WhatsApp-Eingang einsehen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => {
              const isAdminUser = m.roles.includes("admin");
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <div className="font-medium">{m.display_name ?? m.email}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdminUser ? (
                      <Badge>Admin</Badge>
                    ) : (
                      <Badge variant="secondary">Mitarbeiter</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAdmin(m.id, isAdminUser)}
                    >
                      {isAdminUser ? "→ Mitarbeiter" : "→ Admin"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
