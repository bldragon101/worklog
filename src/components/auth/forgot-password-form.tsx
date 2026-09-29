"use client";

import { cn } from "@/lib/utils/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useSignIn } from "@clerk/nextjs/legacy";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useToast } from "@/hooks/use-toast";

/**
 * Returns the first message from a Clerk API error, or the fallback for any other error.
 */
function getClerkErrorMessage({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}) {
  if (!isClerkAPIResponseError(error)) return fallback;
  const [firstError] = error.errors;
  return firstError?.longMessage ?? firstError?.message ?? fallback;
}

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { signIn, isLoaded } = useSignIn();
  const { setActive } = useClerk();
  const { toast } = useToast();

  const sendResetCode = async () => {
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setCodeSent(true);
      toast({
        title: "Code sent",
        description: `We emailed a reset code to ${email}.`,
      });
    } catch (error) {
      console.error("Password reset request error:", error);
      setError(
        getClerkErrorMessage({
          error,
          fallback: "Could not send a reset code. Please try again.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetCode();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });

        toast({
          title: "Password reset",
          description: "Your password has been updated and you are now logged in.",
          variant: "success",
        });

        setTimeout(() => {
          window.location.href = "/overview";
        }, 1500);
      } else if (result.status === "needs_second_factor") {
        setError(
          "Your password was reset, but your account requires two-factor authentication. Please log in with your new password.",
        );
      } else {
        setError("Could not reset your password. Please try again.");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setError(
        getClerkErrorMessage({
          error,
          fallback: "Could not reset your password. Please try again.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            {codeSent
              ? `Enter the code sent to ${email} and choose a new password`
              : "Enter your email and we will send you a reset code"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codeSent ? (
            <form onSubmit={handleResetPassword}>
              <div className="grid gap-6">
                {error && (
                  <div className="text-sm text-red-500 text-center">
                    {error}
                  </div>
                )}
                <div className="grid gap-3">
                  <Label htmlFor="reset-code">Reset code</Label>
                  <Input
                    id="reset-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  id="reset-password-btn"
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Reset password"}
                </Button>
                <div className="text-center text-sm">
                  Didn&apos;t get a code?{" "}
                  <Button
                    id="resend-reset-code-btn"
                    type="button"
                    variant="link"
                    className="h-auto p-0 underline underline-offset-4"
                    onClick={sendResetCode}
                    disabled={isLoading}
                  >
                    Resend
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendCode}>
              <div className="grid gap-6">
                {error && (
                  <div className="text-sm text-red-500 text-center">
                    {error}
                  </div>
                )}
                <div className="grid gap-3">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button
                  id="send-reset-code-btn"
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Send reset code"}
                </Button>
              </div>
            </form>
          )}
          <div className="mt-6 text-center text-sm">
            <Link
              id="back-to-login-link"
              href="/sign-in"
              className="underline underline-offset-4"
            >
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
