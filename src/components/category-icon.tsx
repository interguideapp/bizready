import {
  Globe,
  Landmark,
  Megaphone,
  Receipt,
  ScanEye,
  Settings2,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Landmark,
  Receipt,
  Wallet,
  Shield,
  ScanEye,
  Globe,
  Megaphone,
  Settings2,
  Users,
};

export function CategoryIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Landmark;
  return <Icon className={className} aria-hidden />;
}
