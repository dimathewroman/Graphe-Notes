import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import {
  Inter,
  JetBrains_Mono,
  Merriweather,
  Playfair_Display,
  Lato,
  Roboto,
} from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-merriweather",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-playfair-display",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-roboto",
  display: "swap",
});

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

const fontVariables = [
  GeistSans.variable,
  inter.variable,
  jetbrainsMono.variable,
  merriweather.variable,
  playfairDisplay.variable,
  lato.variable,
  roboto.variable,
].join(" ");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
