import {
  Layers3,
  AlertTriangle,
  Cuboid,
  Image as ImageIcon,
  Terminal as TerminalIcon,
  Play,
  Rocket,
  CheckCircle2,
  FileText,
} from "lucide-react";

const features = [
  {
    icon: Layers3,
    title: "Memories",
    description: "Cascade will remember important things about your codebase and workflow.",
    extra: (
      <div className="mt-6 space-y-2 text-xs">
        <div>
          <span className="block font-medium">Rules</span>
          <div className="flex justify-between items-center mt-1">
            <span className="bg-white/10 rounded px-2 py-1 text-white/80"># Front end</span>
            <span className="text-white/60">Refresh</span>
          </div>
          <div className="mt-1 text-white/60">- Follow Next.js patterns</div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="font-medium">Memories</span>
          <span className="text-white/60">Search memories</span>
        </div>
        <div className="mt-1 text-white/60">Codebase Structure</div>
        <div className="text-white/30">#codebase_structure #typescript</div>
      </div>
    ),
    bg: "from-[#1D41D6] to-[#1D41D6]",
    text: "text-white",
  },
  {
    icon: AlertTriangle,
    title: "Lint Fixing",
    description: "Cascade will automatically detect and fix lint errors that it generates.",
    extra: (
      <div className="mt-6 space-y-2 text-xs">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-white" />
            <span>4 new linter errors</span>
          </div>
          <span className="bg-white/10 rounded px-2 py-1 text-white/80">Auto-fix on</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="bg-white/10 rounded px-2 py-1 text-white/80">Edited</span>
          <span className="text-white/60">panel.ts</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <CheckCircle2 size={16} className="text-white" />
          <span>0 new linter errors found</span>
        </div>
      </div>
    ),
    bg: "from-[#1D41D6] to-[#1D41D6]",
    text: "text-white",
  },
  {
    icon: Cuboid,
    title: "MCP Support",
    description:
      "Enhance your AI workflows by connecting custom tools and services. Access curated MCP servers in Windsurf settings for one click set-up.",
    extra: (
      <div className="mt-6 space-y-2 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4FFFDF] inline-block" />
            <span className="font-medium text-white/90">Figma</span>
            <span className="text-white/60">5 tools</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4FFFDF] inline-block" />
            <span className="font-medium text-white/90">Slack</span>
            <span className="text-white/60">7 tools</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4FFFDF] inline-block" />
            <span className="font-medium text-white/90">Stripe</span>
            <span className="text-white/60">9 tools</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4FFFDF] inline-block" />
            <span className="font-medium text-white/90">Sequential Thinking</span>
            <span className="text-white/60">3 tools</span>
          </div>
        </div>
        <div className="mt-4 text-white/40 text-[11px]">
          <div className="flex justify-between">
            <span className="font-bold">Plugin Store</span>
            <span>Manage Plugins</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <span>Github</span>
            <span className="text-right">Add server</span>
            <span>PostgresSQL</span>
            <span className="text-right">Add server</span>
            <span>Playwright</span>
            <span className="text-right">Add server</span>
            <span>Neon</span>
            <span className="text-right">Add server</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <span>Figma</span>
            <span className="text-right">Configure</span>
            <span>Slack</span>
            <span className="text-right">Configure</span>
          </div>
        </div>
      </div>
    ),
    bg: "from-[#1D41D6] to-[#1D41D6]",
    text: "text-white",
  },
  {
    icon: ImageIcon,
    title: "Drag & Drop Images",
    description: "Build your designs instantly by dropping an image into Cascade.",
    extra: (
      <div className="mt-6">
        <div className="bg-white/10 rounded px-2 py-1 text-white/80 text-xs inline-block">Build out my designs</div>
      </div>
    ),
    bg: "from-[#1D41D6] to-[#1D41D6]",
    text: "text-white",
  },
  {
    icon: TerminalIcon,
    title: "Terminal Command",
    description: "Don't remember a terminal command? Just ⌘+I terminal to stay in flow.",
    extra: (
      <div className="mt-6 text-xs">
        <div className="flex gap-4 border-b border-white/10 pb-2 mb-2">
          <span className="text-white/50">Problems</span>
          <span className="text-white/50">Output</span>
          <span className="text-white border-b-2 border-white pb-2 -mb-2.5">Terminal</span>
        </div>
        <div className="pt-2">
          <span className="text-white/60">yashmittal@Mac portfolio %</span>
          <div className="mt-1 flex items-center justify-between bg-[#1D41D6] rounded p-2 text-white shadow-[0_0_15px_rgba(79,255,223,0.4)]">
            <span>Create a compressed archive of this directory</span>
            <span className="text-xs bg-sky-400/50 text-sky-300 rounded-sm px-1 py-0.5">Windsurf Fast</span>
          </div>
        </div>
      </div>
    ),
    bg: "from-[#1D41D6] to-[#1D41D6]",
    text: "text-white",
  },
  {
    icon: Play,
    title: "Continue My Work",
    description: "Cascade keeps track of your actions so you can just tell it to continue what you're doing.",
    extra: (
      <div className="mt-6 text-xs space-y-2">
        <div className="bg-white/10 rounded px-2 py-1 text-white/80 inline-block">Continue my work</div>
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-white/70" />
          <span className="bg-white/10 rounded px-2 py-1 text-white/80">Edited</span>
          <span className="text-white/60">Navbar.tsx</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-white/70" />
          <span className="bg-white/10 rounded px-2 py-1 text-white/80">Edited</span>
          <span className="text-white/60">Dropdown.tsx</span>
        </div>
      </div>
    ),
    bg: "from-[#1D41D6] to-[#1D41D6]",
    text: "text-white",
  },
  {
    icon: Rocket,
    title: "Turbo Mode",
    description: "Turn on Turbo mode in settings to allow Cascade to auto-execute terminal commands.",
    extra: (
      <div className="mt-6 text-xs">
        <div className="flex flex-wrap gap-2">
          <span className="bg-white/10 rounded px-2 py-1 text-white/80 flex items-center gap-1">
            <CheckCircle2 size={14} className="text-primary-aqua" /> Edited
          </span>
          <span className="bg-white/10 rounded px-2 py-1 text-white/80 flex items-center gap-1">
            <CheckCircle2 size={14} className="text-primary-aqua" /> Ran Terminal Command
          </span>
          <span className="bg-white/10 rounded px-2 py-1 text-white/80 flex items-center gap-1">
            <CheckCircle2 size={14} className="text-primary-aqua" /> Created
          </span>
          <span className="bg-white/10 rounded px-2 py-1 text-white/80 flex items-center gap-1">
            Turbo
          </span>
          <span className="bg-white/10 rounded px-2 py-1 text-white/80 flex items-center gap-1">
            <CheckCircle2 size={14} className="text-primary-aqua" /> Searched nextjs.org
          </span>
          <span className="bg-white/10 rounded px-2 py-1 text-white/80 flex items-center gap-1">
            <CheckCircle2 size={14} className="text-primary-aqua" /> Deployed app
          </span>
        </div>
      </div>
    ),
    bg: "from-[#1D41D6] to-[#1D41D6]",
    text: "text-white",
  },
];

const FeaturesGrid = () => {
  return (
    <section className="bg-white py-20 sm:py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex items-center mb-8">
          <span className="w-2 h-2 rounded bg-[#F3A1FF] mr-2" />
          <span className="uppercase tracking-[0.2em] text-[#5A6987] text-xs font-semibold">Features</span>
        </div>
        <div className="flex justify-end mb-12 md:mb-16">
          <h2 className="text-4xl lg:text-[2.8rem] font-semibold text-[#0B1426] tracking-tight leading-tight text-right">
            One editor.<br />
            Unlimited superpowers.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <div
              key={feature.title}
              className={`
                rounded-2xl p-8 min-h-[320px] flex flex-col
                bg-gradient-to-br ${feature.bg} ${feature.text}
                ${idx === 2 ? "lg:col-span-2" : ""}
                shadow-xl
              `}
              style={{
                background: "linear-gradient(120deg, #1D41D6 0%, #1832B1 100%)",
                color: "#fff",
              }}
            >
              <feature.icon className="w-7 h-7 mb-4 opacity-90" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-base opacity-80">{feature.description}</p>
              {feature.extra}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;