import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { providerByPath, PROVIDERS } from "@/lib/providers";
import { RecordsTable } from "@/components/RecordsTable";
import { KerfaTabs } from "@/components/kerfa/KerfaKit";

export const Route = createFileRoute("/_app/providers/$slug")({
  component: ProviderPage,
});

function ProviderPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const meta = providerByPath(slug);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("records")
      .select("provider, status")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        for (const r of data) {
          if (r.status === "cancelled") continue;
          map[r.provider] = (map[r.provider] || 0) + 1;
        }
        setCounts(map);
      });
  }, [slug]);

  if (!meta) return <Navigate to="/dashboard" />;

  const tabItems = PROVIDERS.map((p) => ({
    value: p.path,
    label: p.label,
    count: counts[p.id] || undefined,
  }));

  return (
    <RecordsTable
      provider={meta.id}
      headerNav={
        <div style={{ overflowX: "auto", paddingBottom: 2 }}>
          <KerfaTabs
            value={meta.path}
            onChange={(nextSlug) =>
              navigate({
                to: "/providers/$slug",
                params: { slug: nextSlug },
              })
            }
            items={tabItems}
          />
        </div>
      }
    />
  );
}
