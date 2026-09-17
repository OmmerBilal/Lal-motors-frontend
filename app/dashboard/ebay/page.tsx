import { ChannelBusinessModule } from "@/components/ChannelBusinessModule";
import { RequirePermission } from "@/components/RequirePermission";

function PageContent() {
  return <ChannelBusinessModule provider="ebay" title="eBay" />;
}

export default function Page() {
  return (
    <RequirePermission perm="ebay.view">
      <PageContent />
    </RequirePermission>
  );
}
