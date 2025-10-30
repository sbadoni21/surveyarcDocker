import "../globals.css";
import { routing } from "@/src/i18n/routing";

import { QuestionProvider } from "@/providers/questionPProvider";
import ThemeToggle from "@/components/ThemeToggle";
import { RuleProvider } from "@/providers/rulePProvider";
import { OrganisationProvider } from "@/providers/postGresPorviders/organisationProvider";
import { ResponseProvider } from "@/providers/postGresPorviders/responsePProvider";
import { ContactProvider } from "@/providers/postGresPorviders/contactProvider";

export default async function Layout(props) {
  const { children } = props;
  const { locale } = await props.params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }
  return (
    <body lang={locale}>
      <OrganisationProvider>
        <QuestionProvider>
          <ThemeToggle />
          <RuleProvider>
            <ContactProvider>
              <ResponseProvider>{children}</ResponseProvider>
            </ContactProvider>
          </RuleProvider>
        </QuestionProvider>
      </OrganisationProvider>
    </body>
  );
}
