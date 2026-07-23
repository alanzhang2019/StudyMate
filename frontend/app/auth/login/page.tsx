"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  // Single form for both login + register. `isRegister` toggles
  // between the two modes. We carry `name` (required for
  // student registration on /csp-lecture) and `role` so the
  // register request hits /api/auth/register with the right
  // shape. We use a `role` hidden input that defaults to
  // 'parent' for backward compat with the existing parent
  // signup flow; the /csp-lecture page can override it via
  // a `?as=student` query param.
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // Default to 'parent' unless the URL says otherwise. The
  // /csp-lecture entry point can link here with
  // `?as=student&redirect=/csp-lecture` to set up a student
  // account in one step.
  const [role, setRole] = useState<'student' | 'parent'>(() => {
    if (typeof window === 'undefined') return 'parent';
    const params = new URLSearchParams(window.location.search);
    return params.get('as') === 'student' ? 'student' : 'parent';
  });
  const [redirectTo, setRedirectTo] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('redirect') ?? '';
  });
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name: name || undefined, role }),
      });
      if (!res.ok) {
        const errorMsg = await res.text();
        return alert(`Registration failed: ${errorMsg}`);
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      alert("Invalid credentials");
      return;
    }

    // Post-login routing:
    // - If the URL had a `?redirect=/path`, honor it (used by
    //   /csp-lecture's auth guard for "you tried to view a
    //   classroom, please sign in first").
    // - Otherwise fetch the session to read the user's role
    //   and route accordingly: students go to /student/home,
    //   parents to /select-profile (legacy flow).
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
      return;
    }
    try {
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        const userRole = session?.user?.role ?? 'parent';
        const dest = userRole === 'student' ? '/student/home' : '/select-profile';
        router.push(dest);
      } else {
        router.push('/select-profile');
      }
    } catch {
      router.push('/select-profile');
    }
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">
          {isRegister
            ? role === 'student'
              ? 'Student Registration'
              : 'Parent Registration'
            : 'Sign in'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name (optional for parents, used in greetings)"
              className="w-full p-2 border rounded"
              maxLength={40}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-2 border rounded"
            required
          />
          <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded">
            {isRegister ? 'Register' : 'Sign in'}
          </button>
        </form>
        <button
          onClick={() => setIsRegister(!isRegister)}
          className="w-full mt-4 text-sm text-blue-600"
        >
          {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
        {/* Hidden role indicator: shown to user as small text
            so they understand the distinction. /csp-lecture
            links in with `?as=student` so this is the
            "student signup" entry point. */}
        {isRegister && (
          <p className="text-xs text-gray-500 mt-3 text-center">
            注册身份：{role === 'student' ? '学生（直接登录学习课件）' : '家长（管理孩子的学习记录）'}
          </p>
        )}
      </div>
    </div>
  );
}
