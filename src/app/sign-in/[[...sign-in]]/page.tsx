import { LoginForm } from "@/components/auth/login-form";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Logo } from "@/components/brand/logo";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background relative">
      {/* Dark mode toggle positioned in top-right corner */}
      <div className="absolute top-4 right-4 z-50 bg-white dark:bg-background rounded-lg p-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <ModeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo width={64} height={64} className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to WorkLog
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to access your work logs and manage your entries
          </p>
        </div>
        <div className="bg-white dark:bg-background rounded shadow-xl p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
