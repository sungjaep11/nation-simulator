import type { Metadata } from "next";
import { Noto_Serif_KR, Nanum_Gothic } from "next/font/google";
import "./globals.css";

const notoSerifKR = Noto_Serif_KR({
  weight: ["400", "500", "600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-serif",
});

const nanumGothic = Nanum_Gothic({
  weight: ["400", "700", "800"],
  subsets: ["latin"],
  variable: "--font-sans",
});

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
    <html lang="ko" className={`${notoSerifKR.variable} ${nanumGothic.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
