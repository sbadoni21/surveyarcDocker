import "../globals.css";
import { routing } from "@/src/i18n/routing";

import { QuestionProvider } from "@/providers/questionPProvider";
import ThemeToggle from "@/components/ThemeToggle";

export default async function Layout(props) {
  const { children } = props;
  const { locale } = await props.params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }
  return (
    <body lang={locale}>
      <QuestionProvider><ThemeToggle />{children}</QuestionProvider>
    </body>
  );
}
