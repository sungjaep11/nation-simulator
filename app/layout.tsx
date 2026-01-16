import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "삼국지 - 천하통일",
  description: "고구려, 백제, 신라의 군주가 되어 천하 통일을 이루어라",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
