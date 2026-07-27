'use client';

// 通用退出登录按钮。
//
// 为什么不用 `<Link href="/api/auth/signout">` 或裸 `<a>`：
//   - `<Link>` 会被 next/router 拦截，尝试客户端导航，但
//     /api/auth/signout 不是 Next.js 页面而是 API 路由，
//     客户端导航失败 → 退出卡死
//   - 裸 `<a>` 走 GET，会先跳到 NextAuth v5 默认的英文
//     "Signout / Are you sure" 确认页（很丑），再点蓝色
//     "Sign out" 才真清 session
//
// 直接调 `next-auth/react` 的 signOut()：
//   - 走 POST 到 /api/auth/signout（NextAuth v5 推荐）
//   - 清 cookie + 跳 callbackUrl，无需中间确认页
//   - 不依赖 GET 路由的展示行为

import { signOut } from 'next-auth/react';

export function SignOutLink({
  className,
  children,
  callbackUrl = '/',
}: {
  className?: string;
  children: React.ReactNode;
  callbackUrl?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className={className}
    >
      {children}
    </button>
  );
}
