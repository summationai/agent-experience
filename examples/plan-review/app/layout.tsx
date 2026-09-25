import type { ReactNode } from "react";
import { SurfaceHost } from "./SurfaceHost";
import "./globals.css";

export const metadata = {
  title: "Plan Review",
  description: "A demand plan edited by people and agents, approved by a person.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="axe-manifest" href="/.well-known/axe.json" />
      </head>
      <body>
        <SurfaceHost />
        {children}
      </body>
    </html>
  );
}
