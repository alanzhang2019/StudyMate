"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
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
    } else {
      router.push("/select-profile");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">
          {isRegister ? "Parent Registration" : "Parent Login"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            {isRegister ? "Register" : "Login"}
          </button>
        </form>
        <button 
          onClick={() => setIsRegister(!isRegister)}
          className="w-full mt-4 text-sm text-blue-600"
        >
          {isRegister ? "Already have an account? Login" : "Need an account? Register"}
        </button>
      </div>
    </div>
  );
}