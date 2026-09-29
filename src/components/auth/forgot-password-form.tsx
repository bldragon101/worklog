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
import type { SignInSecondFactor } from "@clerk/nextjs/types";
import { useToast } from "@/hooks/use-toast";

type ResetStep = "request" | "reset" | "second-factor";

type SecondFactorStrategy = "totp" | "phone_code" | "email_code" | "backup_code";

type CodeSecondFactor = Extract<
  SignInSecondFactor,
  { strategy: SecondFactorStrategy }
>;

const secondFactorPreference: SecondFactorStrategy[] = [
  "totp",
  "phone_code",
  "email_code",
  "backup_code",
];

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

/**
 * Reports whether Clerk rejected the request because no account uses the identifier.
 */
function isIdentifierNotFoundError({ error }: { error: unknown }) {
  return (
    isClerkAPIResponseError(error) &&
    error.errors.some(({ code }) => code === "form_identifier_not_found")
  );
}

/**
 * Returns the code-based second factors Clerk offers, in order of preference.
 */
function getCodeSecondFactors({
  factors,
}: {
  factors: SignInSecondFactor[] | null;
}) {
  return (factors ?? [])
    .filter((factor): factor is CodeSecondFactor =>
      secondFactorPreference.some((strategy) => strategy === factor.strategy),
    )
    .sort(
      (a, b) =>
        secondFactorPreference.indexOf(a.strategy) -
        secondFactorPreference.indexOf(b.strategy),
    );
}

/**
 * Describes where the user will find the code for the given second factor.
 */
function getSecondFactorDescription({ factor }: { factor: CodeSecondFactor }) {
  switch (factor.strategy) {
    case "totp":
      return "Enter the code from your authenticator app to finish logging in";
    case "backup_code":
      return "Enter one of your backup codes to finish logging in";
    default:
      return `Enter the code sent to ${factor.safeIdentifier} to finish logging in`;
  }
}

/**
 * Labels the button that switches to the given second factor.
 */
