import React from 'react';
import {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardDemo,
  EnhancedCardIcon
} from './ui/enhanced-card';

interface PlaceholderCardProps {
  title: string;
  description: string;
  imagePlaceholder?: string;
}

const PlaceholderCard: React.FC<PlaceholderCardProps> = ({ title, description, imagePlaceholder }) => {
  return (
    <EnhancedCard
      variant="placeholder"
      size="standard"
      className="h-[500px]"
      aria-label={`Feature: ${title}`}
    >
      <EnhancedCardHeader>
        <EnhancedCardIcon size="small" variant="placeholder">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L22 20H2L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </EnhancedCardIcon>
        <EnhancedCardTitle variant="placeholder">
          {title}
        </EnhancedCardTitle>
        <EnhancedCardDescription variant="placeholder">
          {description}
        </EnhancedCardDescription>
      </EnhancedCardHeader>
      
      {/* Image / Code Preview */}
      <div className="flex-1 w-full">
        {imagePlaceholder ? (
          <img
            src={imagePlaceholder}
            alt={title}
            className="block w-[calc(100%+3rem)] -mx-6 rounded-t-2xl mb-0 object-cover bg-white"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center rounded-lg">
            <span className="text-gray-400 text-sm">Visual Placeholder</span>
          </div>
        )}
      </div>
    </EnhancedCard>
  );
};

interface FeatureShowcasePlaceholdersProps {
  cards: { title: string; description: string; imagePlaceholder?: string }[];
}

const FeatureShowcasePlaceholders: React.FC<FeatureShowcasePlaceholdersProps> = ({ cards }) => {
  const defaultCards = cards.length ? cards : [
    {
      title: 'Linter Integration',
      description: "If Cascade generates code that doesn't pass a linter, then Cascade will automatically fix the errors",
      imagePlaceholder: '/linter-integration.png'
    }
  ];

  return (
    <section
      className="w-full py-24 px-4 overflow-hidden endless-capabilities-section"
      style={{ backgroundColor: '#0F1629' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {defaultCards.map((card, i) => (
            <PlaceholderCard
              key={i}
              title={card.title}
              description={card.description}
              imagePlaceholder={card.imagePlaceholder}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcasePlaceholders;