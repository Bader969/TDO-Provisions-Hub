import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Database, ShieldCheck, KeyRound } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ADMIN_TEST_EMAIL = "admin@tdo-hub.de";
const ADMIN_TEST_PASSWORD = "TDOAdmin2026!";

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const signInWithCredentials = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Erfolgreich im TDO Provisions-Hub angemeldet.");
      navigate({ to: "/dashboard" });
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithCredentials(email, password);
  };

  const handleQuickAdminLogin = async () => {
    setEmail(ADMIN_TEST_EMAIL);
    setPassword(ADMIN_TEST_PASSWORD);
    await signInWithCredentials(ADMIN_TEST_EMAIL, ADMIN_TEST_PASSWORD);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Database className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">TDO Provisions-Hub</CardTitle>
          <CardDescription>
            Geschützter Mitarbeiter- & Admin-Zugang (Registrierung deaktiviert)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">E-Mail</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="name@tdo-hub.de"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Passwort</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird angemeldet..." : "Anmelden"}
            </Button>
          </form>

          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Test-Login</span>
              </div>
              <span className="text-[11px] text-muted-foreground">Rolle: Admin</span>
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs font-mono bg-background/80 rounded border border-border/60 p-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-Mail:</span>
                <span className="font-semibold select-all">{ADMIN_TEST_EMAIL}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Passwort:</span>
                <span className="font-semibold select-all">{ADMIN_TEST_PASSWORD}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  setEmail(ADMIN_TEST_EMAIL);
                  setPassword(ADMIN_TEST_PASSWORD);
                }}
              >
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                Daten ausfüllen
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1 text-xs"
                disabled={loading}
                onClick={handleQuickAdminLogin}
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Direkt als Admin starten
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
