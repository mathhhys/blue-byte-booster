# Card Design System - Color Definitions

## Current Analysis of Card Inconsistencies

### Identified Card Patterns:
1. **FeatureShowcase Cards**: `bg-sk-sand` + `bg-sk-black` code sections
2. **Features Component Cards**: `bg-[#181f33]` dark theme
3. **FeatureShowcasePlaceholders**: `bg-[#F5F1E8]` (similar to sk-sand)
4. **LinterIntegrationCard**: `bg-sk-sand` + `bg-sk-black`

### Color Definitions to Add:

```css
/* Custom colors for card system */
.sk-black {
  background-color: #0D0E0F;
}

.sk-sand {
  background-color: #F9F3E9;
}

.sk-placeholder {
  background-color: #0B100F;
}

/* Text colors */
.text-sk-black {
  color: #0D0E0F;
}

.text-sk-sand {
  color: #F9F3E9;
}

/* With opacity variants */
.text-sk-black\/50 {
  color: rgba(13, 14, 15, 0.5);
}

.bg-sk-black {
  background-color: #0D0E0F;
}

.bg-sk-sand {
  background-color: #F9F3E9;
}

.bg-sk-placeholder {
  background-color: #0B100F;
}
```

### Tailwind Config Extension:
```typescript
colors: {
  'sk-black': '#0D0E0F',
  'sk-sand': '#F9F3E9', 
  'sk-placeholder': '#0B100F',
  // ... existing colors
}
```

## Standardized Card Variants

### 1. Primary Card (Light Theme)
- Background: `sk-sand` (#F9F3E9)
- Text: `sk-black` (#0D0E0F)
- Code/Demo Section: `sk-black` (#0D0E0F)

### 2. Secondary Card (Dark Theme)  
- Background: `#181f33` (existing dark blue)
- Text: `white`
- Borders: `border-white/10`

### 3. Placeholder Card
- Background: `sk-placeholder` (#0B100F)
- Text: Light colors for contrast
- Used for empty states and placeholders

## Contrast Ratios
- sk-sand (#F9F3E9) + sk-black (#0D0E0F): Excellent contrast (>7:1)
- sk-placeholder (#0B100F) + white text: Good contrast (>4.5:1)
- Dark cards (#181f33) + white text: Good contrast (>4.5:1)