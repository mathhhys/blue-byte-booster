import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Layers3,
  ArrowRight,
  Sparkles,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Blend
} from 'lucide-react';
import {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardDemo,
  EnhancedCardIcon
} from './ui/enhanced-card';

interface FeatureData {
  id: string;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  codeDemo: React.ReactNode;
}

interface EnhancedFeatureShowcaseProps {
  /**
   * Pass custom card elements as children in the exact order you want them displayed.
   * The component renders `cardCount` slots (default 9). For any slot that does not
   * have a provided child, the showcase will render a default card.
   */
  children?: React.ReactNode;
  cardCount?: number;
}
 
const baseFeatures: FeatureData[] = [
  {
    id: 'linter-integration',
    icon: AlertTriangle,
    title: 'Loops on Errors',
    description: 'If Softcodes produces code that fails a linter check, it will automatically correct the issues',
    codeDemo: (
      <img
        alt="Linter integration preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'mcp-protocol',
    icon: Layers3,
    title: 'Model Context Protocol (MCP)',
    description: 'Supercharge your AI workflows by seamlessly integrating with tailored tools and services',
    codeDemo: (
      <img
        alt="MCP protocol preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'mode-switching',
    icon: Blend,
    title: 'Mode Switching',
    description: 'Switch between modes like Architect, Code, or Debug to get the right tool for the job.',
    codeDemo: (
      <img
        alt="Mode switching preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'supercomplete',
    icon: Sparkles,
    title: 'Supercomplete',
    description: 'Anticipates your next action and offers full-featured suggestions beyond plain snippets.',
    codeDemo: (
      <img
        alt="Supercomplete preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'in-line-edit',
    icon: Edit3,
    title: 'In-line Edit',
    description: 'Precise inline editing capabilities for seamless code modifications inside your editor.',
    codeDemo: (
      <img
        alt="Inline edit preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'intelligent-completions',
    icon: ArrowRight,
    title: 'Intelligent Completions',
    description: 'Context-aware completions that respect your project, dependencies, and coding style.',
    codeDemo: (
      <img
        alt="Intelligent completions preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'contextual-search',
    icon: Layers3,
    title: 'Contextual Search',
    description: 'Search across your codebase and docs with semantic understanding, returning precise results.',
    codeDemo: (
      <img
        alt="Contextual search preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'team-collaboration',
    icon: AlertTriangle,
    title: 'Team Collaboration',
    description: 'Share suggestions, comments, and AI sessions with teammates for faster reviews and onboarding.',
    codeDemo: (
      <img
        alt="Team collaboration preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'security-compliance',
    icon: Sparkles,
    title: 'Security & Compliance',
    description: 'Enterprise-grade security, audit logs, and controls to keep your code and data safe.',
    codeDemo: (
      <img
        alt="Security and compliance preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  }
];

const enhancedFeatures: FeatureData[] = baseFeatures;

const EnhancedFeatureShowcase: React.FC<EnhancedFeatureShowcaseProps> = ({ children, cardCount = 9 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCards, setVisibleCards] = useState(5);

  // Normalize children into an array for slot mapping
  const childrenArray = React.Children.toArray(children);

  // Update visible cards based on screen size
  useEffect(() => {
    const updateVisibleCards = () => {
      if (window.innerWidth < 640) {
        setVisibleCards(1);
      } else if (window.innerWidth < 1024) {
        setVisibleCards(2);
      } else {
        setVisibleCards(3);
      }
    };

    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  const totalItems = Math.max(cardCount, enhancedFeatures.length);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => {
      const maxIndex = totalItems - visibleCards;
      return prev >= maxIndex ? 0 : prev + 1;
    });
  }, [visibleCards, totalItems]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => {
      const maxIndex = totalItems - visibleCards;
      return prev <= 0 ? maxIndex : prev - 1;
    });
  }, [visibleCards, totalItems]);

  // Swipe gesture support
  useEffect(() => {
    let startX: number | null = null;
    let endX: number | null = null;
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };
    const handleTouchMove = (e: TouchEvent) => {
      endX = e.touches[0].clientX;
    };
    const handleTouchEnd = () => {
      if (startX !== null && endX !== null) {
        const deltaX = startX - endX;
        if (deltaX > 50) {
          nextSlide();
        } else if (deltaX < -50) {
          prevSlide();
        }
      }
      startX = null;
      endX = null;
    };
    const carousel = document.querySelector('.carousel-wrapper');
    if (carousel) {
      carousel.addEventListener('touchstart', handleTouchStart);
      carousel.addEventListener('touchmove', handleTouchMove);
      carousel.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      if (carousel) {
        carousel.removeEventListener('touchstart', handleTouchStart);
        carousel.removeEventListener('touchmove', handleTouchMove);
        carousel.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [nextSlide, prevSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        prevSlide();
      } else if (event.key === 'ArrowRight') {
        nextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // Show partial next card by reducing width slightly
  const cardWidth = 95 / visibleCards;
  const translateX = -(currentIndex * cardWidth);

  // Helper to render the default card for a given index
  const renderDefaultCard = (index: number) => {
    const feature = enhancedFeatures[index % enhancedFeatures.length];
    return (
      <EnhancedCard
        variant="primary"
        size="standard"
        className="h-full"
        aria-label={`Feature: ${feature.title}`}
      >
        <EnhancedCardHeader>
          <EnhancedCardIcon size="small" variant="primary">
            <feature.icon
              size={24}
              aria-hidden="true"
            />
          </EnhancedCardIcon>
          <EnhancedCardTitle variant="primary">
            {feature.title}
          </EnhancedCardTitle>
          <EnhancedCardDescription variant="primary" className="text-sk-black/70">
            {feature.description}
          </EnhancedCardDescription>
        </EnhancedCardHeader>
        <EnhancedCardDemo className="flex flex-col justify-end">
          {feature.codeDemo}
        </EnhancedCardDemo>
      </EnhancedCard>
    );
  };

  return (
    <section
      className="w-full py-24 px-4 overflow-hidden endless-capabilities-section"
      style={{ backgroundColor: '#0F1629' }}
      aria-labelledby="endless-capabilities-title"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16">
          <p
            className="text-sm font-medium uppercase tracking-wider mb-6"
            style={{ color: '#0052CC' }}
          >
            NOT JUST THE BEST AI-POWERED PLUGIN, BUT THE BEST COPILOT
          </p>
          <h2
            id="endless-capabilities-title"
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight"
          >
            The possibilities are literally endless
          </h2>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Feature Cards Container */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out carousel-wrapper"
              style={{
                transform: `translateX(${translateX}%)`,
              }}
            >
              {Array.from({ length: cardCount }).map((_, index) => {
                const custom = childrenArray[index];
                return (
                  <div
                    key={`feature-slot-${index}`}
                    className="flex-shrink-0 px-3"
                    style={{ width: `${cardWidth}%` }}
                  >
                    <div
                      className="relative flex w-full flex-col"
                      style={{ marginRight: 20 }}
                    >
                      {/* If the user provided a custom child for this slot, render it (full control).
                          Otherwise render the default card for this index. */}
                      {custom ? (
                        <div className="h-full">
                          {custom}
                        </div>
                      ) : (
                        renderDefaultCard(index)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="flex justify-center items-center gap-4 mt-12">
            <button
              onClick={prevSlide}
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 carousel-navigation-button"
              aria-label="Previous feature"
            >
              <ChevronLeft size={20} className="text-gray-700" />
            </button>
            
            <button
              onClick={nextSlide}
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 carousel-navigation-button"
              aria-label="Next feature"
            >
              <ChevronRight size={20} className="text-gray-700" />
            </button>
          </div>

          {/* Slide Indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: Math.max(1, cardCount - visibleCards + 1) }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors duration-200 slide-indicator ${
                  index === currentIndex ? 'active' : 'inactive'
                }`}
                style={{
                  backgroundColor: index === currentIndex ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)'
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EnhancedFeatureShowcase;