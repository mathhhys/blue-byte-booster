import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const EnterpriseFeatures = () => {
  return (
    <section className="py-24 bg-transparent">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Accelerate development velocity
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto mb-8">
            Built for professional developers who demand performance, reliability, and
            measurable results.
          </p>
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 px-6 py-3"
          >
            See More Features
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Proven developer adoption */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-300">
            <div className="mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Proven developer adoption
              </h3>
              <p className="text-white leading-relaxed">
                In head-to-head evaluations, 83% of engineers select Softcodes as their
                primary AI coding tool, driving consistent adoption across teams.
              </p>
            </div>
          </Card>

          {/* Enterprise-scale architecture */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-300">
            <div className="mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Enterprise-scale architecture
              </h3>
              <p className="text-white leading-relaxed">
                Architected to handle complex codebases with tens of millions of lines
                of code, while maintaining performance across thousands of developers.
              </p>
            </div>
          </Card>

          {/* Production-ready security */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg hover:shadow-lg transition-shadow duration-300">
            <div className="mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Production-ready security
              </h3>
              <p className="text-gray-300 leading-relaxed">
                SOC2 Type II certified, Enforced Privacy Mode, and Zero
                Data Retention to protect your intellectual property.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseFeatures;