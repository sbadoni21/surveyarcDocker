import { SalesforceAccountProvider } from "@/providers/postGresPorviders/SalesforceAccountProvider";
import { SalesforceContactProvider } from "@/providers/postGresPorviders/SalesforceContactProvider";

export default function Layout({ children }) {
  return (
    <SalesforceContactProvider>
      <SalesforceAccountProvider>
      {children}
      </SalesforceAccountProvider>
    </SalesforceContactProvider>
  );
}
