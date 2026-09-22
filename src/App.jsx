import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  ReceiptText,
  Users,
  UserCog,
  Package,
  Building2,
  Boxes,
  BarChart3,
  CreditCard,
  ClipboardList,
  BookOpen,
  Settings as SettingsIcon,
  Menu,
  LogOut,
  ShieldCheck,
  Truck,
  KeyRound,
  Plus,
} from "lucide-react";

import Customers from "./Customers";
import Suppliers from "./Suppliers";
import Purchases from "./Purchases";
import Cashiers from "./Cashiers";
import Items from "./Items";
import Invoices from "./Invoices";
import POS from "./POS";
import Quotes from "./Quotes";
import Branches from "./Branches";
import StockManagement from "./StockManagement";
import Reports from "./Reports";
import Dashboard from "./Dashboard";
import Billing from "./Billing";
import Subscription from "./Subscription";
import SubscriptionAdmin from "./SubscriptionAdmin";
import AuditLogs from "./AuditLogs";
import HowTo from "./HowTo";
import Settings from "./Settings";
import UserManagement from "./UserManagement";
import Login from "./Login";
import PublicInvoice from "./PublicInvoice";
import { supabase } from "./supabase";

import "./App.css";

const MENU_ITEMS = [
  { name: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Invoices", icon: FileText, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "POS", icon: ShoppingCart, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Quotes", icon: ReceiptText, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Customers", icon: Users, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Suppliers", icon: Truck, roles: ["ADMIN", "MANAGER"] },
  { name: "Purchases", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Cashiers", icon: Users, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Items", icon: Package, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Branches", icon: Building2, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Stock Management", icon: Boxes, roles: ["ADMIN", "MANAGER"] },
  { name: "Reports", icon: BarChart3, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Billing", icon: CreditCard, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "Subscription", icon: CreditCard, roles: ["ADMIN"] },
  { name: "Audit Logs", icon: ClipboardList, roles: ["ADMIN", "CASHIER"] },
  { name: "How To", icon: BookOpen, roles: ["ADMIN", "MANAGER", "CASHIER"] },
  { name: "User Management", icon: UserCog, roles: ["ADMIN"] },
  { name: "Settings", icon: SettingsIcon, roles: ["ADMIN", "CASHIER"] },
];

function PrivateApp() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [companyName, setCompanyName] = useState("Point of Sales");
  const [businessSetup, setBusinessSetup] = useState({
    company_name: "",
    address: "",
    phone: "",
    vat_number: "",
    registration_number: "",
  });
  const [businessSetupSaving, setBusinessSetupSaving] = useState(false);
  const [businessSetupError, setBusinessSetupError] = useState("");
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchPassword, setBranchPassword] = useState("");
  const [branchError, setBranchError] = useState("");
  const [pendingBranch, setPendingBranch] = useState(null);
  const [branchRefreshKey, setBranchRefreshKey] = useState(0);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [createBranchSaving, setCreateBranchSaving] = useState(false);
  const [createBranchError, setCreateBranchError] = useState("");
  const [newBranch, setNewBranch] = useState({
    branch_code: "",
    branch_name: "",
    address: "",
    phone: "",
    email: "",
    vat_number: "",
    password: "",
    confirm_password: "",
  });

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      setAuthLoading(true);

      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Session error:", error);
      }

      setSession(currentSession || null);

      if (currentSession?.user) {
        await loadProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }

      if (mounted) setAuthLoading(false);
    }

    initializeAuth();



    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession || null);

      if (newSession?.user) {
        // Do not await another Supabase request inside onAuthStateChange.
        // Running it on the next tick avoids the Supabase auth lock/deadlock.
        setTimeout(() => {
          loadProfile(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setProfileLoading(false);
        setActiveMenu("Dashboard");
      }

      setAuthLoading(false);
    });

    function handleSettingsSaved(event) {
      const nextName = event?.detail?.company_name?.trim();

      if (nextName) {
        setCompanyName(nextName);
      }
    }

    window.addEventListener("app-settings-saved", handleSettingsSaved);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("app-settings-saved", handleSettingsSaved);
    };
  }, []);

  async function loadProfile(userId) {
    setProfileLoading(true);
    setProfileError("");

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role, branch_id, status, company_id")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Profile load error:", error);
        setProfile(null);
        setProfileError(error.message);
        return;
      }

      if (!data) {
        setProfile(null);
        setProfileError("No user profile was found for this account.");
        return;
      }

      setProfile(data);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.user?.id || !profile?.company_id) {
      setSubscription(null);
      setSubscriptionError("");
      return;
    }

    let cancelled = false;

    async function loadSubscriptionAccess() {
      setSubscriptionLoading(true);
      setSubscriptionError("");

      try {
        const { data, error } = await supabase.rpc("get_my_subscription_access");

        if (error) throw error;
        if (cancelled) return;

        setSubscription(data || null);

        const { data: platformAdminData, error: platformAdminError } =
          await supabase.rpc("is_platform_admin");

        if (!cancelled) {
          if (platformAdminError) {
            console.error("Platform admin check error:", platformAdminError);
            setIsPlatformAdmin(false);
          } else {
            setIsPlatformAdmin(platformAdminData === true);
          }
        }

        if (!data?.success) {
          setSubscriptionError(
            data?.message || "Unable to verify your subscription."
          );
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Subscription check error:", error);
        setSubscription(null);
        setSubscriptionError(
          error.message || "Unable to verify your subscription."
        );
      } finally {
        if (!cancelled) setSubscriptionLoading(false);
      }
    }

    loadSubscriptionAccess();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, profile?.company_id]);

  useEffect(() => {
    async function loadPosSidebarName() {
      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from("app_settings")
        .select("company_name")
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (error) {
        console.error("POS / Sidebar name load error:", error);
        return;
      }

      if (data?.company_name?.trim()) {
        setCompanyName(data.company_name.trim());
      } else {
        setCompanyName("Point of Sales");
      }
    }

    loadPosSidebarName();
  }, [profile?.company_id]);

  const allowedMenuItems = useMemo(() => {
    if (!profile?.role) return [];

    const items = MENU_ITEMS.filter((item) =>
      item.roles.includes(profile.role)
    );

    if (isPlatformAdmin) {
      items.push({
        name: "Subscription Management",
        icon: ShieldCheck,
        roles: ["ADMIN"],
      });
    }

    return items;
  }, [profile?.role, isPlatformAdmin]);

  useEffect(() => {
    if (!profile?.role) return;

    const currentAllowed = allowedMenuItems.some(
      (item) => item.name === activeMenu
    );

    if (!currentAllowed) {
      setActiveMenu(allowedMenuItems[0]?.name || "Dashboard");
    }
  }, [profile, allowedMenuItems, activeMenu]);

  useEffect(() => {
    if (!session?.user || !profile?.company_id) {
      setBranches([]);
      setActiveBranch(null);
      setPendingBranch(null);
      return;
    }

    loadBranches();
  }, [session?.user?.id, profile?.id, profile?.company_id, branchRefreshKey]);

  async function loadBranches() {
    setBranchLoading(true);

    const { data, error } = await supabase
      .from("branches")
      .select("id, branch_code, branch_name, status, branch_password_hash, company_id")
      .eq("company_id", profile.company_id)
      .eq("status", "ACTIVE")
      .order("branch_code", { ascending: true });

    if (error) {
      console.error("Branches load error:", error);
      setBranchError(error.message || "Unable to load branches.");
      setBranchLoading(false);
      return;
    }

    const rows = data || [];
    setBranches(rows);

    const storedId = sessionStorage.getItem("lepos_active_branch_id");
    const storedBranch = rows.find((branch) => branch.id === storedId);

    if (storedBranch) {
      setActiveBranch(storedBranch);
    } else {
      setActiveBranch(null);
      sessionStorage.removeItem("lepos_active_branch_id");
    }

    setBranchLoading(false);
  }

  function refreshBranches() {
    setBranchRefreshKey((key) => key + 1);
  }

  function requestBranchUnlock(branch) {
    if (!branch) return;

    // If this branch is already active, there is nothing to switch.
    if (activeBranch?.id === branch.id) {
      return;
    }

    setPendingBranch(branch);
    setBranchPassword("");
    setBranchError("");
  }

  function requestBranchSwitch(branchId) {
    if (!branchId) return;

    const branch = branches.find((item) => item.id === branchId);

    if (!branch) {
      setBranchError("Branch not found.");
      return;
    }

    requestBranchUnlock(branch);
  }

  function closeBranchUnlock() {
    setPendingBranch(null);
    setBranchPassword("");
    setBranchError("");
  }

  async function unlockBranch(event) {
    event.preventDefault();

    if (!pendingBranch || !branchPassword) return;

    setBranchLoading(true);
    setBranchError("");

    try {
      const { data, error } = await supabase.rpc("verify_branch_password", {
        p_branch_id: pendingBranch.id,
        p_password: branchPassword,
      });

      if (error) throw error;

      if (!data?.success) {
        setBranchError(data?.message || "Incorrect branch password.");
        return;
      }

      const unlocked = branches.find((b) => b.id === pendingBranch.id) || pendingBranch;

      sessionStorage.setItem("lepos_active_branch_id", unlocked.id);
      setActiveBranch(unlocked);
      setPendingBranch(null);
      setBranchPassword("");
      setBranchError("");

      window.dispatchEvent(
        new CustomEvent("lepos-branch-changed", {
          detail: {
            branch_id: unlocked.id,
            branch_code: unlocked.branch_code,
            branch_name: unlocked.branch_name,
          },
        })
      );
    } catch (error) {
      console.error("Branch unlock error:", error);
      setBranchError(error.message || "Unable to unlock branch.");
    } finally {
      setBranchLoading(false);
    }
  }

  function openCreateBranch() {
    setCreateBranchError("");
    setNewBranch({
      branch_code: "",
      branch_name: "",
      address: "",
      phone: "",
      email: "",
      vat_number: "",
      password: "",
      confirm_password: "",
    });
    setShowCreateBranch(true);
  }

  function closeCreateBranch() {
    if (createBranchSaving) return;
    setShowCreateBranch(false);
    setCreateBranchError("");
  }

  function updateNewBranch(field, value) {
    setNewBranch((current) => ({ ...current, [field]: value }));
  }

  async function createBranchFromSelector(event) {
    event.preventDefault();
    setCreateBranchError("");

    const branchCode = newBranch.branch_code.trim().toUpperCase();
    const branchName = newBranch.branch_name.trim();
    const password = newBranch.password.trim();
    const confirmPassword = newBranch.confirm_password.trim();

    if (!branchCode || !branchName) {
      setCreateBranchError("Branch code and branch name are required.");
      return;
    }

    if (password.length < 4) {
      setCreateBranchError("Branch password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setCreateBranchError("Branch passwords do not match.");
      return;
    }

    setCreateBranchSaving(true);

    try {
      const { data: createdBranch, error: insertError } = await supabase
        .from("branches")
        .insert({
          branch_code: branchCode,
          branch_name: branchName,
          address: newBranch.address.trim() || null,
          phone: newBranch.phone.trim() || null,
          email: newBranch.email.trim() || null,
          vat_number: newBranch.vat_number.trim() || null,
          company_id: profile.company_id,
          status: "ACTIVE",
        })
        .select("id, branch_code, branch_name, status, branch_password_hash, company_id")
        .single();

      if (insertError) throw insertError;

      const { data: passwordResult, error: passwordError } = await supabase.rpc(
        "set_branch_password",
        {
          p_branch_id: createdBranch.id,
          p_password: password,
        }
      );

      if (passwordError || !passwordResult?.success) {
        // Keep the branch, but make the failure very clear so it is not
        // mistaken for a password-protected branch.
        throw new Error(
          passwordError?.message ||
            passwordResult?.message ||
            "Branch was created, but its password could not be configured."
        );
      }

      const { data: refreshedBranch, error: refreshError } = await supabase
        .from("branches")
        .select("id, branch_code, branch_name, status, branch_password_hash, company_id")
        .eq("id", createdBranch.id)
        .single();

      if (refreshError) throw refreshError;

      setBranches((current) =>
        [...current.filter((branch) => branch.id !== refreshedBranch.id), refreshedBranch].sort(
          (a, b) => String(a.branch_code).localeCompare(String(b.branch_code))
        )
      );

      setShowCreateBranch(false);
      setCreateBranchError("");
    } catch (error) {
      console.error("Create branch error:", error);
      setCreateBranchError(error.message || "Unable to create branch.");
      await loadBranches();
    } finally {
      setCreateBranchSaving(false);
    }
  }

  function updateBusinessSetup(field, value) {
    setBusinessSetup((current) => ({ ...current, [field]: value }));
  }

  async function createBusiness(event) {
    event.preventDefault();
    setBusinessSetupError("");

    const companyNameValue = businessSetup.company_name.trim();

    if (!companyNameValue) {
      setBusinessSetupError("Business / company name is required.");
      return;
    }

    setBusinessSetupSaving(true);

    try {
      const { data, error } = await supabase.rpc("create_new_business", {
        p_company_name: companyNameValue,
        p_address: businessSetup.address.trim() || null,
        p_phone: businessSetup.phone.trim() || null,
        p_vat_number: businessSetup.vat_number.trim() || null,
        p_registration_number:
          businessSetup.registration_number.trim() || null,
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to create business.");
      }

      setCompanyName(data.company_name || companyNameValue);
      sessionStorage.removeItem("lepos_active_branch_id");
      setActiveBranch(null);
      setBranches([]);
      setBusinessSetupError("");

      await loadProfile(session.user.id);
    } catch (error) {
      console.error("Business setup error:", error);
      setBusinessSetupError(
        error.message || "Unable to create your business."
      );
    } finally {
      setBusinessSetupSaving(false);
    }
  }

  async function handleLogout() {
    sessionStorage.removeItem("lepos_active_branch_id");
    setActiveBranch(null);
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
    }
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fb",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <ShieldCheck size={42} />
          <h2>Loading Point of Sales...</h2>
          <p>Checking your account and permissions.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (profileLoading || (!profile && !profileError)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fb",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <ShieldCheck size={42} />
          <h2>Loading your account...</h2>
          <p>Preparing your business profile.</p>
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fb",
          padding: "24px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            background: "#fff",
            borderRadius: "18px",
            padding: "28px",
            boxShadow: "0 12px 35px rgba(0,0,0,0.08)",
          }}
        >
          <h2>Account profile unavailable</h2>
          <p>{profileError || "Unable to load your user profile."}</p>
          <p>
            Make sure this Auth user has a matching row in{" "}
            <strong>user_profiles</strong>.
          </p>
          <button
            onClick={handleLogout}
            style={{
              marginTop: "12px",
              padding: "10px 16px",
              border: 0,
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!profile.company_id) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6f8fb", padding: "40px 20px", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <Building2 size={52} />
            <h1 style={{ marginBottom: "8px" }}>Set Up Your Business</h1>
            <p style={{ color: "#667085", margin: 0 }}>
              Create your shop or company first. This account will become the administrator of the new business.
            </p>
          </div>

          <form onSubmit={createBusiness} style={{ background: "#fff", borderRadius: "18px", padding: "28px", boxShadow: "0 12px 35px rgba(0,0,0,0.08)" }}>
            <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
              Business / Company Name *
              <input value={businessSetup.company_name} onChange={(e) => updateBusinessSetup("company_name", e.target.value)} placeholder="e.g. Krishan Super Mart" required style={{ padding: "12px 14px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
            </label>

            <label style={{ display: "grid", gap: "6px", fontWeight: 600, marginTop: "16px" }}>
              Address
              <input value={businessSetup.address} onChange={(e) => updateBusinessSetup("address", e.target.value)} placeholder="Business address" style={{ padding: "12px 14px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "16px" }}>
              <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                Phone
                <input value={businessSetup.phone} onChange={(e) => updateBusinessSetup("phone", e.target.value)} placeholder="Phone number" style={{ padding: "12px 14px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
              </label>

              <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                VAT Number
                <input value={businessSetup.vat_number} onChange={(e) => updateBusinessSetup("vat_number", e.target.value)} placeholder="VAT number" style={{ padding: "12px 14px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
              </label>
            </div>

            <label style={{ display: "grid", gap: "6px", fontWeight: 600, marginTop: "16px" }}>
              Business Registration Number
              <input value={businessSetup.registration_number} onChange={(e) => updateBusinessSetup("registration_number", e.target.value)} placeholder="Registration number" style={{ padding: "12px 14px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
            </label>

            {businessSetupError && (
              <div style={{ marginTop: "16px", background: "#fee2e2", color: "#b42318", padding: "12px 14px", borderRadius: "10px" }}>
                {businessSetupError}
              </div>
            )}

            <button type="submit" disabled={businessSetupSaving} style={{ width: "100%", marginTop: "22px", padding: "13px 18px", border: 0, borderRadius: "11px", background: "#111827", color: "#fff", cursor: businessSetupSaving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "16px" }}>
              {businessSetupSaving ? "Creating Business..." : "Create Business & Continue"}
            </button>

            <button type="button" onClick={handleLogout} disabled={businessSetupSaving} style={{ width: "100%", marginTop: "12px", padding: "10px", border: 0, background: "transparent", cursor: "pointer", textDecoration: "underline" }}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (subscriptionLoading || (!subscription && !subscriptionError)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fb",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <ShieldCheck size={42} />
          <h2>Checking subscription...</h2>
          <p>Verifying your Point of Sales access.</p>
        </div>
      </div>
    );
  }

  if (subscriptionError || !subscription?.success) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fb",
          padding: "24px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            background: "#fff",
            borderRadius: "18px",
            padding: "28px",
            boxShadow: "0 12px 35px rgba(0,0,0,0.08)",
          }}
        >
          <ShieldCheck size={42} />
          <h2>Unable to verify subscription</h2>
          <p style={{ color: "#667085" }}>
            {subscriptionError ||
              subscription?.message ||
              "Subscription verification failed."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "12px",
              marginRight: "10px",
              padding: "10px 16px",
              border: 0,
              borderRadius: "10px",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              marginTop: "12px",
              padding: "10px 16px",
              border: "1px solid #d0d5dd",
              borderRadius: "10px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!subscription.has_access) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6f8fb" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "14px 24px 0",
          }}
        >
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "9px 14px",
              border: "1px solid #d0d5dd",
              borderRadius: "9px",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Sign Out
          </button>
        </div>

        <Subscription
          subscription={subscription}
          onActivated={() => window.location.reload()}
        />
      </div>
    );
  }

  if (profile.status !== "ACTIVE") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fb",
          padding: "24px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            background: "#fff",
            borderRadius: "18px",
            padding: "28px",
            boxShadow: "0 12px 35px rgba(0,0,0,0.08)",
          }}
        >
          <h2>Account inactive</h2>
          <p>This user account has been disabled. Contact an administrator.</p>
          <button
            onClick={handleLogout}
            style={{
              marginTop: "12px",
              padding: "10px 16px",
              border: 0,
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (branchLoading && branches.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f8fb", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <Building2 size={42} />
          <h2>Loading branches...</h2>
        </div>
      </div>
    );
  }

  if (!activeBranch) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6f8fb", padding: "40px 20px", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <Building2 size={48} />
            <h1 style={{ marginBottom: "8px" }}>Select Branch</h1>
            <p style={{ color: "#667085" }}>Enter the selected branch password to open the POS system.</p>
          </div>

          {branchError && !pendingBranch && (
            <div style={{ background: "#fee2e2", padding: "12px 14px", borderRadius: "10px", marginBottom: "16px" }}>{branchError}</div>
          )}

          <div style={{ display: "grid", gap: "14px" }}>
            {branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => requestBranchUnlock(branch)}
                style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "20px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 8px 24px rgba(0,0,0,.05)" }}
              >
                <div>
                  <strong style={{ display: "block", fontSize: "17px" }}>{branch.branch_code} - {branch.branch_name}</strong>
                  <span style={{ color: "#667085" }}>{branch.branch_password_hash ? "Password protected" : "Password not configured"}</span>
                </div>
                <KeyRound size={22} />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreateBranch}
            style={{
              width: "100%",
              marginTop: "18px",
              padding: "14px 18px",
              border: 0,
              borderRadius: "12px",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Plus size={19} />
            Create New Branch
          </button>

          <button onClick={handleLogout} style={{ marginTop: "24px", border: 0, background: "transparent", cursor: "pointer", textDecoration: "underline" }}>Sign out</button>
        </div>

        {showCreateBranch && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.48)", display: "grid", placeItems: "center", padding: "20px", zIndex: 9999, overflowY: "auto" }}>
            <form
              onSubmit={createBranchFromSelector}
              style={{ width: "100%", maxWidth: "620px", background: "#fff", borderRadius: "18px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,.2)", margin: "20px 0" }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "6px" }}>Create New Branch</h2>
              <p style={{ color: "#667085", marginTop: 0 }}>Create the branch and configure its password at the same time.</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "20px" }}>
                <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                  Branch Code *
                  <input value={newBranch.branch_code} onChange={(e) => updateNewBranch("branch_code", e.target.value)} placeholder="e.g. LE3" required style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
                </label>
                <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                  Branch Name *
                  <input value={newBranch.branch_name} onChange={(e) => updateNewBranch("branch_name", e.target.value)} placeholder="Branch name" required style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
                </label>
              </div>

              <label style={{ display: "grid", gap: "6px", fontWeight: 600, marginTop: "14px" }}>
                Address
                <input value={newBranch.address} onChange={(e) => updateNewBranch("address", e.target.value)} placeholder="Branch address" style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" }}>
                <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                  Phone
                  <input value={newBranch.phone} onChange={(e) => updateNewBranch("phone", e.target.value)} placeholder="Phone number" style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
                </label>
                <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                  Email
                  <input type="email" value={newBranch.email} onChange={(e) => updateNewBranch("email", e.target.value)} placeholder="Email address" style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
                </label>
              </div>

              <label style={{ display: "grid", gap: "6px", fontWeight: 600, marginTop: "14px" }}>
                VAT Number
                <input value={newBranch.vat_number} onChange={(e) => updateNewBranch("vat_number", e.target.value)} placeholder="VAT number" style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" }}>
                <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                  Branch Password *
                  <input type="password" value={newBranch.password} onChange={(e) => updateNewBranch("password", e.target.value)} placeholder="Minimum 4 characters" required style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
                </label>
                <label style={{ display: "grid", gap: "6px", fontWeight: 600 }}>
                  Confirm Password *
                  <input type="password" value={newBranch.confirm_password} onChange={(e) => updateNewBranch("confirm_password", e.target.value)} placeholder="Repeat password" required style={{ padding: "11px 12px", border: "1px solid #d0d5dd", borderRadius: "10px" }} />
                </label>
              </div>

              {createBranchError && <p style={{ color: "#b42318", marginBottom: 0 }}>{createBranchError}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px" }}>
                <button type="button" onClick={closeCreateBranch} disabled={createBranchSaving} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #d0d5dd", background: "#fff", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={createBranchSaving} style={{ padding: "10px 18px", borderRadius: "10px", border: 0, background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 700 }}>{createBranchSaving ? "Creating..." : "Create Branch"}</button>
              </div>
            </form>
          </div>
        )}

        {pendingBranch && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.48)", display: "grid", placeItems: "center", padding: "20px", zIndex: 9999 }}>
            <form onSubmit={unlockBranch} style={{ width: "100%", maxWidth: "440px", background: "#fff", borderRadius: "18px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
              <h2 style={{ marginTop: 0 }}>Unlock Branch</h2>
              <p>{pendingBranch.branch_code} - {pendingBranch.branch_name}</p>
              <input
                autoFocus
                type="password"
                placeholder="Enter branch password"
                value={branchPassword}
                onChange={(e) => setBranchPassword(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: "1px solid #d0d5dd", borderRadius: "10px", marginTop: "10px" }}
              />
              {branchError && <p style={{ color: "#b42318" }}>{branchError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={closeBranchUnlock} disabled={branchLoading} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid #d0d5dd", background: "#fff", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={branchLoading || !branchPassword} style={{ padding: "10px 16px", borderRadius: "10px", border: 0, background: "#111827", color: "#fff", cursor: "pointer" }}>{branchLoading ? "Checking..." : "Unlock Branch"}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  const displayName =
    profile.full_name?.trim() ||
    profile.email?.split("@")[0] ||
    "User";

  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">
            <ShoppingCart size={22} />
          </div>

          <div>
            <h2>{companyName}</h2>
            <span>Point of Sale</span>
          </div>
        </div>

        <div className="platform-title">Platform</div>

        <nav>
          {allowedMenuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`menu-item ${
                  activeMenu === item.name ? "active" : ""
                }`}
                onClick={() => setActiveMenu(item.name)}
              >
                <Icon size={19} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", padding: "14px 12px", fontSize: "12px", lineHeight: 1.5, opacity: 0.9 }}>
          <div style={{ fontWeight: 700 }}>Need help with Point of Sales?</div>
          <a href="tel:+94769696491" style={{ color: "inherit", textDecoration: "none", fontWeight: 800 }}>
            Support: 076 969 6491
          </a>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <Menu size={22} />

            <div>
              <h1>{activeMenu}</h1>
              <p>Manage your business operations</p>
            </div>
          </div>

          {subscription?.plan === "TRIAL" &&
            subscription?.has_access &&
            subscription?.trial_ends_at && (
              <div
                style={{
                  padding: "8px 11px",
                  borderRadius: "10px",
                  background: "#fffaeb",
                  border: "1px solid #fedf89",
                  color: "#93370d",
                  fontWeight: 700,
                  fontSize: "13px",
                  marginLeft: "auto",
                }}
                title={`Trial ends ${new Date(
                  subscription.trial_ends_at
                ).toLocaleString()}`}
              >
                Free Trial · {Math.max(
                  1,
                  Math.ceil(
                    (new Date(subscription.trial_ends_at).getTime() -
                      new Date(subscription.server_time).getTime()) /
                      86400000
                  )
                )} day(s) remaining
              </div>
            )}

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: subscription?.plan === "TRIAL" ? "0" : "auto", marginRight: "14px" }}>
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <small style={{ display: "block", color: "#667085" }}>Current Branch</small>
              <strong>{activeBranch.branch_code} - {activeBranch.branch_name}</strong>
            </div>
            <button
              onClick={() => {
                setPendingBranch(null);
                setBranchPassword("");
                setBranchError("");
                setActiveBranch(null);
                sessionStorage.removeItem("lepos_active_branch_id");
              }}
              style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid #d0d5dd", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px" }}
            >
              <KeyRound size={16} />
              Switch Branch
            </button>
          </div>

          <div
            className="user-box"
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <div className="avatar">{initial}</div>

            <div style={{ minWidth: 0 }}>
              <strong>{displayName}</strong>
              <span>{profile.role}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                marginLeft: "8px",
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <section className="content">
          {activeMenu === "Dashboard" && (
            <Dashboard
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Customers" && (
            <Customers
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Suppliers" && (
            <Suppliers
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Purchases" && (
            <Purchases
              profile={profile}
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Cashiers" && (
            <Cashiers
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Items" && (
            <Items
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "POS" && (
            <POS
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Invoices" && (
            <Invoices
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Branches" && (
            <Branches
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
              refreshBranches={refreshBranches}
            />
          )}

          {activeMenu === "Quotes" && (
            <Quotes
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Reports" && (
            <Reports
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Billing" && (
            <Billing
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Subscription" && (
            <Subscription
              subscription={subscription}
              onActivated={() => window.location.reload()}
            />
          )}

          {activeMenu === "Subscription Management" && isPlatformAdmin && (
            <SubscriptionAdmin />
          )}

          {activeMenu === "Audit Logs" && (
            <AuditLogs
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "How To" && (
            <HowTo
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "User Management" && (
            <UserManagement
              currentUser={profile}
              branches={branches}
            />
          )}

          {activeMenu === "Settings" && (
            <Settings
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}

          {activeMenu === "Stock Management" && (
            <StockManagement
              activeBranch={activeBranch}
              branchId={activeBranch.id}
              branches={branches}
              requestBranchSwitch={requestBranchSwitch}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function App() {
  const match = window.location.pathname.match(
    /^\/invoice\/([0-9a-f-]{36})\/?$/i
  );

  if (match) {
    return <PublicInvoice token={match[1]} />;
  }

  return <PrivateApp />;
}

export default App;
