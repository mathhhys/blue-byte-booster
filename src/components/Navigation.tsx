import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, User } from "lucide-react";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm"
            : "bg-slate-900"
        }`}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <div className="relative w-auto h-6 overflow-hidden">
                <img
                  src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/softcodes%20logo%20navbar%20desktop%20not%20scrolled.svg"
                  alt="Softcodes Logo"
                  className={`h-6 w-auto object-contain transition-opacity duration-300 ${
                    isScrolled ? "opacity-0 absolute" : "opacity-100"
                  }`}
                  loading="eager"
                />
                <img
                  src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/64f13509d1c4365f30a60404_logo%20softcodes_-p-500.svg"
                  alt="Softcodes Logo"
                  className={`h-6 w-auto object-contain transition-opacity duration-300 ${
                    isScrolled ? "opacity-100" : "opacity-0 absolute"
                  }`}
                  loading="eager"
                />
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection("features")}
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isScrolled ? "text-gray-700" : "text-white"
                }`}
              >
                FEATURES
              </button>
              <button
                onClick={() => scrollToSection("pricing")}
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isScrolled ? "text-gray-700" : "text-white"
                }`}
              >
                PRICING
              </button>
              <button
                onClick={() => scrollToSection("blog")}
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isScrolled ? "text-gray-700" : "text-white"
                }`}
              >
                BLOG
              </button>
              <div className="relative group">
                <button
                  className={`flex items-center text-sm font-medium transition-colors hover:text-blue-600 ${
                    isScrolled ? "text-gray-700" : "text-white"
                  }`}
                >
                  RESOURCES
                  <ChevronDown className="ml-1 w-4 h-4" />
                </button>
              </div>
              <div className="relative group">
                <button
                  className={`flex items-center text-sm font-medium transition-colors hover:text-blue-600 ${
                    isScrolled ? "text-gray-700" : "text-white"
                  }`}
                >
                  COMPANY
                  <ChevronDown className="ml-1 w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="p-2 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors">
                <User className="w-5 h-5 text-gray-600" />
              </button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-medium transition-colors"
              >
                GET STARTED
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className={`w-6 h-6 ${isScrolled ? "text-gray-700" : "text-white"}`} />
              ) : (
                <Menu className={`w-6 h-6 ${isScrolled ? "text-gray-700" : "text-white"}`} />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute top-0 right-0 w-80 h-full bg-white shadow-xl">
            <div className="flex flex-col p-6 pt-20 space-y-8">
              <div className="space-y-6">
                <button
                  onClick={() => scrollToSection("features")}
                  className="block text-left text-lg font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  FEATURES
                </button>
                <button
                  onClick={() => scrollToSection("pricing")}
                  className="block text-left text-lg font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  PRICING
                </button>
                <button
                  onClick={() => scrollToSection("blog")}
                  className="block text-left text-lg font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  BLOG
                </button>
                <button className="block text-left text-lg font-medium text-gray-700 hover:text-blue-600 transition-colors">
                  RESOURCES
                </button>
                <button className="block text-left text-lg font-medium text-gray-700 hover:text-blue-600 transition-colors">
                  COMPANY
                </button>
              </div>
              
              <div className="pt-6 border-t border-gray-200 space-y-4">
                <button className="flex items-center justify-center w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <User className="w-5 h-5 text-gray-600 mr-2" />
                  Sign In
                </button>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium">
                  GET STARTED
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;