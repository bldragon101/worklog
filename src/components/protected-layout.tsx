"use client";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/ModeToggle";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

function SignInRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/sign-in');
  }, [router]);
  
  return null;
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return (
    <>
      <SignedIn>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <div className="ml-auto flex items-center gap-2">
                  <ModeToggle />
                </div>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </SignedIn>
      <SignedOut>
        <SignInRedirect />
      </SignedOut>
    </>
  );
} 