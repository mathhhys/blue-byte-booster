# Card Design System Implementation Roadmap

## Phase 1: Foundation Setup

### Step 1: Update Tailwind Configuration
**File**: `tailwind.config.ts`

Add the following to the `colors` section in the `extend` object:

```typescript
colors: {
  // ... existing colors
  'sk-black': '#0D0E0F',
  'sk-sand': '#F9F3E9', 
  'sk-placeholder': '#0B100F',
}
```

### Step 2: Add CSS Utility Classes
**File**: `src/index.css`

Add the following at the end of the file:

```css
/* Card Design System Utilities */

/* Background colors */
.bg-sk-black {
  background-color: #0D0E0F;
}

.bg-sk-sand {
  background-color: #F9F3E9;
}

.bg-sk-placeholder {
  background-color: #0B100F;
}

/* Text colors */
.text-sk-black {
  color: #0D0E0F;
}

.text-sk-sand {
  color: #F9F3E9;
}

/* Text with opacity */
.text-sk-black\/50 {
  color: rgba(13, 14, 15, 0.5);
}

.text-sk-sand\/50 {
  color: rgba(249, 243, 233, 0.5);
}

/* Card Typography */
.card-title-primary {
  @apply text-xl font-semibold text-sk-black mb-3;
}

.card-title-secondary {
  @apply text-2xl font-bold text-white mb-3;
}

.card-description-primary {
  @apply text-sm text-sk-black/70 leading-relaxed;
}

.card-description-secondary {
  @apply text-base text-gray-300 leading-relaxed;
}

/* Card Interactive States */
.card-hover {
  @apply transition-all duration-300 hover:shadow-xl hover:-translate-y-1;
}

.card-hover-enhanced {
  @apply transition-all duration-300 hover:shadow-3xl hover:-translate-y-1;
}

.card-focus {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

/* Card Shadows */
.shadow-card-light {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.shadow-card-dark {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.shadow-card-hover {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

/* Card Borders */
.border-card-light {
  @apply border border-gray-200/20;
}

.border-card-dark {
  @apply border border-white/10;
}

.border-card-placeholder {
  @apply border border-gray-600/20;
}

/* Responsive Card Adjustments */
@media (max-width: 768px) {
  .card-responsive {
    @apply p-4 min-h-[350px];
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .card-responsive {
    @apply p-6 min-h-[380px];
  }
}

@media (min-width: 1025px) {
  .card-responsive {
    @apply p-6 min-h-[400px];
  }
}
```

## Phase 2: Enhanced Card Components

### Step 3: Create Enhanced Card Component
**File**: `src/components/ui/enhanced-card.tsx`

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'placeholder'
  size?: 'standard' | 'feature' | 'compact'
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, variant = 'primary', size = 'standard', ...props }, ref) => {
    const baseClasses = "rounded-lg transition-all duration-300 card-focus"
    
    const variantClasses = {
      primary: "bg-sk-sand border-card-light shadow-card-light card-hover",
      secondary: "bg-[#181f33] border-card-dark shadow-card-dark card-hover-enhanced",
      placeholder: "bg-sk-placeholder border-card-placeholder shadow-card-light card-hover"
    }
    
    const sizeClasses = {
      standard: "p-6 min-h-[400px]",
      feature: "p-8 min-h-[370px]",
      compact: "p-4 min-h-[300px]"
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        role="article"
        tabIndex={0}
        {...props}
      />
    )
  }
)
EnhancedCard.displayName = "EnhancedCard"

const EnhancedCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'primary' | 'secondary' | 'placeholder' }
>(({ className, variant = 'primary', ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-4 mb-6", className)}
    {...props}
  />
))
EnhancedCardHeader.displayName = "EnhancedCardHeader"

const EnhancedCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { variant?: 'primary' | 'secondary' | 'placeholder' }
>(({ className, variant = 'primary', ...props }, ref) => {
  const variantClasses = {
    primary: "card-title-primary",
    secondary: "card-title-secondary", 
    placeholder: "text-xl font-semibold text-gray-300 mb-3"
  }
  
  return (
    <h3
      ref={ref}
      className={cn(variantClasses[variant], className)}
      {...props}
    />
  )
})
EnhancedCardTitle.displayName = "EnhancedCardTitle"

const EnhancedCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & { variant?: 'primary' | 'secondary' | 'placeholder' }
>(({ className, variant = 'primary', ...props }, ref) => {
  const variantClasses = {
    primary: "card-description-primary",
    secondary: "card-description-secondary",
    placeholder: "text-sm text-gray-400 leading-relaxed"
  }
  
  return (
    <p
      ref={ref}
      className={cn(variantClasses[variant], className)}
      {...props}
    />
  )
})
EnhancedCardDescription.displayName = "EnhancedCardDescription"

const EnhancedCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex-1", className)} {...props} />
))
EnhancedCardContent.displayName = "EnhancedCardContent"

const EnhancedCardDemo = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-sk-black rounded-b-lg h-[250px] -mx-6 -mb-6 mt-auto overflow-hidden",
      className
    )}
    {...props}
  />
))
EnhancedCardDemo.displayName = "EnhancedCardDemo"

const EnhancedCardIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { 
    size?: 'small' | 'large'
    variant?: 'primary' | 'secondary' | 'placeholder'
  }
>(({ className, size = 'small', variant = 'primary', ...props }, ref) => {
  const sizeClasses = {
    small: "w-6 h-6",
    large: "w-24 h-24"
  }
  
  const variantClasses = {
    primary: "text-sk-black",
    secondary: "bg-white/10 rounded-xl p-2",
    placeholder: "text-gray-300"
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
EnhancedCardIcon.displayName = "EnhancedCardIcon"

export {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardContent,
  EnhancedCardDemo,
  EnhancedCardIcon
}
```

## Phase 3: Component Updates

### Step 4: Update FeatureShowcase Component
**File**: `src/components/FeatureShowcase.tsx`

**Changes Required**:
1. Import the new EnhancedCard components
2. Replace the existing card structure with EnhancedCard
3. Update the card styling to use the new system
4. Ensure proper accessibility attributes

**Key Changes**:
```tsx
// Replace this structure:
<div className="flex h-full flex-col justify-between rounded-md bg-sk-sand">

// With this:
<EnhancedCard variant="primary" size="standard" aria-label={`Feature: ${feature.title}`}>
  <EnhancedCardHeader>
    <EnhancedCardIcon size="small" variant="primary">
      <feature.icon size={24} />
    </EnhancedCardIcon>
    <EnhancedCardTitle variant="primary">{feature.title}</EnhancedCardTitle>
    <EnhancedCardDescription variant="primary">{feature.description}</EnhancedCardDescription>
  </EnhancedCardHeader>
  <EnhancedCardDemo>
    {feature.codeDemo}
  </EnhancedCardDemo>
</EnhancedCard>
```

### Step 5: Update LinterIntegrationCard Component
**File**: `src/components/LinterIntegrationCard.tsx`

**Changes Required**:
1. Replace the hardcoded card structure with EnhancedCard
2. Use the standardized icon and text components
3. Apply proper accessibility attributes

### Step 6: Update FeatureShowcasePlaceholders Component
**File**: `src/components/FeatureShowcasePlaceholders.tsx`

**Changes Required**:
1. Replace the custom PlaceholderCard with EnhancedCard variant="placeholder"
2. Update the background color to use sk-placeholder (#0B100F)
3. Ensure proper contrast for text elements

### Step 7: Update Features Component
**File**: `src/components/Features.tsx`

**Changes Required**:
1. Replace the hardcoded card divs with EnhancedCard variant="secondary"
2. Use EnhancedCardIcon for the placeholder images
3. Apply consistent sizing and spacing

## Phase 4: Quality Assurance

### Step 8: Accessibility Verification
**Tasks**:
- [ ] Test keyboard navigation between cards
- [ ] Verify screen reader compatibility
- [ ] Check color contrast ratios
- [ ] Ensure proper ARIA labels
- [ ] Test focus indicators

### Step 9: Responsive Testing
**Breakpoints to Test**:
- [ ] Mobile (< 768px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (> 1024px)

**Test Cases**:
- [ ] Card layout adapts properly
- [ ] Text remains readable
- [ ] Interactive states work on touch devices
- [ ] Grid layouts respond correctly

### Step 10: Cross-Component Consistency
**Verification Points**:
- [ ] All cards use the same shadow system
- [ ] Hover effects are consistent
- [ ] Typography scales properly
- [ ] Color usage follows the design system
- [ ] Spacing is uniform across components

## Phase 5: Documentation and Maintenance

### Step 11: Component Documentation
**Create**: `src/components/ui/enhanced-card.stories.tsx` (if using Storybook)

**Document**:
- All card variants with examples
- Proper usage patterns
- Accessibility guidelines
- Responsive behavior

### Step 12: Design System Integration
**Update**: Design system documentation with:
- Card component API
- Usage guidelines
- Do's and don'ts
- Migration guide from old cards

## Implementation Priority

### High Priority (Phase 1-2)
1. Foundation setup (Tailwind config, CSS utilities)
2. Enhanced card component creation
3. Critical component updates (FeatureShowcase, Features)

### Medium Priority (Phase 3)
4. Remaining component updates
5. Accessibility improvements
6. Responsive testing

### Low Priority (Phase 4-5)
7. Documentation updates
8. Storybook integration
9. Design system maintenance

## Success Metrics

### Technical Metrics
- [ ] All `sk-*` classes properly defined and working
- [ ] No console errors related to undefined classes
- [ ] Consistent card dimensions across components
- [ ] Proper contrast ratios (WCAG AA compliance)

### Visual Metrics
- [ ] Uniform card appearance across the interface
- [ ] Smooth hover and focus transitions
- [ ] Proper placeholder background integration (#0B100F)
- [ ] Consistent typography and spacing

### User Experience Metrics
- [ ] Improved keyboard navigation
- [ ] Better screen reader experience
- [ ] Consistent interactive feedback
- [ ] Responsive design across devices

This roadmap provides a comprehensive guide for implementing the card design system while maintaining code quality and user experience standards.