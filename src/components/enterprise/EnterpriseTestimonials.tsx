import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EnterpriseTestimonials = () => {
  return (
    <section className="py-24 bg-transparent">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            What our customers say
          </h2>
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 px-6 py-3"
          >
            Customer Stories
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Testimonial 1 - Brex */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg">
            <div className="mb-6">
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                "More than 70% of our engineers now use it, and they're doing far more than just
                delegating tasks to coding agents, they are pairing with them through iterations and feedback."
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">JAMES REGGIO</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg text-white">BREX</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Testimonial 2 - Datadog */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg">
            <div className="mb-6">
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                "We've seen our developers use Softcodes as they would a
                teammate: instead of simply delegating tasks to coding agents,
                they are pairing with them through iterations and feedback."
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">ALEXIS LÊ-QUÔC</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg text-white">DATADOG</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Testimonial 3 - Upwork */}
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg">
            <div className="mb-6">
              <p className="text-lg text-gray-300 leading-relaxed mb-6">
                "GitHub Copilot barely reached 20% adoption with our team, but with
                Softcodes we hit nearly 100% usage right after rollout. The before-and-
                after has been incredible to see: we're shipping about 50% more code."
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">ANTON ANDREEV</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg text-white">UPWORK</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Additional testimonial - Rippling */}
        <div className="mt-12">
          <Card className="p-8 bg-[#181F32] border border-gray-700 rounded-lg max-w-4xl mx-auto">
            <div className="text-center">
              <p className="text-xl text-gray-300 leading-relaxed mb-6">
                "Softcodes has transformed the way our engineering teams write and ship code, with
                adoption growing from 150 to over 500 engineers (~60% of our org!) in just a few
                weeks. Softcodes has quickly become an indispensable part of our development toolkit!"
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">ALBERT STRASHEIM</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg text-white">RIPPLING</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseTestimonials;