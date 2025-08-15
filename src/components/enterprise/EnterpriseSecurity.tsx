import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EnterpriseSecurity = () => {
  return (
    <section className="py-24 bg-transparent">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Enterprise-grade security
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Built with security and compliance at the core, trusted by Fortune 1000
            companies worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* SOC2 Compliance */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg">
            <div className="mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                SOC2 Type II Certified
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Independently audited and certified for security, availability, and confidentiality controls.
              </p>
            </div>
          </Card>

          {/* Privacy Mode Guarantee */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg">
            <div className="mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Privacy Mode Guarantee
              </h3>
              <p className="text-gray-300 leading-relaxed">
                We ensure your code data is never stored by model providers or used
                for training, giving you complete control over your intellectual property.
              </p>
            </div>
          </Card>

          {/* Global Governance */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg">
            <div className="mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Global Governance
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Full control over authentication and user provisioning with SAML, SSO,
                and enterprise directory integration.
              </p>
            </div>
          </Card>

          {/* Zero Data Retention */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg">
            <div className="mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Zero Data Retention
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Your code and prompts are never stored or logged. Complete data isolation
                ensures your intellectual property remains secure.
              </p>
            </div>
          </Card>
        </div>

        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 px-6 py-3"
            >
              View Security Details
            </Button>
            <Button
              className="bg-black text-white hover:bg-gray-800 px-6 py-3"
            >
              Visit Trust Center
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseSecurity;