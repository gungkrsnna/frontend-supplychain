// src/pages/AuthPages/SignInForm.tsx
import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Checkbox from "../../components/form/input/Checkbox";
import Button from "../../components/ui/button/Button";
import { AuthContext } from "../../context/AuthContext";

// Vite env var (set di root .env: VITE_API_BASE=http://localhost:3001)
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

export default function SignInForm(): JSX.Element {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Email dan password harus diisi.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json().catch(() => ({}));
      console.log("DEBUG login response:", res.status, json);

      if (!res.ok) {
        const msg = json?.message || json?.error || `Login gagal (${res.status})`;
        throw new Error(msg);
      }

      if (!json?.user || !json?.token) {
        throw new Error("Response login tidak lengkap (user/token).");
      }

      // simpan user & token di context (AuthContext)
      login(json.user, json.token, isChecked);

      // === determine role name robustly ===
      const roleRaw = json.user?.role;

      // role can be:
      // - string: "kitchen"
      // - object: { id: 3, name: "kitchen", ... }
      // - numeric id (rare): 3
      let roleName = "";

      if (!roleRaw && json.user?.role_id) {
        // fallback if backend returns role_id instead
        roleName = String(json.user.role_id);
      } else if (typeof roleRaw === "string") {
        roleName = roleRaw;
      } else if (typeof roleRaw === "number") {
        roleName = String(roleRaw);
      } else if (typeof roleRaw === "object" && roleRaw !== null) {
        // prefer name property
        roleName = (roleRaw.name || roleRaw.role_name || roleRaw.label || "") as string;
      }

      roleName = (roleName || "").toLowerCase();

      // store roleName for ProtectedRoute & debugging
      localStorage.setItem("roleName", roleName);
      localStorage.setItem("user", JSON.stringify(json.user));
      localStorage.setItem("token", json.token);

      // redirect berdasarkan roleName
      switch (roleName) {
        case "kitchen":
          navigate("/kitchen");
          break;
        case "marketing":
          navigate("/marketing");
          break;
        case "store":
          navigate("/store");
          break;
        case "admin":
        case "admin store":
        case "admin_store":
          navigate("/admin");
          break;
        case "superadmin":
          navigate("/superadmin");
          break;
        // if roleName is a numeric id (fallback), you may map ids to routes here:
        // case "3": // role id 3 => kitchen
        //   navigate("/kitchen"); break;
        default:
          navigate("/dashboard");
          break;
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-md pt-10 mx-auto"></div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign in!
            </p>
          </div>

          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Error */}
                {error && <div className="px-3 py-2 text-sm text-red-700 bg-red-50 rounded">{error}</div>}

                <div>
                  <Label>
                    Email <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    placeholder="info@gmail.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    type="email"
                    required
                  />
                </div>

                <div>
                  <Label>
                    Password <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 right-4 top-1/2"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={(v: boolean) => setIsChecked(v)} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Keep me logged in
                    </span>
                  </div>
                  <Link to="/reset-password" className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400">
                    Forgot password?
                  </Link>
                </div>

                <div>
                  <Button className="w-full" size="sm" type="submit" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
