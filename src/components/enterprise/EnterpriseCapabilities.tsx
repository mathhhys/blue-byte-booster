import { Card } from "@/components/ui/card";

const EnterpriseCapabilities = () => {
  return (
    <section className="py-24 bg-transparent">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Built for engineering excellence
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Transform how your developers ship features, debug systems, and scale technical
            capabilities with AI-powered development.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Harness deep codebase intelligence */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-300">
            <div className="mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Harness deep codebase intelligence
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Advanced indexing and context retrieval optimized for large-scale, complex
                enterprise codebases.
              </p>
            </div>
          </Card>

          {/* Leverage industry leading AI models */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-300">
            <div className="mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Leverage industry leading AI models
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Direct access to OpenAI, Anthropic, and Gemini models within your
                development environment.
              </p>
            </div>
          </Card>

          {/* Accelerate engineer onboarding */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-300">
            <div className="mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Accelerate engineer onboarding
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Accelerate engineer onboarding with AI agents that understand your entire codebase,
                helping new engineers ramp faster.
              </p>
            </div>
          </Card>

          {/* Quantify developer productivity */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-300">
            <div className="mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Quantify developer productivity
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Track AI adoption and impact across your engineering organization with comprehensive
                usage analytics and performance metrics.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseCapabilities;