import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqData = [
  {
    question: "What are AI prompts and how are they consumed?",
    answer: "AI prompts are requests sent to our AI models for code generation, completion, or assistance. Each interaction with the AI (like generating a function, explaining code, or getting suggestions) counts as one prompt. The count resets monthly."
  },
  {
    question: "Can I switch between plans anytime?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference immediately. When downgrading, the change takes effect at your next billing cycle."
  },
  {
    question: "Do you offer student discounts?",
    answer: "Yes! We offer 50% off all plans for verified students and educators. Contact our support team with your educational email address to get started."
  },
  {
    question: "What happens if I exceed my prompt limit?",
    answer: "If you exceed your monthly prompt limit, you can either upgrade your plan or purchase additional prompts at $0.01 per prompt. We'll notify you when you're approaching your limit."
  },
  {
    question: "Is my code data secure and private?",
    answer: "Absolutely. We're SOC 2 certified and follow industry best practices for data security. Your code is encrypted in transit and at rest. For Enterprise customers, we offer on-premise deployment options."
  },
  {
    question: "Which IDEs and editors do you support?",
    answer: "We support VS Code, JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.), Vim, Neovim, and Emacs. We're continuously adding support for more editors based on user demand."
  }
];

export default function FAQSection() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <section className="py-24 px-4 bg-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-300">
            Everything you need to know about SoftCodes pricing
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <div
              key={index}
              className="border border-white/10 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <span className="text-white font-medium">{faq.question}</span>
                {expandedFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-white" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white" />
                )}
              </button>
              {expandedFaq === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-300">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}