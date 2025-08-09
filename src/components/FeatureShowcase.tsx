import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Layers3,
  ArrowRight,
  Sparkles,
  Edit3,
  ChevronLeft,
  ChevronRight
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
 
const baseFeatures: FeatureData[] = [
  {
    id: 'linter-integration',
    icon: AlertTriangle,
    title: 'Linter Integration',
    description: 'If Cascade generates code that doesn\'t pass a linter, then Cascade will automatically fix the errors',
    codeDemo: (
      <img
        alt="An image for a fake blog post titled Linter Integration"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        data-nimg="1"
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
    description: 'Enhance your AI workflows by connecting to custom tools and services',
    codeDemo: (
      <img
        alt="An image for a fake blog post titled MCP Protocol"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        data-nimg="1"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'tab-to-jump',
    icon: ArrowRight,
    title: 'Tab to Jump',
    description: 'Predicts the next location of your cursor to seamlessly navigate through the file',
    codeDemo: (
      <img
        alt="An image for a fake blog post titled Tab to Jump"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        data-nimg="1"
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
    description: 'Supercomplete analyzes what your next action might be, beyond just inserting a code snippet',
    codeDemo: (
      <img
        alt="An image for a fake blog post titled Supercomplete"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        data-nimg="1"
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
    description: 'Precise inline editing capabilities for seamless code modifications',
    codeDemo: (
      <img
        alt="An image for a fake blog post titled In-line Edit"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        data-nimg="1"
        className="-mb-3 h-auto w-full pl-5"
        src="/linter-integration.png"
        style={{ color: 'transparent' }}
      />
    )
  }
];

const enhancedFeatures: FeatureData[] = Array.from({ length: 9 }).map((_, i) => {
  const feature = baseFeatures[i % baseFeatures.length];
  return { ...feature, id: `${feature.id}-${i}` };
});

const EnhancedFeatureShowcase: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCards, setVisibleCards] = useState(5);

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
    // Ensure fluid scaling of card widths with breakpoints

    updateVisibleCards();
    window.addEventListener('resize', updateVisibleCards);
    return () => window.removeEventListener('resize', updateVisibleCards);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => {
      const maxIndex = enhancedFeatures.length - visibleCards;
      return prev >= maxIndex ? 0 : prev + 1;
    });
  }, [visibleCards]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => {
      const maxIndex = enhancedFeatures.length - visibleCards;
      return prev <= 0 ? maxIndex : prev - 1;
    });
  }, [visibleCards]);

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
              {enhancedFeatures.map((feature, index) => (
                <div
                  key={feature.id}
                  className="flex-shrink-0 px-3"
                  style={{ width: `${cardWidth}%` }}
                >
                  <div
                    className="relative flex w-[320px] shrink-0 flex-col md:w-[380px]"
                    style={{ marginRight: 20 }}
                  >
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
                  </div>
                </div>
              ))}
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
            {Array.from({ length: enhancedFeatures.length - visibleCards + 1 }).map((_, index) => (
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