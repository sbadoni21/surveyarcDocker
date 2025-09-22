import { routing } from "@/src/i18n/routing";
import { UserProvider } from "@/providers/postGresPorviders/UserProvider";
import { OrganisationProvider } from "@/providers/postGresPorviders/organisationProvider";
import { PricingPlanProvider } from "@/providers/postGresPorviders/PricingPlanProvider";


export default async function RootLayout(props) {
  const { children } = props;
  const { locale } = await props.params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  return (
    <div lang={locale}>
 <UserProvider>
    <OrganisationProvider>
        <PricingPlanProvider>
      <div>

            {children}
      </div>
      </PricingPlanProvider>
      </OrganisationProvider>
      </UserProvider>
    </div>
  );
}
