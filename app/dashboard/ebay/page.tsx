import { ChannelBusinessModule } from "@/components/ChannelBusinessModule";
import { RequirePermission } from "@/components/RequirePermission";
import { Suspense } from "react";

function PageContent() {
  return <ChannelBusinessModule provider="ebay" title="eBay" />;
}

export default function Page() {
  return (
    <RequirePermission perm="ebay.view">
      <Suspense fallback={null}>
        <PageContent />
      </Suspense>
    </RequirePermission>
  );
}
