import { ChannelListingsPage } from "@/components/ChannelListingsPage";
import { RequirePermission } from "@/components/RequirePermission";

function PageContent() {
  return <ChannelListingsPage provider="meta" title="Meta" description="Live database records for Facebook / Instagram integration accounts and channel content/listings." />;
}

export default function Page() {
  return (
    <RequirePermission perm="meta.drafts.view">
      <PageContent />
    </RequirePermission>
  );
}
