const Features = () => {
  return (
    <section
      id="features"
      className="w-full bg-gradient-to-b from-white via-slate-50 to-slate-100 py-24 px-4 md:px-0"
      style={{ minHeight: "80vh" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-12">
        {/* Top row: Heading, Subheading, Button */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-[#0052cc] mb-4">
              Build software faster
            </h2>
            <p className="text-lg md:text-xl text-gray-600">
              Intelligent, fast, and familiar, Softcodes is the best way to code with AI.
            </p>
          </div>
          <button
            className="self-start md:self-center text-white font-medium px-6 py-3 rounded-lg shadow transition"
            style={{ minWidth: 180, backgroundColor: "#0052cc" }}
          >
            See more features
          </button>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white rounded-2xl p-8 flex flex-col items-start shadow-lg border border-slate-200 min-h-[370px] transition hover:shadow-2xl hover:-translate-y-1">
            <img
              src="/placeholder.svg"
              alt="Frontier Intelligence"
              className="w-28 h-28 mb-8 object-contain"
              draggable={false}
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
            />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Frontier Intelligence
            </h3>
            <p className="text-base text-gray-600">
              Powered by a mix of purpose-built and frontier models, Cursor is smart and fast.
            </p>
          </div>
          {/* Card 2 */}
          <div className="bg-white rounded-2xl p-8 flex flex-col items-start shadow-lg border border-slate-200 min-h-[370px] transition hover:shadow-2xl hover:-translate-y-1">
            <img
              src="/placeholder.svg"
              alt="Feels Familiar"
              className="w-28 h-28 mb-8 object-contain"
              draggable={false}
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
            />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Feels Familiar
            </h3>
            <p className="text-base text-gray-600">
              Import all your extensions, themes, and keybindings in one click.
            </p>
          </div>
          {/* Card 3 */}
          <div className="bg-white rounded-2xl p-8 flex flex-col items-start shadow-lg border border-slate-200 min-h-[370px] transition hover:shadow-2xl hover:-translate-y-1">
            <img
              src="/placeholder.svg"
              alt="Privacy Options"
              className="w-28 h-28 mb-8 object-contain"
              draggable={false}
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.10))" }}
            />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Privacy Options
            </h3>
            <p className="text-base text-gray-600">
              If you enable Privacy Mode, your code is never stored remotely without your consent. Cursor is SOC 2 certified.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;