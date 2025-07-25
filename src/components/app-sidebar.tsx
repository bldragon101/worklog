"use client"

import * as React from "react"
import {
  Settings2,
  Home,
  Truck,
  UserCheck,
  ClipboardList,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// Worklog application data
const data = {
  user: {
    name: "Admin User",
    email: "admin@worklog.com",
    avatar: "/avatars/admin.jpg",
  },
  teams: [
    {
      name: "WorkLog Pro",
      logo: ClipboardList,
      plan: "Enterprise",
    },
    {
      name: "Fleet Management",
      logo: Truck,
      plan: "Professional",
    },
    {
      name: "Driver Portal",
      logo: UserCheck,
      plan: "Standard",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
      isActive: true,
      items: [
        {
          title: "Overview",
          url: "/",
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
          url: "/settings/integrations",
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
