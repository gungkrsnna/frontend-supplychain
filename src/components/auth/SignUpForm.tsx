// src/pages/AuthPages/SignUpForm.tsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Checkbox from "../../components/form/input/Checkbox";
import Button from "../../components/ui/button/Button";

export default function SignUpForm(): JSX.Element {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [agree, setAgree] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If using Vite proxy, set VITE_API_BASE empty; otherwise set to http://localhost:3000
  const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setSuccessMsg(null);

  if (!firstName.trim() || !lastName.trim()) {
    setError("First name dan last name harus diisi.");
    return;
  }
  if (!email.trim()) {
    setError("Email harus diisi.");
    return;
  }
  if (!password) {
    setError("Password harus diisi.");
    return;
  }
  if (!agree) {
    setError("Kamu harus menyetujui Terms and Conditions.");
    return;
  }

  if (password.length < 6) {
    setError("Password minimal 6 karakter.");
    return;
  }

  // normalisasi email sebelum dikirim
  const emailNormalized = email.trim().toLowerCase();
  const fullName = `${firstName.trim()} ${lastName.trim()}`;

  setLoading(true);
  try {
    // --- BUILD PAYLOAD sesuai yang backend harapkan ---
    const payload = {
      name: fullName,          // backend mengharapkan 'name'
      email: emailNormalized,
      password,
      role_id: 2               // <-- sesuaikan dengan id role default di DB (contoh: 2 = 'user')
    };

    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json?.error || json?.message || `Server error (${res.status})`;
      throw new Error(msg);
    }

    setSuccessMsg("Registrasi berhasil. Mengalihkan ke halaman login...");
    setTimeout(() => navigate("/login"), 900);
  } catch (err: any) {
    console.error("Register error:", err);
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      setError("Gagal terhubung ke server. Periksa backend / CORS / jaringan.");
    } else {
      setError(err?.message || "Terjadi kesalahan saat registrasi.");
    }
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10"></div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign Up
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign up!
            </p>
          </div>

          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                {error && <div className="px-3 py-2 text-sm text-red-700 bg-red-50 rounded">{error}</div>}
                {successMsg && <div className="px-3 py-2 text-sm text-green-700 bg-green-50 rounded">{successMsg}</div>}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>First Name<span className="text-error-500">*</span></Label>
                    <Input
                      type="text"
                      id="fname"
                      name="fname"
                      placeholder="Enter your first name"
                      value={firstName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <Label>Last Name<span className="text-error-500">*</span></Label>
                    <Input
                      type="text"
                      id="lname"
                      name="lname"
                      placeholder="Enter your last name"
                      value={lastName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Email<span className="text-error-500">*</span></Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>Password<span className="text-error-500">*</span></Label>
                  <div className="relative">
                    <Input
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
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

                <div className="flex items-center gap-3">
                  <Checkbox className="w-5 h-5" checked={agree} onChange={(v: boolean) => setAgree(v)} />
                  <p className="inline-block font-normal text-gray-500 dark:text-gray-400">
                    By creating an account you agree to the{" "}
                    <span className="text-gray-800 dark:text-white/90">Terms and Conditions</span> and{" "}
                    <span className="text-gray-800 dark:text-white">Privacy Policy</span>
                  </p>
                </div>

                <div>
                  <Button
                    className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600"
                    type="submit"
                    size="sm"
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                Already have an account?{" "}
                <Link to="/login" className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
