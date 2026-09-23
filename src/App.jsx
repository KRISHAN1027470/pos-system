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


const BRANCH_SELECTOR_STYLES = `
@keyframes branchGateEnter{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
@keyframes branchOrb{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-20px,0)}}
@keyframes branchShine{0%{transform:translateX(-180%) rotate(18deg)}100%{transform:translateX(500%) rotate(18deg)}}
.branch-gate{min-height:100vh;position:relative;overflow:hidden;padding:44px 20px;display:grid;place-items:center;font-family:Inter,system-ui,sans-serif;background:radial-gradient(circle at 12% 15%,rgba(99,102,241,.25),transparent 28%),radial-gradient(circle at 90% 85%,rgba(14,165,233,.18),transparent 30%),linear-gradient(135deg,#07111f,#0b1730 52%,#111b38)}
.branch-gate:before{content:"";position:absolute;inset:0;opacity:.14;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:42px 42px;pointer-events:none}
.branch-orb{position:absolute;border-radius:50%;animation:branchOrb 8s ease-in-out infinite}.branch-orb.a{width:280px;height:280px;left:-90px;top:10%;background:rgba(99,102,241,.16)}.branch-orb.b{width:340px;height:340px;right:-120px;bottom:-80px;background:rgba(14,165,233,.12);animation-delay:-3s}
.branch-shell{position:relative;z-index:1;width:min(100%,1040px);display:grid;grid-template-columns:.88fr 1.12fr;border:1px solid rgba(255,255,255,.15);border-radius:30px;overflow:hidden;background:#fff;box-shadow:0 35px 90px rgba(0,0,0,.38);animation:branchGateEnter .6s cubic-bezier(.2,.8,.2,1)}
.branch-brand{min-height:620px;padding:46px 40px;color:#fff;display:flex;flex-direction:column;background:linear-gradient(155deg,#111c38,#172554 58%,#312e81);position:relative;overflow:hidden}.branch-brand:after{content:"";position:absolute;width:330px;height:330px;border-radius:50%;right:-200px;top:90px;background:rgba(129,140,248,.18)}
.branch-logo{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 16px 35px rgba(99,102,241,.35)}
.branch-kicker{margin-top:28px;color:#a5b4fc;font-size:12px;font-weight:800;letter-spacing:.17em;text-transform:uppercase}.branch-brand h2{font-size:38px;line-height:1.08;margin:12px 0 16px;letter-spacing:-.04em}.branch-brand p{color:#cbd5e1;line-height:1.7;margin:0;font-size:15px}
.branch-features{display:grid;gap:12px;margin-top:30px}.branch-features div{display:flex;align-items:center;gap:10px;color:#e2e8f0;font-size:14px;font-weight:650}.branch-features span{width:29px;height:29px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.09)}
.branch-support{margin-top:auto;color:#94a3b8;font-size:12px;line-height:1.6}.branch-support a{color:white;text-decoration:none;font-weight:800}
.branch-main{padding:42px 40px;background:linear-gradient(180deg,#fff,#f8fafc)}.branch-mobile-logo{display:none}.branch-main h1{margin:0;color:#0f172a;font-size:31px;letter-spacing:-.035em}.branch-main-desc{margin:9px 0 0;color:#64748b;line-height:1.6}.branch-count{display:inline-flex;margin-top:15px;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:800}
.branch-gate-error{margin-top:16px;padding:11px 13px;border:1px solid #fecaca;border-radius:11px;background:#fff1f2;color:#b42318;font-size:13px}.branch-list{display:grid;gap:12px;margin-top:22px;max-height:330px;overflow:auto;padding:2px 5px 2px 2px}
.branch-choice{width:100%;border:1px solid #e2e8f0;border-radius:17px;padding:16px 17px;background:#fff;display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer;box-shadow:0 7px 20px rgba(15,23,42,.045);transition:.22s ease}.branch-choice:hover{transform:translateY(-3px);border-color:#a5b4fc;box-shadow:0 17px 32px rgba(79,70,229,.13)}.branch-choice:active{transform:scale(.99)}
.branch-choice-icon{width:45px;height:45px;flex:0 0 auto;border-radius:13px;display:grid;place-items:center;color:#4f46e5;background:#eef2ff;transition:.22s ease}.branch-choice:hover .branch-choice-icon{background:#4f46e5;color:#fff}.branch-choice-copy{min-width:0;flex:1}.branch-choice-copy strong{display:block;color:#0f172a;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.branch-choice-copy small{display:flex;align-items:center;gap:6px;margin-top:5px;color:#64748b;font-size:12px}.branch-arrow{font-size:26px;color:#94a3b8;transition:.22s ease}.branch-choice:hover .branch-arrow{transform:translateX(3px);color:#4f46e5}
.branch-create{width:100%;margin-top:18px;border:0;border-radius:14px;padding:15px;color:#fff;font-weight:800;background:linear-gradient(100deg,#111827,#273449);display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;position:relative;overflow:hidden;box-shadow:0 12px 26px rgba(15,23,42,.16);transition:.2s ease}.branch-create:after{content:"";position:absolute;top:-60%;left:-30%;width:65px;height:220%;background:rgba(255,255,255,.16);animation:branchShine 5s ease-in-out infinite}.branch-create:hover{transform:translateY(-2px);box-shadow:0 17px 32px rgba(15,23,42,.22)}
.branch-footer{display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:18px;border-top:1px solid #e2e8f0}.branch-secure{display:flex;align-items:center;gap:6px;color:#64748b;font-size:12px}.branch-signout{border:0;background:transparent;color:#475569;font-weight:750;cursor:pointer;padding:8px 9px;border-radius:9px}.branch-signout:hover{background:#f1f5f9;color:#0f172a}
.branch-choice:focus-visible,.branch-create:focus-visible,.branch-signout:focus-visible{outline:3px solid rgba(99,102,241,.32);outline-offset:3px}
@media(max-width:800px){.branch-gate{padding:18px 13px;place-items:start center}.branch-shell{grid-template-columns:1fr;max-width:570px;border-radius:23px}.branch-brand{display:none}.branch-main{padding:28px 22px;min-height:calc(100vh - 36px)}.branch-mobile-logo{display:flex;align-items:center;gap:10px;margin-bottom:27px;font-weight:900;color:#0f172a}.branch-mobile-logo span{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6)}.branch-main h1{font-size:27px}.branch-list{max-height:none}}
@media(prefers-reduced-motion:reduce){.branch-shell,.branch-orb,.branch-create:after{animation:none!important}.branch-choice,.branch-create,.branch-choice-icon,.branch-arrow{transition:none!important}}
`;

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
  const [invoiceToOpen, setInvoiceToOpen] = useState("");
  const [companyName, setCompanyName] = useState("PrimePOS");
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
        setCompanyName("PrimePOS");
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
          <h2>Loading PrimePOS...</h2>
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
          <p>Verifying your PrimePOS access.</p>
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
      <div className="branch-gate">
        <style>{BRANCH_SELECTOR_STYLES}</style>
        <div className="branch-orb a" />
        <div className="branch-orb b" />

        <section className="branch-shell">
          <aside className="branch-brand">
            <div className="branch-logo"><ShoppingCart size={28} /></div>
            <div className="branch-kicker">PrimePOS • Secure Workspace</div>
            <h2>Select your workspace.</h2>
            <p>Choose the branch you want to operate. Each location stays protected so sales, stock and daily operations remain secure.</p>

            <div className="branch-features">
              <div><span><ShieldCheck size={15} /></span> Secure branch access</div>
              <div><span><Building2 size={15} /></span> Multi-branch operations</div>
              <div><span><KeyRound size={15} /></span> Password protected sessions</div>
            </div>

            <div className="branch-support">
              Need help with PrimePOS?<br />
              <a href="tel:+94769696491">Support: 076 969 6491</a>
            </div>
          </aside>

          <main className="branch-main">
            <div className="branch-mobile-logo">
              <span><ShoppingCart size={21} /></span> PrimePOS
            </div>

            <h1>Select Branch</h1>
            <p className="branch-main-desc">Select a business location to continue. Enter that branch&apos;s password to open the POS system.</p>
            <div className="branch-count">{branches.length} active {branches.length === 1 ? "branch" : "branches"}</div>

            {branchError && !pendingBranch && (
              <div className="branch-gate-error">{branchError}</div>
            )}

            <div className="branch-list">
              {branches.map((branch) => (
                <button type="button" className="branch-choice" key={branch.id} onClick={() => requestBranchUnlock(branch)}>
                  <span className="branch-choice-icon"><Building2 size={21} /></span>
                  <span className="branch-choice-copy">
                    <strong>{branch.branch_code} - {branch.branch_name}</strong>
                    <small><KeyRound size={13} />{branch.branch_password_hash ? "Password protected" : "Password not configured"}</small>
                  </span>
                  <span className="branch-arrow">›</span>
                </button>
              ))}
            </div>

            <button type="button" className="branch-create" onClick={openCreateBranch}>
              <Plus size={18} /> Create New Branch
            </button>

            <div className="branch-footer">
              <span className="branch-secure"><ShieldCheck size={15} /> Secure branch access</span>
              <button type="button" className="branch-signout" onClick={handleLogout}>Sign out</button>
            </div>
          </main>
        </section>

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
          <div style={{ fontWeight: 700 }}>Need help with PrimePOS?</div>
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
              openInvoiceNumber={invoiceToOpen}
              onInvoiceOpened={() => setInvoiceToOpen("")}
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
              onInvoiceCreated={(invoiceNumber) => {
                setInvoiceToOpen(invoiceNumber || "");
                setActiveMenu("Invoices");
              }}
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
