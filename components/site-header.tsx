import { SiteChrome } from "@/components/site-chrome";
import { SiteLogo } from "@/components/site-logo";
import { NavigationIdentity } from "@/components/account-navigation";
import { SiteNavigation } from "@/components/site-navigation";

export function SiteHeader() {
  return <NavigationIdentity>
    <SiteChrome><header className="relative z-20 border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:py-4">
        <SiteLogo />
        <SiteNavigation />
      </div>
    </header></SiteChrome>
  </NavigationIdentity>;
}
