import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Listening Rooms",
  description: "A direct-to-fan home for independent artists.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
