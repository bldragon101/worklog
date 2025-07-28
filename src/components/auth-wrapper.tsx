import { SignedIn, SignedOut } from "@clerk/nextjs";
import { LoginForm } from "./login-form";

interface AuthWrapperProps {
  children: React.ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <>
      <SignedIn>
        {children}
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Welcome to WorkLog</h2>
            <p className="text-muted-foreground">
              Please sign in to access your work logs and manage your entries.
            </p>
          </div>
          <div className="w-full max-w-md">
            <LoginForm />
          </div>
        </div>
      </SignedOut>
    </>
  );
} 