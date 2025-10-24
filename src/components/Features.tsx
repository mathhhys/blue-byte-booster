import { Button } from "@/components/ui/button";
import {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardIcon
} from "@/components/ui/enhanced-card";

const Features = () => {
  return (
    <>
      <section
        id="features"
        className="w-full bg-[#101624] py-32 px-4 md:px-0"
      >
        <div className="max-w-6xl mx-auto flex flex-col gap-20">
          {/* Top row: Heading, Subheading, Button */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 mb-16">
            <div>
              <h2 className="text-5xl md:text-6xl font-bold text-white mb-4 mt-20">
                Build software faster
              </h2>
              <p className="text-xl md:text-2xl text-gray-300">
                Intelligent, fast, and familiar, Softcodes is the best way to code with AI.
              </p>
            </div>
            <Button
              className="self-start md:self-center bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 text-xl font-semibold rounded-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              size="lg"
            >
              See more features
            </Button>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {/* Card 1 */}
            <EnhancedCard
              variant="secondary"
              size="feature"
              aria-label="Feature: Frontier Intelligence"
            >
              <EnhancedCardHeader>
                <EnhancedCardIcon size="large" variant="secondary">
                  <img
                    src="/placeholder.svg"
                    alt=""
                    className="w-full h-full object-contain"
                    draggable={false}
                    style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
                  />
                </EnhancedCardIcon>
                <EnhancedCardTitle variant="secondary">
                  Frontier Intelligence
                </EnhancedCardTitle>
                <EnhancedCardDescription variant="secondary">
                  Powered by a mix of purpose-built and frontier models, Softcodes is smart and fast.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
            </EnhancedCard>

            {/* Card 2 */}
            <EnhancedCard
              variant="secondary"
              size="feature"
              aria-label="Feature: Feels Familiar"
            >
              <EnhancedCardHeader>
                <EnhancedCardIcon size="large" variant="secondary">
                  <img
                    src="/placeholder.svg"
                    alt=""
                    className="w-full h-full object-contain"
                    draggable={false}
                    style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
                  />
                </EnhancedCardIcon>
                <EnhancedCardTitle variant="secondary">
                  Feels Familiar
                </EnhancedCardTitle>
                <EnhancedCardDescription variant="secondary">
                  Import all your extensions, themes, and keybindings in one click.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
            </EnhancedCard>

            {/* Card 3 */}
            <EnhancedCard
              variant="secondary"
              size="feature"
              aria-label="Feature: Privacy Options"
            >
              <EnhancedCardHeader>
                <EnhancedCardIcon size="large" variant="secondary">
                  <img
                    src="/placeholder.svg"
                    alt=""
                    className="w-full h-full object-contain"
                    draggable={false}
                    style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
                  />
                </EnhancedCardIcon>
                <EnhancedCardTitle variant="secondary">
                  Privacy Options
                </EnhancedCardTitle>
                <EnhancedCardDescription variant="secondary">
                  If you enable Privacy Mode, your code is never stored remotely without your consent. Softcodes is SOC 2 certified.
                </EnhancedCardDescription>
              </EnhancedCardHeader>
            </EnhancedCard>
          </div>
        </div>

      </section>
    </>
  );
};

const PROVIDER_LOGOS = [
  {
    name: "Anthropic",
    url: "https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/anthropic.svg",
  },
  {
    name: "OpenAI",
    url: "https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/openai.svg",
  },
  {
    name: "Gemini",
    url: "https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/gemini-color.svg",
  },
  {
    name: "Deepseek",
    url: "https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/deepseek-color.svg",
  },
  {
    name: "Mistral",
    url: "https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/mistral-color.svg",
  },
  {
    name: "Ollama",
    url: "https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/ollama.svg",
  },
];

export const ModelProvidersSection = () => (
  <section className="w-full bg-white py-8 px-4">
    <div className="flex flex-col items-center w-full">
      <h3 className="text-lg md:text-xl font-medium text-slate-900 text-center mb-8">
        First-class support for every major model provider
      </h3>
      <div className="w-full flex flex-wrap justify-center items-center gap-12 md:gap-20 my-8 md:my-12">
        {PROVIDER_LOGOS.map((logo) => (
          <img
            key={logo.name}
            src={logo.url}
            alt={logo.name}
            className="h-16 md:h-20 w-auto object-contain max-w-[140px] md:max-w-[200px]"
            draggable={false}
          />
        ))}
      </div>
      <p className="text-lg md:text-xl text-slate-900 text-center mt-8 font-medium">
        + 30 additional providers supported
      </p>
    </div>
  </section>
);

export default Features;
