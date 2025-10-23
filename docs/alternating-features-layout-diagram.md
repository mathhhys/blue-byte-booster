# Alternating Features Section - Layout Diagram

## Desktop Layout (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ALTERNATING FEATURES SECTION                         │
│                     Background: #0E172A (Dark Navy)                     │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────────────────┐
│  ROW 1                           │                                      │
│  ┌────────────────────────────┐  │  ┌────────────────────────────────┐ │
│  │                            │  │  │                                │ │
│  │   TERMINAL MOCKUP          │  │  │  Agent turns ideas into code   │ │
│  │   (Dark background)        │  │  │                                │ │
│  │   - Command prompts        │  │  │  A human-AI programmer...      │ │
│  │   - AI agent patterns      │  │  │                                │ │
│  │   - Progress indicators    │  │  │  Learn about Agent →           │ │
│  │                            │  │  │                                │ │
│  └────────────────────────────┘  │  └────────────────────────────────┘ │
│         IMAGE (Left)             │         TEXT (Right)                │
└──────────────────────────────────┴──────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────────────────┐
│  ROW 2                           │                                      │
│  ┌────────────────────────────┐  │  ┌────────────────────────────────┐ │
│  │                            │  │  │                                │ │
│  │ Magically accurate         │  │  │   CODE EDITOR MOCKUP           │ │
│  │ autocomplete               │  │  │   (Dark background)            │ │
│  │                            │  │  │   - Syntax highlighting        │ │
│  │ Our custom Tab model...    │  │  │   - Tab suggestions            │ │
│  │                            │  │  │   - Code completion            │ │
│  │ Learn about Tab →          │  │  │                                │ │
│  │                            │  │  │                                │ │
│  └────────────────────────────┘  │  └────────────────────────────────┘ │
│         TEXT (Left)              │         IMAGE (Right)               │
└──────────────────────────────────┴──────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────────────────┐
│  ROW 3                           │                                      │
│  ┌────────────────────────────┐  │  ┌────────────────────────────────┐ │
│  │                            │  │  │                                │ │
│  │   CHAT INTERFACE MOCKUP    │  │  │  Everywhere software gets built│ │
│  │   (Slack-like)             │  │  │                                │ │
│  │   - User messages          │  │  │  Cursor is in GitHub...        │ │
│  │   - Code snippets          │  │  │                                │ │
│  │   - Bot interactions       │  │  │  Learn about Cursor's ecosystem│ │
│  │                            │  │  │                                │ │
│  └────────────────────────────┘  │  └────────────────────────────────┘ │
│         IMAGE (Left)             │         TEXT (Right)                │
└──────────────────────────────────┴──────────────────────────────────────┘

## Mobile Layout (<768px)

```
┌─────────────────────────────────────┐
│  ROW 1                              │
│  ┌───────────────────────────────┐  │
│  │   TERMINAL MOCKUP             │  │
│  │   (Image always appears first)│  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Agent turns ideas into code │  │
│  │   (Text below image)          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ROW 2                              │
│  ┌───────────────────────────────┐  │
│  │   CODE EDITOR MOCKUP          │  │
│  │   (Image always appears first)│  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Magically accurate          │  │
│  │   autocomplete (Text below)   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ROW 3                              │
│  ┌───────────────────────────────┐  │
│  │   CHAT INTERFACE MOCKUP       │  │
│  │   (Image always appears first)│  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   Everywhere software gets    │  │
│  │   built (Text below)          │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Key Visual Elements

### Image Container Styling
- Background: `#181f33` (Dark blue-gray)
- Border: `1px solid rgba(59, 130, 246, 0.2)` (Blue with 20% opacity)
- Border radius: `0.75rem` (12px)
- Shadow: Soft glow with blue tint
- Min height: 400px desktop, 300px mobile
- Hover: Slight scale and shadow increase

### Text Content Styling
- Headings: 48px (desktop) / 36px (mobile), Bold, White
- Body: 20px (desktop) / 18px (mobile), Gray-300
- CTA Links: Orange-400, with right arrow icon
- Max width: 36rem (576px) to ensure readability

### Spacing
- Between rows: 96px (24rem / mb-24)
- Between image and text: 64px (16rem / gap-16)
- Section padding: 96px vertical (py-24)
- Container max-width: 1280px (max-w-7xl)

## Animation Specifications

### On Scroll (Optional Enhancement)
```
Row appears from opacity 0 → 1
With slight upward movement (translateY 20px → 0)
Duration: 600ms
Easing: ease-out
Stagger delay: 200ms between rows
```

### Hover States
```
Image containers:
  - Scale: 1 → 1.02
  - Shadow: Increases intensity
  - Transition: 300ms ease

CTA Links:
  - Color: orange-400 → orange-300
  - Underline appears
  - Arrow shifts right 4px
  - Transition: 200ms ease
```

## Responsive Breakpoints

- **Mobile**: < 768px (Single column, image always first)
- **Tablet**: 768px - 1023px (Two columns, reduced gaps)
- **Desktop**: ≥ 1024px (Two columns, full spacing)
- **Wide**: ≥ 1280px (Max container width applied)