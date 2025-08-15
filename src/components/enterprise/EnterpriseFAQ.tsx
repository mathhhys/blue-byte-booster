import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const EnterpriseFAQ = () => {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const faqItems: FAQItem[] = [
    {
      question: "How does Softcodes handle large-scale codebases and monorepos?",
      answer: "Softcodes is architected to handle complex enterprise codebases with tens of millions of lines of code. Our advanced indexing system and intelligent context retrieval are optimized for large-scale, distributed codebases while maintaining performance across thousands of developers."
    },
    {
      question: "What security measures are in place for enterprise customers?",
      answer: "We provide enterprise-grade security including SOC2 Type II certification, enforced privacy mode, zero data retention policies, and complete data isolation. Your code and prompts are never stored or used for training, ensuring your intellectual property remains secure."
    },
    {
      question: "How does Softcodes integrate with existing development workflows?",
      answer: "Softcodes seamlessly integrates with your existing development environment and workflows. It supports all major IDEs, version control systems, and CI/CD pipelines. Our enterprise deployment options include on-premises, private cloud, and hybrid configurations to meet your specific requirements."
    },
    {
      question: "What kind of analytics and reporting does Softcodes provide?",
      answer: "Our enterprise dashboard provides comprehensive analytics including AI adoption rates, productivity metrics, code generation statistics, and team performance insights. Administrators can track usage across teams, monitor compliance, and measure the impact of AI-powered development on your organization."
    },
    {
      question: "How does pricing work for enterprise customers?",
      answer: "Enterprise pricing is customized based on your team size, usage requirements, and deployment preferences. We offer flexible licensing models including per-seat, usage-based, and enterprise-wide licenses. Contact our sales team for a personalized quote and to discuss volume discounts."
    },
    {
      question: "What support options are available for enterprise customers?",
      answer: "Enterprise customers receive priority support including dedicated customer success managers, 24/7 technical support, custom onboarding programs, and direct access to our engineering team. We also provide training sessions, best practices workshops, and ongoing optimization consultations."
    }
  ];

  return (
    <section className="py-24 bg-transparent">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Frequently asked questions
          </h2>
        </div>

        <div className="max-w-4xl mx-auto space-y-4">
          {faqItems.map((item, index) => (
            <Card key={index} className="bg-[#181F32] border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleItem(index)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                aria-expanded={openItems.includes(index)}
              >
                <h3 className="text-lg font-semibold text-white pr-4">
                  {item.question}
                </h3>
                <div className="flex-shrink-0">
                  {openItems.includes(index) ? (
                    <ChevronUp className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white" />
                  )}
                </div>
              </button>
              
              {openItems.includes(index) && (
                <div className="px-6 pb-6">
                  <div className="pt-2 border-t border-gray-700">
                    <p className="text-gray-300 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EnterpriseFAQ;