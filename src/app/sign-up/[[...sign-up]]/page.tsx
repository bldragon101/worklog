import { SignUp } from "@clerk/nextjs";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Logo } from "@/components/brand/logo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-background relative">
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
          <SignUp 
            routing="path"
            path="/sign-up"
            redirectUrl="/overview"
            signInUrl="/sign-in"
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-none border-0 bg-transparent",
                headerTitle: "text-xl font-semibold",
                headerSubtitle: "text-gray-600 dark:text-gray-400",
                socialButtonsBlockButton: "w-full border-gray-300 hover:bg-gray-50",
                formButtonPrimary: "w-full bg-blue-600 hover:bg-blue-700",
                footer: "hidden"
              }
            }}
          />
        </div>
      </div>
    </div>
  );
} 