function getSecondFactorSwitchLabel({ factor }: { factor: CodeSecondFactor }) {
  switch (factor.strategy) {
    case "totp":
      return "Use your authenticator app instead";
    case "backup_code":
      return "Use a backup code instead";
    default:
      return `Send a code to ${factor.safeIdentifier} instead`;
  }
}

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<ResetStep>("request");
  const [accountFound, setAccountFound] = useState(true);
  const [secondFactors, setSecondFactors] = useState<CodeSecondFactor[]>([]);
  const [secondFactor, setSecondFactor] = useState<CodeSecondFactor | null>(
    null,
  );
  const [secondFactorCode, setSecondFactorCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { signIn, isLoaded } = useSignIn();
  const { setActive } = useClerk();
  const { toast } = useToast();

  const showResetStep = ({ found }: { found: boolean }) => {
    setAccountFound(found);
    setStep("reset");
    toast({
      title: "Check your email",
      description: `If an account exists for ${email}, we have emailed a reset code.`,
    });
  };

  const sendResetCode = async () => {
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      showResetStep({ found: true });
    } catch (error) {
      if (isIdentifierNotFoundError({ error })) {
        showResetStep({ found: false });
        return;
      }
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

  const completeSignIn = async ({
    sessionId,
  }: {
    sessionId: string | null;
  }) => {
    await setActive({ session: sessionId });

    toast({
      title: "Password reset",
      description: "Your password has been updated and you are now logged in.",
      variant: "success",
    });

    setTimeout(() => {
      window.location.href = "/overview";
    }, 1500);
  };

  const prepareSecondFactor = async ({
    factor,
  }: {
    factor: CodeSecondFactor;
  }) => {
    if (!isLoaded) return;

    if (factor.strategy === "phone_code") {
      await signIn.prepareSecondFactor({
        strategy: "phone_code",
        phoneNumberId: factor.phoneNumberId,
      });
    } else if (factor.strategy === "email_code") {
      await signIn.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
    }
  };

  const startSecondFactor = async ({
    factors,
  }: {
    factors: SignInSecondFactor[] | null;
  }) => {
    const codeFactors = getCodeSecondFactors({ factors });
    const [preferredFactor] = codeFactors;
    if (!preferredFactor) {
      setError(
        "Your password was reset, but your account requires a verification method that is not supported here. Please contact an administrator.",
      );
      return;
    }

    setSecondFactors(codeFactors);
    setSecondFactor(preferredFactor);
    setSecondFactorCode("");
    setStep("second-factor");
    await prepareSecondFactor({ factor: preferredFactor });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!accountFound) {
      setError("Incorrect code. Please check the code and try again.");
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
        await completeSignIn({ sessionId: result.createdSessionId });
      } else if (
        result.status === "needs_second_factor" ||
        result.status === "needs_client_trust"
      ) {
        await startSecondFactor({ factors: result.supportedSecondFactors });
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

  const handleVerifySecondFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !secondFactor) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: secondFactor.strategy,
        code: secondFactorCode,
      });

      if (result.status === "complete") {
        await completeSignIn({ sessionId: result.createdSessionId });
      } else {
        setError("Could not verify your code. Please try again.");
      }
    } catch (error) {
      console.error("Second factor verification error:", error);
      setError(
        getClerkErrorMessage({
          error,
          fallback: "Could not verify your code. Please try again.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectSecondFactor = async ({
    factor,
  }: {
    factor: CodeSecondFactor;
  }) => {
    setIsLoading(true);
    setError("");

    try {
      await prepareSecondFactor({ factor });
      setSecondFactor(factor);
      setSecondFactorCode("");
    } catch (error) {
      console.error("Second factor preparation error:", error);
      setError(
        getClerkErrorMessage({
          error,
          fallback: "Could not send a verification code. Please try again.",
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const alternativeSecondFactors = secondFactors.filter(
    (factor) => factor !== secondFactor,
  );
  const canResendSecondFactor =
    secondFactor?.strategy === "phone_code" ||
    secondFactor?.strategy === "email_code";

  const descriptions: Record<ResetStep, string> = {
    request: "Enter your email and we will send you a reset code",
    reset: `Enter the code sent to ${email} and choose a new password`,
    "second-factor": secondFactor
      ? getSecondFactorDescription({ factor: secondFactor })
      : "",
  };

  const errorMessage = error && (
    <div className="text-sm text-red-500 text-center">{error}</div>
  );

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === "second-factor"
              ? "Verify your identity"
              : "Reset your password"}
          </CardTitle>
          <CardDescription>{descriptions[step]}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "second-factor" && secondFactor && (
            <form onSubmit={handleVerifySecondFactor}>
              <div className="grid gap-6">
                {errorMessage}
                <div className="grid gap-3">
                  <Label htmlFor="second-factor-code">
                    {secondFactor.strategy === "backup_code"
                      ? "Backup code"
                      : "Verification code"}
                  </Label>
                  <Input
                    id="second-factor-code"
                    inputMode={
                      secondFactor.strategy === "backup_code"
                        ? "text"
                        : "numeric"
                    }
                    autoComplete="one-time-code"
                    value={secondFactorCode}
                    onChange={(e) => setSecondFactorCode(e.target.value)}
                    required
                  />
                </div>
                <Button
                  id="verify-second-factor-btn"
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Verify"}
                </Button>
                {canResendSecondFactor && (
                  <div className="text-center text-sm">
                    Didn&apos;t get a code?{" "}
                    <Button
                      id="resend-second-factor-code-btn"
                      type="button"
                      variant="link"
                      className="h-auto p-0 underline underline-offset-4"
                      onClick={() =>
                        selectSecondFactor({ factor: secondFactor })
                      }
                      disabled={isLoading}
                    >
                      Resend
                    </Button>
                  </div>
                )}
                {alternativeSecondFactors.length > 0 && (
                  <div className="flex flex-col items-center gap-2 text-sm">
                    {alternativeSecondFactors.map((factor, index) => (
                      <Button
                        key={`${factor.strategy}-${index}`}
                        id={`use-second-factor-${index}-btn`}
                        type="button"
                        variant="link"
                        className="h-auto p-0 underline underline-offset-4"
                        onClick={() => selectSecondFactor({ factor })}
                        disabled={isLoading}
                      >
                        {getSecondFactorSwitchLabel({ factor })}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </form>
          )}
          {step === "reset" && (
            <form onSubmit={handleResetPassword}>
              <div className="grid gap-6">
                {errorMessage}
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
          )}
          {step === "request" && (
            <form onSubmit={handleSendCode}>
              <div className="grid gap-6">
                {errorMessage}
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
