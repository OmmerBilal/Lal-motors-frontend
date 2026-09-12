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
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview overall command center business dashboard" },
      { href: "/dashboard/ai", label: "AI & Approvals", icon: Sparkles, keywords: "ai requests approvals functions automation foundation" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/vehicles", label: "Vehicles", icon: CarFront, keywords: "cars vehicle inventory" },
      { href: "/dashboard/parts", label: "Used Parts", icon: PackageSearch, keywords: "parts used catalog" },
      { href: "/dashboard/new-items", label: "New Items", icon: Box, keywords: "new products items catalog" },
      { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, keywords: "stock warehouse location quantity reserve receive transfer" },
      { href: "/dashboard/customers", label: "Customers", icon: Users, keywords: "crm customer contacts" },
      { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart, keywords: "sales orders payment reserve fulfill return customer" },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Factory, keywords: "vendors procurement supplier" },
      { href: "/dashboard/purchases", label: "Purchase Orders", icon: ClipboardList, keywords: "po purchasing procurement receive" },
      { href: "/dashboard/procurement", label: "Procurement Ops", icon: ClipboardCheck, keywords: "quotes certifications production qc supplier communications" },
      { href: "/dashboard/shipments", label: "Shipments", icon: Ship, keywords: "logistics shipping inbound outbound" },
      { href: "/dashboard/containers", label: "Containers", icon: Container, keywords: "container logistics cargo" },
      { href: "/dashboard/payments", label: "Payments", icon: WalletCards, keywords: "finance transactions customer supplier payment" },
      { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo, keywords: "follow ups todos assignment due" },
      { href: "/dashboard/documents", label: "Documents", icon: Files, keywords: "files docs attachments metadata" },
      { href: "/dashboard/employees", label: "Employees & HR", icon: UserRoundCog, keywords: "hr staff employees shifts time off job roles availability" },
    ],
  },
  {
    title: "Channels",
    items: [
      { href: "/dashboard/shopify", label: "Shopify", icon: Store, keywords: "store ecommerce products integration listings" },
      { href: "/dashboard/ebay", label: "eBay", icon: BadgeDollarSign, keywords: "marketplace integration listings" },
      { href: "/dashboard/meta", label: "Meta", icon: Instagram, keywords: "facebook instagram social integration listings" },
      { href: "/dashboard/tiktok", label: "TikTok", icon: Music2, keywords: "social video integration listings" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/dashboard/settings", label: "System Admin", icon: ShieldCheck, keywords: "settings users roles permissions audit integrations outbox administration" },
    ],
  },
];

export const allNavigationItems = navGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title })),
);
