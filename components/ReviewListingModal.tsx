"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Field, Message, Modal, TextAreaField } from "@/components/RealUi";
import { ProviderAccountSelector } from "@/components/ProviderAccountSelector";
import { API_BASE_URL, apiFetch, apiUpload } from "@/lib/api";
import { invalidate } from "@/lib/invalidate";

type ChannelName = "shopify" | "ebay" | "meta" | "tiktok";
type ChannelDraft = {
  id: string; session_id: string; master_draft_id: string; channel: ChannelName;
  status: string; payload: Record<string, any>; missing_information: string[];
  product_name?: string;
};
type Account = {
  id: string; display_name?: string; account_name: string; shop_domain?: string | null; status: string;
  facebook_page_name?: string | null; instagram_username?: string | null; has_instagram?: boolean;
};
type ReviewField = { key: string; label: string; required: boolean; kind: string };
type ReviewPackage = {
  draft: ChannelDraft;
  master: Record<string, any> | null;
  catalog_item: Record<string, any> | null;
  session_images: { file_id: string; original_filename?: string }[];
  fields: ReviewField[];
  missing: string[];
  tracked_missing_information: string[];
  accounts: Account[];
  requires_account_selection: boolean;
  listings: { integration_account_id: string; account_name: string; external_listing_id: string | null; listing_status: string }[];
};

function mediaUrl(fileId: string) {
  return `${API_BASE_URL}/ai/studio/media/${fileId}`;
}

