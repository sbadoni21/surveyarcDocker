import "../globals.css";
import { routing } from "@/src/i18n/routing";

import { QuestionProvider } from "@/providers/questionPProvider";
import ThemeToggle from "@/components/ThemeToggle";
import { RuleProvider } from "@/providers/rulePProvider";
import { OrganisationProvider } from "@/providers/postGresPorviders/organisationProvider";
import { ResponseProvider } from "@/providers/postGresPorviders/responsePProvider";
import { ContactProvider } from "@/providers/postGresPorviders/contactProvider";
import { ThemeProvider } from "@/providers/postGresPorviders/themeProvider";
import { SupportTeamProvider } from "@/providers/postGresPorviders/SupportTeamProvider";
import { CampaignResultProvider } from "@/providers/postGresPorviders/campaginResultProvider";

export default async function Layout(props) {
  const { children } = props;
  const { locale } = await props.params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }
  return (
    <div lang={locale}>
      <OrganisationProvider>
        <QuestionProvider>
          <ThemeProvider>
          <ThemeToggle />
          <RuleProvider>
            <ContactProvider>
              <SupportTeamProvider>
                <CampaignResultProvider>
              <ResponseProvider>{children}</ResponseProvider>
              </CampaignResultProvider>
              </SupportTeamProvider>
            </ContactProvider>
          </RuleProvider>
          </ThemeProvider>
        </QuestionProvider>
      </OrganisationProvider>
    </div>
  );
}
