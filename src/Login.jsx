import { useState } from "react";
import {
  LockKeyhole,
  Mail,
  ShoppingCart,
  Eye,
  EyeOff,
  UserRound,
  BarChart3,
  Boxes,
  Users,
  ShieldCheck,
  Headphones,
  ArrowRight,
  Sparkles,
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
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <div className="login-orb login-orb-three" />

      <main className="login-shell">
        <section className="login-showcase">
          <div className="showcase-grid" />

          <div className="showcase-top">
            <div className="showcase-brand">
              <div className="showcase-logo">
                <ShoppingCart size={28} strokeWidth={2.2} />
              </div>
              <div>
                <strong>Point of Sales</strong>
                <span>Business Management Suite</span>
              </div>
            </div>

            <div className="showcase-badge">
              <span className="live-dot" />
              Secure cloud POS
            </div>
          </div>

          <div className="showcase-content">
            <div className="eyebrow">
              <Sparkles size={15} />
              Built for modern businesses
            </div>

            <h1>
              Run your business
              <span> smarter, every day.</span>
            </h1>

            <p>
              Sales, inventory, customers, branches and business insights in one
              secure point-of-sale platform.
            </p>

            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon"><ShoppingCart size={20} /></div>
                <div>
                  <strong>Fast Sales</strong>
                  <span>Simple and efficient checkout</span>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon"><Boxes size={20} /></div>
                <div>
                  <strong>Live Inventory</strong>
                  <span>Stay on top of your stock</span>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon"><Users size={20} /></div>
                <div>
                  <strong>Customers</strong>
                  <span>Keep customer records organized</span>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon"><BarChart3 size={20} /></div>
                <div>
                  <strong>Business Reports</strong>
                  <span>Understand performance quickly</span>
                </div>
              </div>
            </div>

            <div className="security-note">
              <ShieldCheck size={20} />
              <div>
                <strong>Secure business access</strong>
                <span>Your account is protected by secure authentication.</span>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <Headphones size={17} />
            <span>Need help?</span>
            <a href="tel:+94769696491">076 969 6491</a>
          </div>
        </section>

        <section className="login-panel">
          <div className="mobile-brand">
            <div className="mobile-brand-logo">
              <ShoppingCart size={24} />
            </div>
            <div>
              <strong>Point of Sales</strong>
              <span>Point of Sale Management System</span>
            </div>
          </div>

          <div className="login-card">
            <div className="login-card-head">
              <div className="login-mini-badge">
                <ShieldCheck size={15} />
                Secure access
              </div>
              <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
              <p>
                {mode === "signin"
                  ? "Sign in to access your business workspace."
                  : "Create your owner account and start setting up your business."}
              </p>
            </div>

            <div className="login-tabs" role="tablist" aria-label="Authentication">
              <button
                type="button"
                className={mode === "signin" ? "active" : ""}
                onClick={() => changeMode("signin")}
                disabled={loading}
              >
                Sign In
              </button>
              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => changeMode("signup")}
                disabled={loading}
              >
                Sign Up
              </button>
            </div>

            <form
              onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
              className="login-form"
            >
              {mode === "signup" && (
                <label>
                  <span className="field-label">Full name</span>
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
                <span className="field-label">Email address</span>
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
                <span className="field-label">Password</span>
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
                <div className="forgot-row">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="forgot-button"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === "signup" && (
                <label>
                  <span className="field-label">Confirm password</span>
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
                <div className="login-success">{successMessage}</div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >
                <span>
                  {loading
                    ? mode === "signin"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "signin"
                    ? "Sign In"
                    : "Create Account"}
                </span>
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="login-footer">
              <ShieldCheck size={14} />
              {mode === "signin"
                ? "Authorized users only · Secure access"
                : "Create a new business owner account"}
            </div>

            <div className="mobile-support">
              <span>Need help with Point of Sales?</span>
              <a href="tel:+94769696491">076 969 6491</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
