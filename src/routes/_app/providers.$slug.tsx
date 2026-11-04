import { createFileRoute, useParams, Navigate } from "@tanstack/react-router";
import { providerByPath } from "@/lib/providers";
import { RecordsTable } from "@/components/RecordsTable";

export const Route = createFileRoute("/_app/providers/$slug")({
  component: ProviderPage,
});

function ProviderPage() {
  const { slug } = useParams({ from: "/_app/providers/$slug" });
  const meta = providerByPath(slug);
  if (!meta) return <Navigate to="/dashboard" />;
  return <RecordsTable provider={meta.id} />;
}