function asText(value: unknown) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReviewListingModal({
  draft,
  onClose,
  onDone,
}: {
  draft: ChannelDraft;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [publishTargets, setPublishTargets] = useState<string[]>(["facebook"]);

  const reviewQuery = useQuery({
    queryKey: ["contentStudio", "review", draft.id],
    queryFn: () => apiFetch<ReviewPackage>(`/ai/studio/drafts/${draft.id}/review`),
  });
  const pack = reviewQuery.data;

  useEffect(() => {
    if (!pack) return;
    const payload = pack.draft.payload || {};
    const next: Record<string, string> = {};
    for (const field of pack.fields) {
      if (field.kind === "images") continue;
      next[field.key] = asText(payload[field.key] ?? pack.master?.[field.key] ?? pack.catalog_item?.[field.key]);
    }
    setValues(next);
    const ids = (payload.image_file_ids || pack.session_images.map(i => i.file_id)).map(String);
    setImageIds(ids);
    setPrimaryId(String(payload.primary_image_file_id || ids[0] || ""));
    if (pack.accounts.length === 1) setAccountId(String(pack.accounts[0].id));
    if (pack.draft.channel === "meta") {
      const caption = payload.caption || payload.facebook?.caption || payload.instagram?.primary_caption || "";
      setValues(s => ({ ...s, caption: caption || s.caption || "" }));
      const selected = pack.accounts.find(a => String(a.id) === accountId) || pack.accounts[0];
      setPublishTargets(selected?.has_instagram ? ["facebook"] : ["facebook"]);
    }
  }, [pack]);

  const missingNow = useMemo(() => {
    if (!pack) return [];
    const hits: string[] = [];
    for (const field of pack.fields) {
      if (!field.required) continue;
      if (field.kind === "images") {
        if (pack.draft.channel === "meta" && !publishTargets.includes("instagram")) continue;
        if (imageIds.length === 0) hits.push("images");
        continue;
      }
      if (!(values[field.key] || "").trim()) hits.push(field.key);
    }
    return hits;
  }, [pack, values, imageIds, publishTargets]);

  function payloadFromForm(ids = imageIds, primary = primaryId) {
    const payload: Record<string, any> = { ...(pack?.draft.payload || {}) };
    for (const [key, value] of Object.entries(values)) {
      if (key === "tags") payload.tags = value.split(",").map(s => s.trim()).filter(Boolean);
      else if (key === "item_specifics") {
        try { payload[key] = value ? JSON.parse(value) : {}; }
        catch { payload[key] = value; }
      }
      else if (key === "price" || key === "quantity" || key === "compare_at_price") payload[key] = value === "" ? null : Number(value);
      else payload[key] = value;
    }
    payload.image_file_ids = ids;
    payload.primary_image_file_id = primary || ids[0] || null;
    if (pack?.draft.channel === "meta") {
      if (publishTargets.includes("facebook") && publishTargets.includes("instagram")) payload.platform = "both";
      else if (publishTargets.includes("instagram")) payload.platform = "instagram";
      else payload.platform = "facebook";
    }
    return payload;
  }

  async function persistReview(ids = imageIds, primary = primaryId) {
    await apiFetch(`/ai/studio/drafts/${draft.id}/review`, {
      method: "POST",
      body: JSON.stringify({
        payload: payloadFromForm(ids, primary),
        image_file_ids: ids,
        primary_image_file_id: primary || null,
      }),
    });
  }

  async function uploadImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true); setError("");
    try {
      const form = new FormData();
      Array.from(files).forEach(f => form.append("files", f));
      const res = await apiUpload<{ files: { file_id: string }[] }>("/ai/studio/uploads", form);
      const added = res.files.map(f => f.file_id);
      const next = [...imageIds, ...added];
      const nextPrimary = primaryId || added[0] || "";
      setImageIds(next);
      if (!primaryId && added[0]) setPrimaryId(added[0]);
      try { await persistReview(next, nextPrimary); }
      catch { /* files are already in core.files; complete() will persist ids */ }
    } catch (e: any) {
      setError(e?.message || "Unable to upload images.");
    } finally { setBusy(false); }
  }

  async function complete(publish: boolean) {
    setBusy(true); setError("");
    try {
      if (missingNow.length > 0) {
        setError(`Complete required listing fields before approval. Missing: ${missingNow.join(", ")}`);
        setBusy(false);
        return;
      }
      if (publish && pack?.requires_account_selection && !accountId) {
        setError("Select a store before publishing.");
        setBusy(false);
        return;
      }
      if (publish && pack?.draft.channel === "meta" && publishTargets.length === 0) {
        setError("Choose Facebook, Instagram, or both before publishing. Nothing is posted until you select a destination.");
        setBusy(false);
        return;
      }
      const res = await apiFetch<{ draft: ChannelDraft; listing?: { external_listing_id?: string } }>(
        `/ai/studio/drafts/${draft.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            payload: payloadFromForm(),
            image_file_ids: imageIds,
            primary_image_file_id: primaryId || null,
            integration_account_id: accountId || null,
            publish,
            publish_targets: pack?.draft.channel === "meta" ? publishTargets : [],
          }),
        },
      );
      invalidate(queryClient, ["contentStudio", "shopify", "ebay", "meta"]);
      const listingId = res.listing?.external_listing_id;
      onDone?.(listingId
        ? (pack?.draft.channel === "meta"
          ? `Published to ${publishTargets.join(" + ")} (ID ${listingId}).`
          : `Unpublished ${pack?.draft.channel} listing created (ID ${listingId}).`)
        : "Listing completed and approved.");
      onClose();
    } catch (e: any) {
      setError(e?.message || "Unable to complete listing.");
    } finally { setBusy(false); }
  }

  const fields = pack?.fields || [];
  const canPublish = (pack?.draft.channel === "shopify" || pack?.draft.channel === "ebay" || pack?.draft.channel === "meta") && (pack?.accounts.length || 0) > 0;
  const blocked = busy || missingNow.length > 0;
  const selectedMetaAccount = pack?.accounts.find(a => String(a.id) === accountId) || pack?.accounts[0];
  const metaHasInstagram = Boolean(selectedMetaAccount?.has_instagram);

  return <Modal title="Review & Complete Listing" eyebrow={pack?.draft.channel || draft.channel} onClose={onClose} width={860}>
    {reviewQuery.isLoading && <div className="muted">Loading listing review…</div>}
    <Message error={error || (reviewQuery.error instanceof Error ? reviewQuery.error.message : "")} success="" />
    {pack && <>
      {pack.tracked_missing_information?.length > 0 && <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <strong>Missing information</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{pack.tracked_missing_information.map(item => <li key={item}>{item}</li>)}</ul>
      </div>}
      {missingNow.length > 0 && <div className="card" style={{ padding: 12, marginBottom: 12, borderColor: "var(--danger)" }}>
        <strong>Required before approval</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{missingNow.join(", ")}</div>
      </div>}
      {pack.catalog_item && <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Existing product: {pack.catalog_item.name} ({pack.catalog_item.item_code || pack.catalog_item.sku || "no SKU"})
      </div>}
      <div className="form-grid">
        {fields.filter(f => f.kind !== "images").map(field => {
          const required = field.required && !(values[field.key] || "").trim();
          if (field.kind === "textarea") {
            return <div key={field.key} style={required ? { outline: "1px solid var(--danger)", borderRadius: 8 } : undefined}>
              <TextAreaField label={`${field.label}${field.required ? " *" : ""}`} value={values[field.key] || ""} onChange={v => setValues(s => ({ ...s, [field.key]: v }))} />
            </div>;
          }
          return <div key={field.key} style={required ? { outline: "1px solid var(--danger)", borderRadius: 8 } : undefined}>
            <Field label={`${field.label}${field.required ? " *" : ""}`} type={field.kind === "number" ? "number" : "text"}
              value={values[field.key] || ""} onChange={v => setValues(s => ({ ...s, [field.key]: v }))} />
          </div>;
        })}
      </div>

      {fields.some(f => f.kind === "images") && <div style={{ marginTop: 16 }}>
        <div className="panel-head"><h3 style={{ margin: 0 }}>Images</h3>
          <button className="btn btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={14} />Upload</button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { uploadImages(e.target.files); e.target.value = ""; }} />
        {imageIds.length === 0
          ? <div className="card" style={{ padding: 16, textAlign: "center" }}><Upload size={16} /><div className="muted" style={{ marginTop: 6 }}>No images yet{fields.some(f => f.kind === "images" && f.required) ? " — required before publishing." : "."}</div></div>
          : <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{imageIds.map((id, index) =>
            <div key={id} className="card" style={{ padding: 8, width: 128 }}>
              <img src={mediaUrl(id)} alt="" style={{ width: 112, height: 112, objectFit: "cover", borderRadius: 8 }} />
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px" }} onClick={() => setPrimaryId(id)}><Star size={11} />{primaryId === id ? "Primary" : "Set primary"}</button>
                {index > 0 && <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px" }} onClick={() => setImageIds(ids => { const next = [...ids]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>Up</button>}
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 6px" }} onClick={() => setImageIds(ids => ids.filter(x => x !== id))}><Trash2 size={11} /></button>
              </div>
            </div>)}
          </div>}
      </div>}

      {canPublish && <div style={{ marginTop: 16 }}>
        <div className="form-label">Publish to {pack.requires_account_selection ? "*" : ""}</div>
        <ProviderAccountSelector
          accounts={pack.accounts}
          value={accountId}
          onChange={setAccountId}
          requireSelection={pack.requires_account_selection}
          label=""
        />
        {pack.draft.channel === "meta" && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={publishTargets.includes("facebook")} onChange={e => {
              setPublishTargets(curr => e.target.checked ? Array.from(new Set([...curr, "facebook"])) : curr.filter(x => x !== "facebook"));
            }} />
            Facebook Page{selectedMetaAccount?.facebook_page_name ? ` (${selectedMetaAccount.facebook_page_name})` : ""}
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" disabled={!metaHasInstagram} checked={publishTargets.includes("instagram")} onChange={e => {
              setPublishTargets(curr => e.target.checked ? Array.from(new Set([...curr, "instagram"])) : curr.filter(x => x !== "instagram"));
            }} />
            Instagram{metaHasInstagram ? (selectedMetaAccount?.instagram_username ? ` (@${selectedMetaAccount.instagram_username})` : "") : " (not linked to this Page)"}
          </label>
          <div className="muted" style={{ fontSize: 12 }}>Nothing is posted until you choose a destination. Facebook and Instagram are separate publishes.</div>
        </div>}
        {pack.listings.length > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Already published to: {pack.listings.map(l => `${l.account_name} (${l.external_listing_id || l.listing_status})`).join(", ")}
        </div>}
      </div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="btn btn-secondary" disabled={blocked} onClick={() => complete(false)}>Approve</button>
        {canPublish && <button className="btn btn-primary" disabled={blocked || (pack.requires_account_selection && !accountId) || (pack.draft.channel === "meta" && publishTargets.length === 0)} onClick={() => complete(true)}>
          {pack.draft.channel === "meta" ? "Publish to selected destination" : "Create unpublished listing"}
        </button>}
      </div>
    </>}
  </Modal>;
}
