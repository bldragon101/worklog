import Image from "next/image";
import { SignUpForm } from "@/components/signup-form";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.svg" alt="WorkLog Logo" width={64} height={64} className="h-16 w-16 mx-auto mb-4" />
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