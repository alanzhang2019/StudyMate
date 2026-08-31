'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const captchaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentCaptchaRef = useRef('');

  const drawCaptcha = () => {
    const canvas = captchaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    currentCaptchaRef.current = code;

    ctx.clearRect(0, 0, 120, 48);
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 100},${Math.random() * 100},${Math.random() * 150},0.3)`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 120, Math.random() * 48);
      ctx.lineTo(Math.random() * 120, Math.random() * 48);
      ctx.stroke();
    }
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const colors = ['#ffd447', '#f5f2e9', '#b8c1d3', '#1b56c5'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.save();
      const x = 20 + i * 26;
      const y = 24 + (Math.random() * 8 - 4);
      ctx.translate(x, y);
      ctx.rotate(Math.random() * 0.4 - 0.2);
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }
  };

  useEffect(() => {
    drawCaptcha();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = username.trim();

    if (!uname || !password) {
      alert('请输入账号和密码');
      return;
    }
    if (captcha.trim().toUpperCase() !== currentCaptchaRef.current) {
      alert('验证码错误，请重新输入');
      drawCaptcha();
      setCaptcha('');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, password }),
      });
      if (res.ok) {
        router.push('/admin/camp/works');
      } else {
        let msg = '登录失败，请检查账号密码';
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          // ignore JSON parse failure, keep default message
        }
        alert(msg);
        drawCaptcha();
        setCaptcha('');
      }
    } catch {
      alert('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Link href="/camp" className="login-back">
        <svg
          width="16"
          height="16"
          viewBox="0 0 256 256"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"
            transform="rotate(180 128 128)"
          />
        </svg>
        <span className="login-back-label">返回首页</span>
      </Link>

      <section className="login-story">
        <p className="section-kicker">TEACHER / 教师入口</p>
        <h1>
          登录后，
          <br />
          <span className="login-label">管理你的学员。</span>
        </h1>
        <h2>记录每一节课的发现</h2>
        <p>这里是教师的工作台。登录后可以管理学员、记录课堂、审核作品。</p>
        <div className="login-capabilities">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            学员管理
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            课堂记录
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            作品审核
          </span>
        </div>
      </section>

      <div className="login-mobile-intro">
        <p className="section-kicker">TEACHER / 教师入口</p>
        <h2>登录后管理你的学员</h2>
      </div>

      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-form-brand">
            <span className="brand-identity">
              <img
                className="brand-identity-mark"
                src="https://edu.xgteacher.cn/assets/xgls-avatar.jpg"
                alt=""
              />
              <img
                className="brand-identity-wordmark"
                src="https://edu.xgteacher.cn/assets/xgls-logo.png"
                alt="Alan张老师"
              />
            </span>
          </div>
          <div className="login-form-heading">
            <h2>教师登录</h2>
            <p>输入账号密码进入工作台</p>
          </div>

          <div className="app-field">
            <span>账号</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="手机号或工号"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="app-field">
            <span>密码</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 256 256"
                  fill="currentColor"
                >
                  <path d="M251,123.13c-.37-.81-9.13-20.26-28.48-39.61C196.63,57.67,164,44,128,44S59.37,57.67,33.51,83.52C14.16,102.87,5.4,122.32,5,123.13a12.08,12.08,0,0,0,0,9.75c.37.82,9.13,20.26,28.49,39.61C59.37,198.34,92,212,128,212s68.63-13.66,94.48-39.51c19.36-19.35,28.12-38.79,28.49-39.61A12.08,12.08,0,0,0,251,123.13Zm-46.06,33C183.47,177.27,157.59,188,128,188s-55.47-10.73-76.91-31.88A130.36,130.36,0,0,1,29.52,128,130.45,130.45,0,0,1,51.09,99.89C72.54,78.73,98.41,68,128,68s55.46,10.73,76.91,31.89A130.36,130.36,0,0,1,226.48,128,130.45,130.45,0,0,1,204.91,156.12ZM128,84a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,84Z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="app-field">
            <span>验证码</span>
            <div className="login-captcha-control">
              <input
                type="text"
                name="captcha"
                autoComplete="off"
                placeholder="输入右侧验证码"
                required
                maxLength={4}
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
              />
              <button
                type="button"
                onClick={drawCaptcha}
                aria-label="点击刷新验证码"
              >
                <canvas ref={captchaCanvasRef} width="120" height="48" />
              </button>
            </div>
          </div>

          <label className="login-remember-option">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>
              <strong>记住我</strong>
              <small>7 天内免登录（公共电脑请勿勾选）</small>
            </span>
          </label>

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? '登录中…' : '登 录'}
          </button>

          <p className="login-demo-note">
            <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
              <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-44a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v36A8,8,0,0,1,144,172ZM120,92a12,12,0,1,1,12,12A12,12,0,0,1,120,92Z" />
            </svg>
            <span>
              演示账号：
              <strong style={{ color: 'var(--paper)' }}>admin</strong> /{' '}
              <strong style={{ color: 'var(--paper)' }}>admin123</strong>
              （可在服务端环境变量覆盖）
            </span>
          </p>
        </form>
      </section>
    </div>
  );
}
