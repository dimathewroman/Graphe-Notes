import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Graphe Notes",
  description: "Notes that get you, wherever you go.",
};

// Applies saved theme before first paint to avoid flash of wrong theme
const themeInitScript = `
(function() {
  try {
    var mode = localStorage.getItem('theme_mode') || 'light';
    var accent = localStorage.getItem('theme_accent') || '';
    if (mode === 'light') document.documentElement.classList.add('light');
    if (accent) {
      document.documentElement.style.setProperty('--primary', accent);
      document.documentElement.style.setProperty('--ring', accent);
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
