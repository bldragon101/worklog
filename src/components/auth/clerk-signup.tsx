"use client"

import { SignUp } from "@clerk/nextjs";

export function ClerkSignUp() {
  return (
    <div className="flex items-center justify-center">
      <SignUp 
        routing="path"
        path="/sign-up"
        redirectUrl="/overview"
        signInUrl="/sign-in"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
            headerTitle: "text-2xl font-bold",
            headerSubtitle: "text-gray-600",
            socialButtonsBlockButton: "w-full",
            formButtonPrimary: "w-full bg-blue-600 hover:bg-blue-700",
            footer: "hidden"
          }
        }}
      />
    </div>
  );
}