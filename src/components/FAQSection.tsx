import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqData = [
  {
    question: "How many models are supported and are they free?",
    answer: "We support more than 500 models and some of them are free to use and/or local. We recommend you to integrate your own Openrouter API Key for faster answers with the free models."
  },
  {
    question: "Is there a free trial available?",
    answer: "Yes, we offer a free trial so you can explore Softcodes before committing. Visit our pricing page or sign up to get started."
  },
  {
    question: "What are my payment options?",
    answer: "Self-serve plans support all major credit and debit cards. For custom demands and invoice based billing, please contact us at mathys@softcodes.io"
  },
  {
    question: "What if I need to cancel my subscription?",
    answer: "You can cancel your subscription at any time from your account settings. For self-serve plans, cancellation is immediate."
  },
  {
    question: "How does Softcodes use my data?",
    answer: "We guarantee that code data is never stored by our model providers or used for training. You can learn more on our Privacy page."
  },
  {
    question: "Where can I ask more questions?",
    answer: "Feel free to email us directly at mathys@softcodes.io"
  }
];

export default function FAQSection() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <section className="py-16 px-4" style={{ backgroundColor: '#0F1629' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-lg md:text-xl text-gray-300">
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