"use client";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "../ui/loading-skeleton";
import { Input } from "@/components/ui/input";
import { SearchProvider, useSearch } from "@/contexts/search-context";

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

function HeaderContent() {
  const { globalSearchValue, setGlobalSearchValue } = useSearch();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1">
        <Input
          id="global-search-input"
          placeholder="Search all data..."
          value={globalSearchValue}
          onChange={(e) => setGlobalSearchValue(e.target.value)}
          className="h-12 w-full bg-white dark:bg-input/30 text-base"
        />
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
      </div>
    </header>
  );
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
        <SearchProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <HeaderContent />
              <div className="flex flex-1 flex-col gap-4 pt-0 min-h-screen overflow-x-hidden">
                <div className="w-full max-w-full">
                  {children}
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </SearchProvider>
      </SignedIn>
      <SignedOut>
        <SignInRedirect />
      </SignedOut>
    </>
  );
} 