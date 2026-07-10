import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "心语 · 心理陪伴助手",
  description: "专业的心理咨询与情绪陪伴平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
