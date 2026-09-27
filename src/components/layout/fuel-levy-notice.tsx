"use client";

import Link from "next/link";
import { Fuel } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useDefaultFuelLevy } from "@/hooks/use-default-fuel-levy";
import { cn } from "@/lib/utils/utils";

const noticeClasses =
  "h-auto border border-amber-300 bg-amber-50 py-2 text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950 dark:hover:text-amber-200";

function NoticeContent({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Fuel className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate text-xs font-medium">{label}</span>
      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-900 dark:bg-amber-900 dark:text-amber-100">
        {value}
      </span>
    </>
  );
}

/**
 * Sidebar alert showing the current default fuel levy. Admins can click it to
 * go to the setting; when unset it is only shown to admins.
 */
export function FuelLevyNotice({ isAdmin }: { isAdmin: boolean }) {
  const { data: defaultFuelLevy, isLoading, isError } = useDefaultFuelLevy();

  if (isLoading || isError) return null;

  const isSet = defaultFuelLevy !== null && defaultFuelLevy !== undefined;
  if (!isSet && !isAdmin) return null;

  const value = isSet ? `${defaultFuelLevy}%` : "Not set";
  const tooltip = `Default fuel levy: ${value}`;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {isAdmin ? (
          <SidebarMenuButton
            asChild
            tooltip={tooltip}
            className={noticeClasses}
          >
            <Link
              id="sidebar-fuel-levy-notice"
              href="/settings/admin"
              aria-label={`${tooltip}. Change in admin settings`}
            >
              <NoticeContent label="Default fuel levy" value={value} />
            </Link>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton
            asChild
            tooltip={tooltip}
            className={cn(noticeClasses, "cursor-default")}
          >
            <div
              id="sidebar-fuel-levy-notice"
              role="status"
              aria-label={tooltip}
            >
              <NoticeContent label="Default fuel levy" value={value} />
            </div>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
