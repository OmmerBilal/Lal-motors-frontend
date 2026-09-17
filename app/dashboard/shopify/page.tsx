import { ChannelBusinessModule } from "@/components/ChannelBusinessModule";
import { RequirePermission } from "@/components/RequirePermission";

function PageContent() {
  return <ChannelBusinessModule provider="shopify" title="Shopify" />;
}

export default function Page() {
  return (
    <RequirePermission perm="shopify.view">
      <PageContent />
    </RequirePermission>
  );
}
