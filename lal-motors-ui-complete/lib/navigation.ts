import {
  LayoutDashboard, Sparkles, CarFront, PackageSearch, Box, Users, ShoppingCart,
  Factory, ClipboardList, Ship, WalletCards, ListTodo, Files, UserRoundCog,
  Store, BadgeDollarSign, Instagram, Music2, Settings
} from "lucide-react";

export const navGroups = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/ai", label: "AI Command", icon: Sparkles },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/vehicles", label: "Vehicles", icon: CarFront },
      { href: "/dashboard/parts", label: "Used Parts", icon: PackageSearch },
      { href: "/dashboard/new-items", label: "New Items", icon: Box },
      { href: "/dashboard/inventory", label: "Inventory", icon: Box },
      { href: "/dashboard/customers", label: "Customers", icon: Users },
      { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Factory },
      { href: "/dashboard/purchases", label: "Purchase Orders", icon: ClipboardList },
      { href: "/dashboard/shipments", label: "Shipments", icon: Ship },
      { href: "/dashboard/payments", label: "Payments", icon: WalletCards },
      { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo },
      { href: "/dashboard/documents", label: "Documents", icon: Files },
      { href: "/dashboard/employees", label: "Employees", icon: UserRoundCog },
    ],
  },
  {
    title: "Channels",
    items: [
      { href: "/dashboard/shopify", label: "Shopify", icon: Store },
      { href: "/dashboard/ebay", label: "eBay", icon: BadgeDollarSign },
      { href: "/dashboard/meta", label: "Meta", icon: Instagram },
      { href: "/dashboard/tiktok", label: "TikTok", icon: Music2 },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];
