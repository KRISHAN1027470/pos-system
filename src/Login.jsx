import { useState } from "react";
import {
  LockKeyhole,
  Mail,
  ShoppingCart,
  Eye,
  EyeOff,
  UserRound,
} from "lucide-react";
import { supabase } from "./supabase";
import "./Login.css";

export default function Login() {
  const [mode, setMode] = useState("signin");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function changeMode(nextMode) {
    if (loading) return;

    setMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleSignIn(event) {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage("Enter your email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      if (!data?.user?.id || !data?.session) {
        throw new Error("Unable to establish the signed-in session.");
      }

      // App.jsx owns profile loading, account status, and business onboarding.
      // Login.jsx must not sign out a valid session while App.jsx is loading it.
    } catch (error) {
      setErrorMessage(error.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Enter your email address first.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) throw error;

      setSuccessMessage(
        "If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder."
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to send password reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage("Enter your full name.");
      return;
    }

    if (!cleanEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
          },
        },
      });

      if (error) throw error;

      if (!data?.user?.id) {
        throw new Error("Unable to create the account.");
      }

      if (data?.session) {
        // Keep the new business owner's session alive.
        // App.jsx will take this user directly to Set Up Your Business.
        return;
      }

      setSuccessMessage(
        "Account created. Please complete email verification, then sign in to set up your business."
      );

      setFullName("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      setErrorMessage(error.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-background-shape login-shape-one" />
      <div className="login-background-shape login-shape-two" />

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <ShoppingCart size={26} />
          </div>

          <div>
            <h1>Point Of Sale</h1>
            <p>Point of Sale Management System</p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            padding: "5px",
            borderRadius: "12px",
            background: "#f2f4f7",
            marginBottom: "22px",
          }}
        >
          <button
            type="button"
            onClick={() => changeMode("signin")}
            disabled={loading}
            style={{
              border: 0,
              borderRadius: "9px",
              padding: "10px 12px",
              cursor: "pointer",
              fontWeight: 700,
              background: mode === "signin" ? "#fff" : "transparent",
              boxShadow:
                mode === "signin" ? "0 1px 4px rgba(16,24,40,.10)" : "none",
              color: mode === "signin" ? "#101828" : "#667085",
            }}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => changeMode("signup")}
            disabled={loading}
            style={{
              border: 0,
              borderRadius: "9px",
              padding: "10px 12px",
              cursor: "pointer",
              fontWeight: 700,
              background: mode === "signup" ? "#fff" : "transparent",
              boxShadow:
                mode === "signup" ? "0 1px 4px rgba(16,24,40,.10)" : "none",
              color: mode === "signup" ? "#101828" : "#667085",
            }}
          >
            Sign Up
          </button>
        </div>

        <div className="login-heading">
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p>
            {mode === "signin"
              ? "Sign in to continue to your business dashboard."
              : "Create your LE POS owner account and set up your business."}
          </p>
        </div>

        <form
          onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
          className="login-form"
        >
          {mode === "signup" && (
            <label>
              Full name
              <div className="login-input-wrap">
                <UserRound size={18} />
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  disabled={loading}
                  required
                />
              </div>
            </label>
          )}

          <label>
            Email address
            <div className="login-input-wrap">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>
          </label>

          <label>
            Password
            <div className="login-input-wrap">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode === "signup"
                    ? "Minimum 6 characters"
                    : "Enter your password"
                }
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                disabled={loading}
                required
                minLength={mode === "signup" ? 6 : undefined}
              />

              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                tabIndex={-1}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {mode === "signin" && (
            <div style={{ textAlign: "right", marginTop: "-8px" }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  color: "#2563eb",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          {mode === "signup" && (
            <label>
              Confirm password
              <div className="login-input-wrap">
                <LockKeyhole size={18} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                  minLength={6}
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  tabIndex={-1}
                  title={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>
          )}

          {errorMessage && (
            <div className="login-error">{errorMessage}</div>
          )}

          {successMessage && (
            <div
              style={{
                padding: "11px 12px",
                borderRadius: "9px",
                background: "#ecfdf3",
                border: "1px solid #abefc6",
                color: "#067647",
                fontSize: "14px",
                lineHeight: 1.45,
              }}
            >
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div className="login-footer">
          {mode === "signin"
            ? "Authorized users only"
            : "Create a new business owner account"}
        </div>
      </div>
    </div>
  );
}
