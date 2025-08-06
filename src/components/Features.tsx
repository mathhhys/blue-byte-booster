import { Button } from "@/components/ui/button";

const Features = () => {
  return (
    <section
      id="features"
      className="w-full bg-[#101624] py-24 px-4 md:px-0"
      style={{ minHeight: "80vh" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-14">
        {/* Top row: Heading, Subheading, Button */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 mb-12">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Build software faster
            </h2>
            <p className="text-lg md:text-xl text-gray-300">
              Intelligent, fast, and familiar, Cursor is the best way to code with AI.
            </p>
          </div>
          <Button
            className="self-start md:self-center bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
            size="lg"
          >
            See more features
          </Button>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-[#181f33] rounded-2xl p-8 flex flex-col items-start shadow-2xl border border-white/10 min-h-[370px] transition hover:shadow-3xl hover:-translate-y-1">
            <img
              src="/placeholder.svg"
              alt="Frontier Intelligence"
              className="w-24 h-24 mb-8 object-contain bg-white/10 rounded-xl p-2"
              draggable={false}
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
            />
            <h3 className="text-2xl font-bold text-white mb-3">
              Frontier Intelligence
            </h3>
            <p className="text-base text-gray-300">
              Powered by a mix of purpose-built and frontier models, Cursor is smart and fast.
            </p>
          </div>
          {/* Card 2 */}
          <div className="bg-[#181f33] rounded-2xl p-8 flex flex-col items-start shadow-2xl border border-white/10 min-h-[370px] transition hover:shadow-3xl hover:-translate-y-1">
            <img
              src="/placeholder.svg"
              alt="Feels Familiar"
              className="w-24 h-24 mb-8 object-contain bg-white/10 rounded-xl p-2"
              draggable={false}
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
            />
            <h3 className="text-2xl font-bold text-white mb-3">
              Feels Familiar
            </h3>
            <p className="text-base text-gray-300">
              Import all your extensions, themes, and keybindings in one click.
            </p>
          </div>
          {/* Card 3 */}
          <div className="bg-[#181f33] rounded-2xl p-8 flex flex-col items-start shadow-2xl border border-white/10 min-h-[370px] transition hover:shadow-3xl hover:-translate-y-1">
            <img
              src="/placeholder.svg"
              alt="Privacy Options"
              className="w-24 h-24 mb-8 object-contain bg-white/10 rounded-xl p-2"
              draggable={false}
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
            />
            <h3 className="text-2xl font-bold text-white mb-3">
              Privacy Options
            </h3>
            <p className="text-base text-gray-300">
              If you enable Privacy Mode, your code is never stored remotely without your consent. Cursor is SOC 2 certified.
            </p>
          </div>
        </div>
      </div>
    </section>
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
  <section className="w-full bg-white py-16 px-4">
    <div className="max-w-6xl mx-auto flex flex-col items-center">
      <h3 className="text-base md:text-lg font-medium text-slate-900 text-center mb-8">
        First-class support for every major model provider
      </h3>
      <div className="w-full flex flex-wrap justify-center items-center gap-12 md:gap-20">
        {PROVIDER_LOGOS.map((logo) => (
          <img
            key={logo.name}
            src={logo.url}
            alt={logo.name}
            className="h-10 md:h-14 w-auto object-contain"
            style={{ maxWidth: 80 }}
            draggable={false}
          />
        ))}
      </div>
      <p className="text-slate-900 text-sm text-center mt-8 font-bold">
        + 30 additional providers supported
      </p>
    </div>
  </section>
);

// Append the new section after Features
const FeaturesWithProviders = () => (
  <>
    <Features />
    <ModelProvidersSection />
  </>
);

export default FeaturesWithProviders;
