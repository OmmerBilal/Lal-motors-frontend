import { MetaBusinessModule } from "@/components/MetaBusinessModule";
import { RequirePermission } from "@/components/RequirePermission";
import { Suspense } from "react";

function PageContent() {
  return <MetaBusinessModule />;
}

export default function Page() {
  return (
    <RequirePermission perm="meta.drafts.view">
      <Suspense fallback={null}>
        <PageContent />
      </Suspense>
    </RequirePermission>
  );
}
