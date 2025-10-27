import {
  Atlassian,
  GitHub,
  GitLab,
  GoogleDrive,
  Slack,
  Neon,
  Stripe,
  Figma,
  Firebase,
  MicrosoftAzure,
  Notion,
  Supabase,
  Softcodes,
} from "@/components/logos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InfiniteSlider } from "@/components/infinite-slider";

export default function MCPServerSection() {
  return (
    <section className="mt-0">
      <div className="py-20 md:py-24" style={{ backgroundColor: '#0E172A' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-20 max-w-lg space-y-6 text-center">
            <h2 className="text-balance text-4xl font-semibold md:text-5xl text-white">
              Connect with Model Context Protocol servers and platforms
            </h2>
            <p className="text-gray-300">
              Seamlessly integrate MCP servers with popular platforms and tools to
              enhance your AI capabilities.
            </p>
          </div>
          <div className="group relative mx-auto max-w-xl items-center justify-between space-y-12 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] sm:max-w-2xl">
            <div
              role="presentation"
              className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30"
            ></div>
            <div>
              <InfiniteSlider gap={48} speed={20} speedOnHover={10}>
                <IntegrationCard ariaLabel="Atlassian integration icon">
                  <Atlassian />
                </IntegrationCard>
                <IntegrationCard ariaLabel="GitHub integration icon">
                  <GitHub />
                </IntegrationCard>
                <IntegrationCard ariaLabel="GitLab integration icon">
                  <GitLab />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Google Drive integration icon">
                  <GoogleDrive />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Slack integration icon">
                  <Slack />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Neon integration icon">
                  <Neon />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Stripe integration icon">
                  <Stripe />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Figma integration icon">
                  <Figma />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Firebase integration icon">
                  <Firebase />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Microsoft Azure integration icon">
                  <MicrosoftAzure />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Notion integration icon">
                  <Notion />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Supabase integration icon">
                  <Supabase />
                </IntegrationCard>
              </InfiniteSlider>
            </div>

            <div>
              <InfiniteSlider gap={48} speed={20} speedOnHover={10} reverse>
                <IntegrationCard ariaLabel="Supabase integration icon">
                  <Supabase />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Notion integration icon">
                  <Notion />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Microsoft Azure integration icon">
                  <MicrosoftAzure />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Firebase integration icon">
                  <Firebase />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Figma integration icon">
                  <Figma />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Stripe integration icon">
                  <Stripe />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Neon integration icon">
                  <Neon />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Slack integration icon">
                  <Slack />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Google Drive integration icon">
                  <GoogleDrive />
                </IntegrationCard>
                <IntegrationCard ariaLabel="GitLab integration icon">
                  <GitLab />
                </IntegrationCard>
                <IntegrationCard ariaLabel="GitHub integration icon">
                  <GitHub />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Atlassian integration icon">
                  <Atlassian />
                </IntegrationCard>
              </InfiniteSlider>
            </div>
            <div>
              <InfiniteSlider gap={48} speed={20} speedOnHover={10}>
                <IntegrationCard ariaLabel="Figma integration icon">
                  <Figma />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Firebase integration icon">
                  <Firebase />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Microsoft Azure integration icon">
                  <MicrosoftAzure />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Notion integration icon">
                  <Notion />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Supabase integration icon">
                  <Supabase />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Atlassian integration icon">
                  <Atlassian />
                </IntegrationCard>
                <IntegrationCard ariaLabel="GitHub integration icon">
                  <GitHub />
                </IntegrationCard>
                <IntegrationCard ariaLabel="GitLab integration icon">
                  <GitLab />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Google Drive integration icon">
                  <GoogleDrive />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Slack integration icon">
                  <Slack />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Neon integration icon">
                  <Neon />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Stripe integration icon">
                  <Stripe />
                </IntegrationCard>
              </InfiniteSlider>
            </div>
            <div className="absolute inset-0 m-auto flex size-fit justify-center gap-2" role="img" aria-label="Central Softcodes logo">
              <IntegrationCard
                className="size-24 bg-white/10 shadow-xl backdrop-blur-md border-white/20"
                isCenter={true}
                ariaLabel="Central Softcodes logo"
              >
                <Softcodes />
              </IntegrationCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const IntegrationCard = ({
  children,
  className,
  isCenter = false,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  position?:
    | "left-top"
    | "left-middle"
    | "left-bottom"
    | "right-top"
    | "right-middle"
    | "right-bottom";
  isCenter?: boolean;
}) => {
  return (
    <div
      className={cn(
        "bg-white/5 relative z-20 flex size-20 rounded-full border border-white/10",
        className
      )}
      role="img"
      aria-label={ariaLabel || `Integration icon ${isCenter ? 'center' : 'peripheral'}`}
    >
      <div className={cn("m-auto size-fit *:size-8", isCenter && "*:size-12")}>
        {children}
      </div>
    </div>
  );
};