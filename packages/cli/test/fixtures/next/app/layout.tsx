import type { ReactNode } from "react";

export const metadata = {
  title: "Plan Review",
  description: "A demand plan edited by people and agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>Plan Review</header>
        {children}
      </body>
    </html>
  );
}
