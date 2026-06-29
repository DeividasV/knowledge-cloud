import {
  LayoutDashboard,
  Tv,
  PlaySquare,
  Settings,
  Network,
  List,
  Sparkles,
  Database,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/channels", label: "Channels", icon: Tv },
  { href: "/videos", label: "Videos", icon: PlaySquare },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/tags", label: "Tag Graph", icon: Network },
  { href: "/tags/list", label: "Tag List", icon: List },
  { href: "/backup", label: "Backup", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];
