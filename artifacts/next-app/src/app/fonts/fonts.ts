import localFont from "next/font/local";

/**
 * The six @fontsource packages below are pinned to 5.2.6 in package.json and
 * pnpm-lock.yaml. Their package metadata declares the bundled font files as
 * SIL Open Font License 1.1, so the exact local assets and license evidence
 * remain reproducible without a build-time font download.
 */
export const inter = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/inter/files/inter-latin-300-normal.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const jetbrainsMono = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const merriweather = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/merriweather/files/merriweather-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/merriweather/files/merriweather-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/merriweather/files/merriweather-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../../node_modules/@fontsource/merriweather/files/merriweather-latin-700-italic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-merriweather",
  display: "swap",
});

export const playfairDisplay = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-playfair-display",
  display: "swap",
});

export const lato = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-lato",
  display: "swap",
});

export const roboto = localFont({
  src: [
    {
      path: "../../../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-roboto",
  display: "swap",
});
