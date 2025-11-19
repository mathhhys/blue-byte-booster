import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Layers3,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Blend,
  SquareLibrary,
  GalleryVerticalEnd,
  SquareTerminal,
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
    id: 'mcp-protocol',
    icon: Layers3,
    title: 'Checkpoints',
    description: 'Save and restore your development progress instantly. Never lose your momentum with intelligent code state management that remembers exactly where you left off.',
    codeDemo: (
      <img
        alt="Checkpoints preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/checkpoint.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'mode-switching',
    icon: Blend,
    title: 'Rules & Memory',
    description: 'Adapt to your coding style and project conventions. Softcodes learns your preferences and applies them across every interaction for truly personalized assistance.',
    codeDemo: (
      <img
        alt="Rules & Memory preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/rules-memory%20(2).png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'local-mode',
    icon: SquareLibrary,
    title: 'Local Mode',
    description: 'Keep your code completely private while enjoying lightning-fast AI assistance. Process everything locally for maximum security without sacrificing performance.',
    codeDemo: (
      <img
        alt="Local Mode preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/localmode.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'Large Context',
    icon: Sparkles,
    title: 'Deep Codebase Knowledge',
    description: 'Understand your entire project context, not just the current file. Get suggestions that consider your architecture, dependencies, and business logic for truly intelligent coding.',
    codeDemo: (
      <img
        alt="Deep Codebase Knowledge preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/context.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'multi-file-edits',
    icon: GalleryVerticalEnd,
    title: 'Model Settings',
    description: 'Fine-tune your AI copilot to match your project\'s unique requirements. Customize model behavior, response style, and technical preferences for optimal collaboration.',
    codeDemo: (
      <img
        alt="Model Settings preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/modelsettings.png"
        style={{ color: 'transparent' }}
      />
    )
  },
  {
    id: 'inline-commands',
    icon: SquareTerminal,
    title: 'Inline Commands',
    description: 'Execute complex development tasks with simple text commands. From refactoring entire modules to generating test suites, just describe what you need and watch it happen.',
    codeDemo: (
      <img
        alt="Inline Commands preview"
        loading="lazy"
        width="666"
        height="496"
        decoding="async"
        className="-mb-3 h-auto w-full pl-5"
        src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/inlinecommands%20(1).png"
        style={{ color: 'transparent' }}
      />
    )
  },
];

const enhancedFeatures: FeatureData[] = baseFeatures;

const EnhancedFeatureShowcase: React.FC<EnhancedFeatureShowcaseProps> = ({ children, cardCount = 6 }) => {
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
  const maxIndex = Math.max(totalItems - visibleCards, 0);
  const totalPages = maxIndex + 1;
 
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
      className="w-full py-16 px-4 overflow-hidden endless-capabilities-section"
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
            className="text-base md:text-lg lg:text-xl font-bold text-white leading-tight"
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
          <div className="flex justify-center items-center gap-4 mt-10">
            <button
              type="button"
              onClick={prevSlide}
              className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Previous features"
            >
              <ChevronLeft size={20} className="text-gray-700" />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Next features"
            >
              <ChevronRight size={20} className="text-gray-700" />
            </button>
          </div>

          {/* Slide Indicators */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                    index === currentIndex ? 'bg-white' : 'bg-white/30'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </section>
  );
};

export default EnhancedFeatureShowcase;