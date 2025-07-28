"use client"

import * as React from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Settings2,
  Home,
  Truck
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  // Worklog application data with dynamic active state
  const data = {
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Home,
        isActive: pathname === "/dashboard" || pathname === "/analytics" || pathname === "/reports",
        items: [
          {
            title: "Overview",
            url: "/dashboard",
          },
          {
            title: "Analytics",
            url: "/analytics",
          },
          {
            title: "Reports",
            url: "/reports",
          },
        ],
      },
      {
        title: "Fleet & Personnel",
        url: "#",
        icon: Truck,
        isActive: pathname === "/vehicles" || pathname === "/drivers" || pathname === "/customers" || pathname === "/maintenance",
        items: [
          {
            title: "Vehicles",
            url: "/vehicles",
          },
          {
            title: "Drivers",
            url: "/drivers",
          },
          {
            title: "Customers",
            url: "/customers",
          },
          {
            title: "Maintenance",
            url: "/maintenance",
          },
        ],
      },
      {
        title: "Settings",
        url: "#",
        icon: Settings2,
        isActive: pathname === "/settings" || pathname === "/settings/users" || pathname === "/settings/permissions" || pathname === "/integrations",
        items: [
          {
            title: "General",
            url: "/settings",
          },
          {
            title: "Users",
            url: "/settings/users",
          },
          {
            title: "Permissions",
            url: "/settings/permissions",
          },
          {
            title: "Integrations",
            url: "/integrations",
          },
        ],
      },
    ],
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <Image 
            src="/logo.svg" 
            alt="WorkLog Logo" 
            width={32} 
            height={32} 
            className={`h-8 w-8 transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`} 
          />
          <span className={`font-semibold text-lg transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            WorkLog
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
