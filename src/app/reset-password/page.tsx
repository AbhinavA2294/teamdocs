
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function initializeRecovery() {
      try {
        // Handle links with a PKCE authorization code.
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;

          if (mounted) setRecoveryReady(true);
          window.history.replaceState({}, "", "/reset-password");
        }

        // Handle older implicit recovery links.
        const fragment = new URLSearchParams(
          window.location.hash.substring(1)
        );

        const linkError =
          params.get("error_description") ||
          fragment.get("error_description");

        if (linkError) {
          throw new Error(linkError.replace(/\+/g, " "));
        }

        // Only treat a PASSWORD_RECOVERY event as proof
        // that a recovery link was processed.
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Invalid or expired recovery link."
          );
        }
      } finally {
        if (mounted) setChecking(false);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setError("");
        setChecking(false);
      }
    });

    void initializeRecovery();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!recoveryReady) {
      setError("Please use a valid password recovery link.");
      return;
    }

    if (password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({ password });

      if (updateError) throw updateError;

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error("Sign-out after password reset:", signOutError);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6 text-gray-900">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-3xl font-bold text-blue-700">
          TeamDocs
        </h1>

        <h2 className="mb-3 text-xl font-semibold">
          Reset Password
        </h2>

        {success ? (
          <div role="status">
            <p className="mb-4 text-green-700">
              Your password has been updated successfully.
            </p>
            <Link
              href="/"
              className="font-medium text-blue-600 hover:underline"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {checking ? (
              <p className="text-sm text-gray-600">
                Verifying your password reset link...
              </p>
            ) : !recoveryReady ? (
              <div>
                <p className="text-sm text-gray-600">
                  Your reset link may be invalid or expired.
                  Request a new password reset email.
                </p>
                <Link
                  href="/forgot-password"
                  className="mt-4 inline-block text-blue-600 hover:underline"
                >
                  Request a new reset link
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm font-medium"
                  >
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-sm font-medium"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}