"use client";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/ModeToggle";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./ui/loading-skeleton";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

function SignInRedirect() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  useEffect(() => {
    // Add a small delay to allow Clerk to process the authentication
    const timer = setTimeout(() => {
      router.push('/sign-in');
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [router, isLoaded, user]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto" />
        <p className="mt-4 text-gray-600">Checking authentication...</p>
        <p className="text-xs text-gray-500 mt-2">isLoaded: {isLoaded ? 'true' : 'false'}</p>
        <p className="text-xs text-gray-500">user: {user ? 'exists' : 'null'}</p>
      </div>
    </div>
  );
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
            <div className="flex flex-1 flex-col gap-4 pt-0 min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-transparent dark:to-transparent">
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