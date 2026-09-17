import { ChannelListingsPage } from "@/components/ChannelListingsPage";
import { RequirePermission } from "@/components/RequirePermission";

function PageContent() {
  return <ChannelListingsPage provider="tiktok" title="TikTok" description="Live database records for TikTok integration accounts and channel content/listings." />;
}

export default function Page() {
  return (
    <RequirePermission perm="tiktok.drafts.view">
      <PageContent />
    </RequirePermission>
  );
}
