import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  attemptFirstFactor: vi.fn(),
  prepareSecondFactor: vi.fn(),
  attemptSecondFactor: vi.fn(),
  setActive: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@clerk/nextjs/legacy", () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      create: mocks.create,
      attemptFirstFactor: mocks.attemptFirstFactor,
      prepareSecondFactor: mocks.prepareSecondFactor,
      attemptSecondFactor: mocks.attemptSecondFactor,
    },
  }),
}));

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ setActive: mocks.setActive }),
}));

vi.mock("@clerk/nextjs/errors", () => ({
  isClerkAPIResponseError: (error: unknown) =>
    typeof error === "object" && error !== null && "clerkError" in error,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    href,
    id,
  }: {
    children: React.ReactNode;
    href: string;
    id?: string;
  }) {
    return (
      <a href={href} id={id}>
        {children}
      </a>
    );
  },
}));

async function requestCode({ email }: { email: string }) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));
  await screen.findByLabelText("Reset code");
}

function fillResetForm({
  code,
  password,
  confirmPassword,
}: {
  code: string;
  password: string;
  confirmPassword: string;
}) {
  fireEvent.change(screen.getByLabelText("Reset code"), {
    target: { value: code },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: confirmPassword },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
}

async function resetPassword() {
  render(<ForgotPasswordForm />);
  await requestCode({ email: "driver@example.com" });
  fillResetForm({
    code: "123456",
    password: "new-password-1",
    confirmPassword: "new-password-1",
  });
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ status: "needs_first_factor" });
  });

  it("sends a reset code to the entered email", async () => {
    render(<ForgotPasswordForm />);

    await requestCode({ email: "driver@example.com" });

    expect(mocks.create).toHaveBeenCalledWith({
      strategy: "reset_password_email_code",
      identifier: "driver@example.com",
    });
    expect(
      screen.getByText(/Enter the code sent to driver@example.com/),
    ).toBeInTheDocument();
  });

  it("shows the Clerk error message when the code cannot be sent", async () => {
    mocks.create.mockRejectedValue({
      clerkError: true,
      errors: [
        {
          code: "too_many_requests",
          message: "Too many requests",
          longMessage: "Too many requests. Please try again later.",
        },
      ],
    });
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "driver@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));

    expect(
      await screen.findByText("Too many requests. Please try again later."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Reset code")).not.toBeInTheDocument();
  });

  it("does not reveal whether an account exists for the email", async () => {
    mocks.create.mockRejectedValue({
      clerkError: true,
      errors: [
        {
          code: "form_identifier_not_found",
          message: "not found",
          longMessage: "Couldn't find your account.",
        },
      ],
    });
    render(<ForgotPasswordForm />);

    await requestCode({ email: "nobody@example.com" });

    expect(
      screen.queryByText("Couldn't find your account."),
    ).not.toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Check your email",
      description:
        "If an account exists for nobody@example.com, we have emailed a reset code.",
    });

    fillResetForm({
      code: "123456",
      password: "new-password-1",
      confirmPassword: "new-password-1",
    });

    expect(
      await screen.findByText(
        "Incorrect code. Please check the code and try again.",
      ),
    ).toBeInTheDocument();
    expect(mocks.attemptFirstFactor).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling Clerk", async () => {
    render(<ForgotPasswordForm />);
    await requestCode({ email: "driver@example.com" });

    fillResetForm({
      code: "123456",
      password: "new-password-1",
      confirmPassword: "new-password-2",
    });

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(mocks.attemptFirstFactor).not.toHaveBeenCalled();
  });

  it("resets the password and activates the new session", async () => {
    mocks.attemptFirstFactor.mockResolvedValue({
      status: "complete",
      createdSessionId: "sess_123",
    });

    await resetPassword();

    await waitFor(() =>
      expect(mocks.setActive).toHaveBeenCalledWith({ session: "sess_123" }),
    );
    expect(mocks.attemptFirstFactor).toHaveBeenCalledWith({
      strategy: "reset_password_email_code",
      code: "123456",
      password: "new-password-1",
    });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password reset", variant: "success" }),
    );
  });

  it("completes recovery with an authenticator app code", async () => {
    mocks.attemptFirstFactor.mockResolvedValue({
      status: "needs_second_factor",
      supportedSecondFactors: [
        { strategy: "backup_code" },
        { strategy: "totp" },
      ],
    });
    mocks.attemptSecondFactor.mockResolvedValue({
      status: "complete",
      createdSessionId: "sess_456",
    });

    await resetPassword();

    expect(
      await screen.findByText(/code from your authenticator app/),
    ).toBeInTheDocument();
    expect(mocks.prepareSecondFactor).not.toHaveBeenCalled();
    expect(mocks.setActive).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(mocks.setActive).toHaveBeenCalledWith({ session: "sess_456" }),
    );
    expect(mocks.attemptSecondFactor).toHaveBeenCalledWith({
      strategy: "totp",
      code: "654321",
    });
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Password reset", variant: "success" }),
    );
  });

  it("sends an SMS code for phone second factors and accepts a backup code", async () => {
    mocks.attemptFirstFactor.mockResolvedValue({
      status: "needs_second_factor",
      supportedSecondFactors: [
        { strategy: "backup_code" },
        {
          strategy: "phone_code",
          phoneNumberId: "idn_phone",
          safeIdentifier: "+61******789",
        },
      ],
    });
    mocks.attemptSecondFactor.mockResolvedValue({
      status: "complete",
      createdSessionId: "sess_789",
    });

    await resetPassword();

    expect(
      await screen.findByText(/code sent to \+61\*{6}789/),
    ).toBeInTheDocument();
    expect(mocks.prepareSecondFactor).toHaveBeenCalledWith({
      strategy: "phone_code",
      phoneNumberId: "idn_phone",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Use a backup code instead" }),
    );
    fireEvent.change(await screen.findByLabelText("Backup code"), {
      target: { value: "backup-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(mocks.setActive).toHaveBeenCalledWith({ session: "sess_789" }),
    );
    expect(mocks.attemptSecondFactor).toHaveBeenCalledWith({
      strategy: "backup_code",
      code: "backup-1",
    });
  });

  it("shows the Clerk error when the second factor code is wrong", async () => {
    mocks.attemptFirstFactor.mockResolvedValue({
      status: "needs_second_factor",
      supportedSecondFactors: [{ strategy: "totp" }],
    });
    mocks.attemptSecondFactor.mockRejectedValue({
      clerkError: true,
      errors: [
        {
          code: "form_code_incorrect",
          message: "is incorrect",
          longMessage: "Incorrect code",
        },
      ],
    });

    await resetPassword();

    fireEvent.change(await screen.findByLabelText("Verification code"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Incorrect code")).toBeInTheDocument();
    expect(mocks.setActive).not.toHaveBeenCalled();
  });

  it("explains when no supported second factor is available", async () => {
    mocks.attemptFirstFactor.mockResolvedValue({
      status: "needs_second_factor",
      supportedSecondFactors: [],
    });

    await resetPassword();

    expect(
      await screen.findByText(/verification method that is not supported/),
    ).toBeInTheDocument();
    expect(mocks.setActive).not.toHaveBeenCalled();
  });

  it("resends the code from the second step", async () => {
    render(<ForgotPasswordForm />);
    await requestCode({ email: "driver@example.com" });

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  });
});
