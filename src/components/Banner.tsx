import { Link } from "react-router-dom";

const Banner = () => {
  return (
    <section
      className="fixed top-0 left-0 right-0 z-50 bg-primary text-white h-10 w-full flex items-center"
      role="banner"
      aria-label="Announcement: New AI models supported"
    >
      <div className="container mx-auto px-4 text-center">
        <Link to="/pricing" className="text-sm font-medium hover:underline">
          🚀 Now supporting Gemini 3 Pro and GPT 5.2 models!
        </Link>
      </div>
    </section>
  );
};

export default Banner;