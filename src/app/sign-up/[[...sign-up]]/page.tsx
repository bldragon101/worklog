import { SignUpForm } from "@/components/signup-form";
import { ModeToggle } from "@/components/ModeToggle";
import { Logo } from "@/components/Logo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 relative">
      {/* Dark mode toggle positioned in top-right corner */}
      <div className="absolute top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-lg border border-gray-200 dark:border-gray-700">
        <ModeToggle />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo width={64} height={64} className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Join WorkLog
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create an account to start managing your work logs
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
} 