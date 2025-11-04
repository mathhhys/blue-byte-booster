import React from 'react';
import {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardDemo,
  EnhancedCardIcon
} from './ui/enhanced-card';

const LinterIntegrationCard: React.FC = () => {
  return (
    <EnhancedCard
      variant="primary"
      size="standard"
      className="h-full"
      aria-label="Feature: Linter Integration"
    >
      <EnhancedCardHeader>
        <EnhancedCardIcon size="small" variant="primary">
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="m4.952 16.354 5.263-10.497c.738-1.472 2.839-1.472 3.576 0l5.258 10.497a2 2 0 0 1-1.788 2.896H6.741a2 2 0 0 1-1.789-2.896"
            />
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v2"
            />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
        </EnhancedCardIcon>
        <EnhancedCardTitle variant="primary">
          Linter Integration
        </EnhancedCardTitle>
        <EnhancedCardDescription variant="primary" className="text-sk-black/70">
          If Cascade generates code that doesn't pass a linter, then Cascade will automatically fix the errors
        </EnhancedCardDescription>
      </EnhancedCardHeader>
      <EnhancedCardDemo className="flex flex-col justify-end">
        <img
          alt="An image for a fake blog post titled Linter Integration"
          loading="lazy"
          width="666"
          height="496"
          decoding="async"
          data-nimg="1"
          className="-mb-3 h-auto w-full pl-5"
          src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/Lint%20error%20(1).png"
          style={{ color: 'transparent' }}
        />
      </EnhancedCardDemo>
    </EnhancedCard>
  );
};

export default LinterIntegrationCard;