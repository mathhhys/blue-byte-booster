import {
  Gemini,
  Replit,
  MagicUI,
  VSCodium,
  MediaWiki,
  GooglePaLM,
  Softcodes,
} from "@/components/logos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InfiniteSlider } from "@/components/infinite-slider";

export default function MCPServerSection() {
  return (
    <section className="mt-0">
      <div className="py-24 md:py-32" style={{ backgroundColor: '#0E172A' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="group relative mx-auto max-w-[22rem] items-center justify-between space-y-6 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] sm:max-w-md">
            <div
              role="presentation"
              className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:32px_32px] opacity-30"
            ></div>
            <div>
              <InfiniteSlider gap={24} speed={20} speedOnHover={10}>
                <IntegrationCard ariaLabel="VSCodium integration icon">
                  <VSCodium />
                </IntegrationCard>
                <IntegrationCard ariaLabel="MediaWiki integration icon">
                  <MediaWiki />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Google PaLM integration icon">
                  <GooglePaLM />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Gemini integration icon">
                  <Gemini />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Replit integration icon">
                  <Replit />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Magic UI integration icon">
                  <MagicUI />
                </IntegrationCard>
              </InfiniteSlider>
            </div>

            <div>
              <InfiniteSlider gap={24} speed={20} speedOnHover={10} reverse>
                <IntegrationCard ariaLabel="Gemini integration icon">
                  <Gemini />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Replit integration icon">
                  <Replit />
                </IntegrationCard>
                <IntegrationCard ariaLabel="MediaWiki integration icon">
                  <MediaWiki />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Magic UI integration icon">
                  <MagicUI />
                </IntegrationCard>
                <IntegrationCard ariaLabel="VSCodium integration icon">
                  <VSCodium />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Google PaLM integration icon">
                  <GooglePaLM />
                </IntegrationCard>
              </InfiniteSlider>
            </div>
            <div>
              <InfiniteSlider gap={24} speed={20} speedOnHover={10}>
                <IntegrationCard ariaLabel="Replit integration icon">
                  <Replit />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Magic UI integration icon">
                  <MagicUI />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Gemini integration icon">
                  <Gemini />
                </IntegrationCard>
                <IntegrationCard ariaLabel="VSCodium integration icon">
                  <VSCodium />
                </IntegrationCard>
                <IntegrationCard ariaLabel="MediaWiki integration icon">
                  <MediaWiki />
                </IntegrationCard>
                <IntegrationCard ariaLabel="Google PaLM integration icon">
                  <GooglePaLM />
                </IntegrationCard>
              </InfiniteSlider>
            </div>
            <div className="absolute inset-0 m-auto flex size-fit justify-center gap-2" role="img" aria-label="Central Softcodes logo">
              <IntegrationCard
                className="size-16 bg-white/10 shadow-xl backdrop-blur-md border-white/20"
                isCenter={true}
                ariaLabel="Central Softcodes logo"
              >
                <Softcodes />
              </IntegrationCard>
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-lg space-y-6 text-center">
            <h2 className="text-balance text-3xl font-semibold md:text-4xl text-white">
              Connect with Model Context Protocol servers and platforms
            </h2>
            <p className="text-gray-300">
              Seamlessly integrate MCP servers with popular platforms and tools to
              enhance your AI capabilities.
            </p>

            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
              <a href="#">Explore MCP Servers Today</a>
            </Button>
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
        "bg-white/5 relative z-20 flex size-12 rounded-full border border-white/10",
        className
      )}
      role="img"
      aria-label={ariaLabel || `Integration icon ${isCenter ? 'center' : 'peripheral'}`}
    >
      <div className={cn("m-auto size-fit *:size-5", isCenter && "*:size-8")}>
        {children}
      </div>
    </div>
  );
};