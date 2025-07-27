import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="WorkLog Logo" className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to WorkLog
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to access your work logs and manage your entries
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <SignIn 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none p-0",
              }
            }}
            redirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
} 