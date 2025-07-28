"use client"

import * as React from "react"
import Image from "next/image"
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
} from "@/components/ui/sidebar"

// Worklog application data
const data = {
  // user: {
  //   name: "Admin User",
  //   email: "admin@worklog.com",
  //   avatar: "/avatars/admin.jpg",
  // },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
      isActive: true,
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <Image src="/logo.svg" alt="WorkLog Logo" width={32} height={32} className="h-8 w-8" />
          <span className="font-semibold text-lg">WorkLog</span>
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
