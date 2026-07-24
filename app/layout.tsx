import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    title: "鲜链云｜水果批发 B2B 订货系统",
    description: "面向水果批发业务的 B2B 订货、仓配、库存与结算一体化产品原型。",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "鲜链云｜水果批发 B2B 订货系统",
      description: "找货、订货、仓配与结算，在一条链路上完成。",
      images: [`${baseUrl}/og.png`],
    },
    twitter: {
      card: "summary_large_image",
      title: "鲜链云｜水果批发 B2B 订货系统",
      description: "找货、订货、仓配与结算，在一条链路上完成。",
      images: [`${baseUrl}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
