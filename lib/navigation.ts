import {
  LayoutDashboard,
  Sparkles,
  CarFront,
  PackageSearch,
  Box,
  Boxes,
  Users,
  ShoppingCart,
  Factory,
  ClipboardList,
  Ship,
  Container,
  WalletCards,
  ListTodo,
  Files,
  UserRoundCog,
  Store,
  BadgeDollarSign,
  Instagram,
  Music2,
  Settings,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";

export const navGroups = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview overall command center business dashboard", requiredPermission: "dashboard.view" },
      { href: "/dashboard/ai", label: "AI & Approvals", icon: Sparkles, keywords: "ai requests approvals functions automation foundation", requiredPermission: "ai.use" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/vehicles", label: "Vehicles", icon: CarFront, keywords: "cars vehicle inventory", requiredPermission: "vehicles.view" },
      { href: "/dashboard/parts", label: "Used Parts", icon: PackageSearch, keywords: "parts used catalog", requiredPermission: "used_parts.view" },
      { href: "/dashboard/new-items", label: "New Items", icon: Box, keywords: "new products items catalog", requiredPermission: "new_items.view" },
      { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, keywords: "stock warehouse location quantity reserve receive transfer", requiredPermission: "inventory.view" },
      { href: "/dashboard/customers", label: "Customers", icon: Users, keywords: "crm customer contacts", requiredPermission: "customers.view" },
      { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart, keywords: "sales orders payment reserve fulfill return customer", requiredPermission: "sales.view" },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Factory, keywords: "vendors procurement supplier", requiredPermission: "suppliers.view" },
      { href: "/dashboard/purchases", label: "Purchase Orders", icon: ClipboardList, keywords: "po purchasing procurement receive", requiredPermission: "purchase_orders.view" },
      { href: "/dashboard/procurement", label: "Procurement Ops", icon: ClipboardCheck, keywords: "quotes certifications production qc supplier communications", requiredPermission: "procurement_ops.view" },
      { href: "/dashboard/shipments", label: "Shipments", icon: Ship, keywords: "logistics shipping inbound outbound", requiredPermission: "shipments.view" },
      { href: "/dashboard/containers", label: "Containers", icon: Container, keywords: "container logistics cargo", requiredPermission: "containers.view" },
      { href: "/dashboard/payments", label: "Payments", icon: WalletCards, keywords: "finance transactions customer supplier payment", requiredPermission: "payments.view" },
      { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo, keywords: "follow ups todos assignment due", requiredPermission: "tasks.view" },
      { href: "/dashboard/documents", label: "Documents", icon: Files, keywords: "files docs attachments metadata", requiredPermission: "documents.view" },
      { href: "/dashboard/employees", label: "Employees & HR", icon: UserRoundCog, keywords: "hr staff employees shifts time off job roles availability", requiredPermission: "employees.view" },
    ],
  },
  {
    title: "Channels",
    items: [
      { href: "/dashboard/shopify", label: "Shopify", icon: Store, keywords: "store ecommerce products integration listings", requiredPermission: "shopify.view" },
      { href: "/dashboard/ebay", label: "eBay", icon: BadgeDollarSign, keywords: "marketplace integration listings", requiredPermission: "ebay.view" },
      { href: "/dashboard/meta", label: "Meta", icon: Instagram, keywords: "facebook instagram social integration listings", requiredPermission: "meta.drafts.view" },
      { href: "/dashboard/tiktok", label: "TikTok", icon: Music2, keywords: "social video integration listings", requiredPermission: "tiktok.drafts.view" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/dashboard/settings", label: "System Admin", icon: ShieldCheck, keywords: "settings users roles permissions audit integrations outbox administration", requiredPermission: "settings.view" },
    ],
  },
];

export const allNavigationItems = navGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title })),
);
