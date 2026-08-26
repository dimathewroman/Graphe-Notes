import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import {
  inter,
  jetbrainsMono,
  lato,
  merriweather,
  playfairDisplay,
  roboto,
} from "@/app/fonts/fonts";
import "@/app/globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Graphe Notes",
  description: "Notes that get you, wherever you go.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  interactiveWidget: "resizes-visual",
  viewportFit: "cover",
};

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
  lato.variable,
  merriweather.variable,
  playfairDisplay.variable,
  roboto.variable,
].join(" ");

export default function StaticClientLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
