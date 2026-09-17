import { redirect } from "next/navigation";
import { getTranslations } from "@/lib/server-i18n";
import { getSession } from "@/lib/session";
import { CarrierImportSettings } from "./CarrierImportSettings";
import { DeletionSettings } from "./DeletionSettings";
import { MembersSettings } from "./MembersSettings";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const { t } = await getTranslations();
  const orgId = session.session.activeOrganizationId ?? null;
  return (
    <main className="app-main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.description")}</p>
        </div>
      </div>
      <MembersSettings />
      {orgId ? <CarrierImportSettings orgId={orgId} /> : null}
      <DeletionSettings orgId={orgId} email={session.user.email} />
    </main>
  );
}