import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { routing } from "@/src/i18n/routing";
import LayoutFile from "@/components/LayoutFile";
import ThemeToggle from "@/components/ThemeToggle";
import Script from "next/script"; // ✅ This is required
import "react-quill-new/dist/quill.snow.css";
import "../react-dom-finddomnode-polyfill"; // 👈 add this

export default async function RootLayout(props) {
  const { children } = props;
  const { locale } = await props.params;



  return (
    <html lang={locale}>
      <head>
      
      </head>
      <body>
        <NextIntlClientProvider>
          <LayoutFile>
            <ThemeToggle />
            {children}
          </LayoutFile>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
