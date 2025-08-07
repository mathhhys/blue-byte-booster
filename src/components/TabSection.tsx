import React from "react";

interface TabSectionProps {
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  subheading: string;
  subdescription: string;
  linkHref?: string;
  linkText?: string;
}

const TabSection: React.FC<TabSectionProps> = ({
  title,
  description,
  imageSrc = "/placeholder.svg",
  imageAlt = "Feature demo",
  subheading,
  subdescription,
  linkHref = "#",
  linkText = "Learn More →",
}) => (
  <section className="w-full flex flex-col items-center py-24 bg-[#101624]">
    <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
      {title}
    </h2>
    <p className="text-lg md:text-xl text-gray-300 text-center max-w-2xl mb-10">
      {description}
    </p>
    <div className="relative w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl mb-14 bg-transparent p-8 md:p-16 flex justify-center items-center">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="relative z-10 w-full"
        style={{ aspectRatio: "16/9", objectFit: "cover" }}
      />
      {/* Video player UI overlay */}
    </div>
    <h3 className="text-2xl md:text-3xl font-semibold text-white text-center mb-2">
      {subheading}
    </h3>
    <p className="text-base md:text-lg text-gray-300 text-center max-w-xl mb-4">
      {subdescription}
    </p>
    <a
      href={linkHref}
      className="text-[#f3f9f3] font-semibold text-base md:text-lg hover:underline transition"
    >
      {linkText}
    </a>
  </section>
);

export default TabSection;