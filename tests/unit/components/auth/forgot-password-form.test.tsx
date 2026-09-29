import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  attemptFirstFactor: vi.fn(),
  setActive: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@clerk/nextjs/legacy", () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      create: mocks.create,
      attemptFirstFactor: mocks.attemptFirstFactor,
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
      errors: [{ message: "not found", longMessage: "Couldn't find your account." }],
    });
    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "nobody@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));

    expect(
      await screen.findByText("Couldn't find your account."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Reset code")).not.toBeInTheDocument();
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
    render(<ForgotPasswordForm />);
    await requestCode({ email: "driver@example.com" });

    fillResetForm({
      code: "123456",
      password: "new-password-1",
      confirmPassword: "new-password-1",
    });

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

  it("asks the user to log in when two-factor authentication is required", async () => {
    mocks.attemptFirstFactor.mockResolvedValue({
      status: "needs_second_factor",
    });
    render(<ForgotPasswordForm />);
    await requestCode({ email: "driver@example.com" });

    fillResetForm({
      code: "123456",
      password: "new-password-1",
      confirmPassword: "new-password-1",
    });

    expect(
      await screen.findByText(/requires two-factor authentication/),
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
