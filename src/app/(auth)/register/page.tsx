"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Loader2 } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Registration failed.");
      setLoading(false);
      return;
    }

    // Auto sign-in after successful registration
    await signIn("credentials", { email, password, callbackUrl: "/dashboard" });
  }

  return (
    <GlassPanel radius="xl" elevated className="w-full max-w-md p-8 space-y-6">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-[14px] bg-[rgb(var(--accent))] mb-2">
          <span className="text-white text-xl font-bold">S</span>
        </div>
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
          Create your account
        </h1>
        <p className="text-sm text-[rgb(var(--text-secondary))]">
          Start your 7-day free trial — no credit card required
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[rgb(var(--text-secondary))]">
            Full name
          </label>
          <Input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[rgb(var(--text-secondary))]">
            Email
          </label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[rgb(var(--text-secondary))]">
            Password
          </label>
          <Input
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="text-sm text-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.08)] px-3 py-2 rounded-[10px]">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-[rgb(var(--text-muted))]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-[rgb(var(--accent))] hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </GlassPanel>
  );
}
