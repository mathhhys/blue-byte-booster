import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, User } from "lucide-react";
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrolled = scrollPosition > 50;
      setIsScrolled(scrolled);
      if (scrolled) {
        document.body.classList.add('scrolled');
      } else {
        document.body.classList.remove('scrolled');
      }
    };
  
    // Run once to sync initial state (useful on refresh or anchor navigation)
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.body.classList.remove('scrolled');
    };
  }, []);

  // Handle keyboard navigation and focus management
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMobileMenuOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsMobileMenuOpen(false);
          break;
        case 'Tab':
          handleTabNavigation(event);
          break;
      }
    };

    const handleTabNavigation = (event: KeyboardEvent) => {
      if (!menuRef.current) return;

      const focusableElements = menuRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      // Focus first interactive element after animation
      setTimeout(() => {
        const firstButton = menuRef.current?.querySelector('button') as HTMLElement;
        firstButton?.focus();
      }, 100);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMobileMenuOpen(false);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? "navbar-scrolled-bg backdrop-blur-md border-b border-gray-200/50 shadow-sm"
            : "bg-slate-900"
        }`}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="relative w-auto h-6 overflow-hidden" style={{ display: "inline-block" }}>
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
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center justify-center space-x-8">
              <Link
                to="/pricing"
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isScrolled ? "text-gray-700" : "text-white"
                }`}
                style={{ textDecoration: "none" }}
              >
                PRICING
              </Link>
              <Link
                to="/#features"
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isScrolled ? "text-gray-700" : "text-white"
                }`}
                style={{ textDecoration: "none" }}
                onClick={() => {
                  if (window.location.pathname === "/") {
                    scrollToSection("features");
                  }
                }}
              >
                FEATURES
              </Link>
              <Link
                to="/teams"
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isScrolled ? "text-gray-700" : "text-white"
                }`}
                style={{ textDecoration: "none" }}
              >
                TEAMS & ENTERPRISE
              </Link>
              <div className="relative group">
                <button
                  className={`flex items-center text-sm font-medium transition-colors hover:text-blue-600 ${
                    isScrolled ? "text-gray-700" : "text-white"
                  }`}
                >
                  DOCS
                </button>
              </div>
              <div className="relative group">
                <button
                  className={`flex items-center text-sm font-medium transition-colors hover:text-blue-600 ${
                    isScrolled ? "text-gray-700" : "text-white"
                  }`}
                >
                  RESSOURCES
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
                <div className="absolute left-0 mt-2 w-48 bg-white shadow-lg rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                  <Link
                    to="/updates"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    style={{ textDecoration: "none" }}
                  >
                    Updates
                  </Link>
                  <a
                    href="https://softcodes.discourse.group/c/feature-requests/5"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    style={{ textDecoration: "none" }}
                  >
                    Feature Requests
                  </a>
                </div>
              </div>
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              {!isLoaded || !isSignedIn ? (
                <>
                  <button
                    onClick={() => navigate('/sign-in')}
                    className="p-2 rounded-full border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-5 h-5 text-gray-600" />
                  </button>
                  <Button
                    onClick={() => navigate('/sign-up')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    GET STARTED
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => navigate('/dashboard')}
                    variant="ghost"
                    className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                      isScrolled ? "text-gray-700" : "text-white"
                    }`}
                  >
                    Dashboard
                  </Button>
                  <UserButton
                    appearance={{
                      baseTheme: isScrolled ? undefined : dark,
                      elements: {
                        avatarBox: 'w-8 h-8',
                      },
                    }}
                  />
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
                <div className={`hamburger-icon ${isMobileMenuOpen ? 'open' : ''}`}>
                  <span className={`hamburger-line ${isScrolled ? "bg-gray-700" : "bg-white"}`}></span>
                  <span className={`hamburger-line ${isScrolled ? "bg-gray-700" : "bg-white"}`}></span>
                  <span className={`hamburger-line ${isScrolled ? "bg-gray-700" : "bg-white"}`}></span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          ref={menuRef}
          className={`fixed inset-0 z-50 md:hidden mobile-menu-overlay ${isMobileMenuOpen ? 'animate-in' : 'animate-out'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-menu-title"
          aria-describedby="mobile-menu-description"
          id="mobile-menu"
        >
          <h2 id="mobile-menu-title" className="sr-only">
            Navigation Menu
          </h2>
          <p id="mobile-menu-description" className="sr-only">
            Main navigation menu with links to different sections
          </p>
          
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#101828] transition-none"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          
          {/* Menu Content */}
          <div className={`mobile-menu-content ${isMobileMenuOpen ? 'slide-in' : 'slide-out'} flex flex-col h-full justify-center items-center px-6 py-8`}>
            {/* Close Button */}
            <button
              className="absolute top-6 right-6 p-2 text-gray-300 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors duration-200 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#101828] rounded-lg"
              onClick={closeMobileMenu}
              aria-label="Close mobile menu"
            >
              <X className="w-7 h-7" />
            </button>

            {/* Navigation Items */}
            <nav role="navigation" aria-label="Mobile navigation" className="flex flex-col items-center justify-center space-y-6 w-full min-h-[40vh] max-w-[420px] mx-auto py-4">
              <Link
                to="/pricing"
                className="w-full flex justify-center text-xl font-bold tracking-wide text-gray-200 hover:text-white transition-colors focus:outline-none text-center"
                style={{ letterSpacing: "0.02em", textDecoration: "none" }}
                onClick={closeMobileMenu}
              >
                PRICING
              </Link>

              <Link
                to="/#features"
                className="w-full flex justify-center text-xl font-bold tracking-wide text-gray-200 hover:text-white transition-colors focus:outline-none text-center"
                style={{ letterSpacing: "0.02em", textDecoration: "none" }}
                onClick={() => {
                  if (window.location.pathname === "/") {
                    scrollToSection("features");
                  }
                  closeMobileMenu();
                }}
              >
                FEATURES
              </Link>

              <Link
                to="/teams"
                className="w-full flex justify-center text-xl font-bold tracking-wide text-gray-200 hover:text-white transition-colors focus:outline-none text-center"
                style={{ letterSpacing: "0.02em", textDecoration: "none" }}
                onClick={closeMobileMenu}
              >
                TEAMS & ENTERPRISE
              </Link>

              <button
                onClick={() => {
                  scrollToSection("documentation");
                }}
                className="w-full flex justify-center text-xl font-bold tracking-wide text-gray-200 hover:text-white transition-colors focus:outline-none text-center"
                style={{ letterSpacing: "0.02em" }}
              >
                DOCS
              </button>

              {/* Resources (matches desktop dropdown) */}
              <div className="w-full flex flex-col items-center">
                <button
                  onClick={() => setShowResources((s) => !s)}
                  aria-expanded={showResources}
                  className="w-full flex justify-center text-xl font-bold tracking-wide text-gray-200 hover:text-white transition-colors focus:outline-none text-center"
                  style={{ letterSpacing: "0.02em" }}
                >
                  RESSOURCES
                </button>

                {showResources && (
                  <div className="mt-4 w-full flex flex-col items-center space-y-4">
                    <Link
                      to="/updates"
                      className="w-full text-base text-gray-300 hover:text-white text-center px-2"
                      style={{ textDecoration: "none" }}
                      onClick={() => {
                        closeMobileMenu();
                      }}
                    >
                      Updates
                    </Link>
                    <a
                      href="https://softcodes.discourse.group/c/feature-requests/5"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-base text-gray-300 hover:text-white text-center px-2"
                      onClick={() => {
                        closeMobileMenu();
                      }}
                      style={{ textDecoration: "none" }}
                    >
                      Feature Requests
                    </a>
                  </div>
                )}
              </div>
            </nav>

            {/* Divider */}
            <div className="w-full border-t border-gray-700 my-10" />

            {/* Action Buttons */}
            <div className="flex flex-col w-full max-w-[420px] mx-auto space-y-4 items-center pb-6">
              {!isLoaded || !isSignedIn ? (
                <>
                  <button
                    onClick={() => {
                      navigate('/sign-in');
                      closeMobileMenu();
                    }}
                    className="w-full border border-blue-600 text-blue-600 bg-transparent rounded-xl py-3 text-lg font-medium transition-colors hover:bg-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#101828]"
                  >
                    Sign In
                  </button>
                  <Button
                    onClick={() => {
                      navigate('/sign-up');
                      closeMobileMenu();
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-lg font-semibold transition-colors shadow-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#101828]"
                  >
                    GET STARTED
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    navigate('/dashboard');
                    closeMobileMenu();
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-lg font-semibold transition-colors shadow-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#101828]"
                >
                  Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;