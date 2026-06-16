'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) router.push('/admin');
    else alert('Login failed');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl mb-6 font-bold text-center">Admin Login</h1>
        <input className="w-full p-2 border rounded mb-4" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="w-full p-2 border rounded mb-6" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white p-2 rounded" type="submit">Login</button>
      </form>
    </div>
  );
}
