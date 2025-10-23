# Alternating Features Section - Design Specification

## Overview
This component creates an alternating image-text layout positioned directly under the Hero section. It showcases three key features with visual mockups, following the established Softcodes branding.

## Layout Structure

### Pattern
```
Row 1: [IMAGE] [TEXT]     - Agent turns ideas into code
Row 2: [TEXT] [IMAGE]     - Magically accurate autocomplete  
Row 3: [IMAGE] [TEXT]     - Everywhere software gets built
```

## Branding & Colors

### Background
- Section background: `#0E172A` (matches ProductivitySection)
- Padding: `py-24` (96px vertical)

### Image Containers
- Background: `#181f33` (card background)
- Border: `border-blue-500/20`
- Border radius: `rounded-xl`
- Shadow: `shadow-lg shadow-blue-500/10`
- Min height: `400px` on desktop, `300px` on mobile

### Typography
- Headings: `text-3xl md:text-4xl font-bold text-white`
- Descriptions: `text-lg md:text-xl text-gray-300 leading-relaxed`
- Max width for text: `max-w-xl`

## Responsive Behavior

### Desktop (≥1024px)
- Two-column grid: `grid-cols-2`
- Gap: `gap-16`
- Image and text take 50% width each
- Max container width: `max-w-7xl`

### Tablet (768px - 1023px)
- Two-column grid maintained
- Gap: `gap-12`
- Slightly reduced padding

### Mobile (<768px)
- Single column: `grid-cols-1`
- Image always appears first, then text below
- Gap: `gap-8`
- Full width containers

## Content Structure

### Row 1: Agent turns ideas into code
**Position:** Image Left, Text Right

**Text Content:**
- Heading: "Agent turns ideas into code"
- Description: "A human-AI programmer, orders of magnitude more effective than any developer alone."
- CTA: "Learn about Agent →" (orange link text: `text-orange-400`)

**Visual Mockup:**
Terminal/command interface showing:
- Dark background (#0D0E0F)
- Command prompt with green accent
- List of AI agent usage patterns:
  - Enterprise Order Management
  - Python WDDF Experiments Framework
  - Fix PR Comments Fetching
  - Analysis Tab vs Agent Usage Patterns
  - Set up Cursor Build
  - Environments Tools
- Progress indicators and command outputs
- Blue and green accent colors for highlights

### Row 2: Magically accurate autocomplete
**Position:** Text Left, Image Right

**Text Content:**
- Heading: "Magically accurate autocomplete"
- Description: "Our custom Tab model predicts your next action with striking speed and precision."
- CTA: "Learn about Tab →" (orange link text: `text-orange-400`)

**Visual Mockup:**
Code editor interface showing:
- Dark code editor background
- TypeScript/JavaScript code with syntax highlighting
- Tab autocomplete suggestions showing:
  - Function suggestions
  - Parameter completion
  - Import statements
- Cursor position indicator
- Line numbers
- Syntax highlighting: blue for keywords, white for text, green for strings

### Row 3: Everywhere software gets built
**Position:** Image Left, Text Right

**Text Content:**
- Heading: "Everywhere software gets built"
- Description: "Cursor is in GitHub codebases of a teammate in Slack, and anywhere else you work."
- CTA: "Learn about Cursor's ecosystem →" (orange link text: `text-orange-400`)

**Visual Mockup:**
Chat/collaboration interface showing:
- Slack-like interface
- User avatars and names
- Conversation about code changes
- Inline code snippets with syntax highlighting
- Cursor mentions and bot interactions
- Function definitions and bug reports
- Dark theme with proper message threading

## Animation & Interactions

### Hover Effects
- Image containers: Slight lift with `hover:transform hover:scale-[1.02]`
- Shadows intensify: `hover:shadow-xl hover:shadow-blue-500/20`
- Transition: `transition-all duration-300`

### CTA Links
- Default: `text-orange-400 font-semibold`
- Hover: `hover:text-orange-300 hover:underline`
- Arrow icon animates slightly to the right on hover

### Scroll Animations (Optional)
- Fade in on scroll: `opacity-0 animate-in`
- Slight slide up effect when entering viewport

## Accessibility

- Semantic HTML: `<section>` with proper heading hierarchy
- Alt text for all visual mockups
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus visible states for links
- Sufficient color contrast (WCAG AA compliant)

## Code Structure

```tsx
<section className="w-full bg-[#0E172A] py-24">
  <div className="container mx-auto px-6 max-w-7xl">
    {/* Row 1: Image Left, Text Right */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
      <div>{/* Image mockup */}</div>
      <div>{/* Text content */}</div>
    </div>
    
    {/* Row 2: Text Left, Image Right */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
      <div className="order-2 lg:order-1">{/* Text content */}</div>
      <div className="order-1 lg:order-2">{/* Image mockup */}</div>
    </div>
    
    {/* Row 3: Image Left, Text Right */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      <div>{/* Image mockup */}</div>
      <div>{/* Text content */}</div>
    </div>
  </div>
</section>
```

## Visual Mockup Implementation

Each mockup will be created using:
- SVG elements for scalability
- CSS for styling and animations
- Monospace fonts for code/terminal (`font-mono`)
- Proper color theming matching the design system

### Terminal Mockup Classes
```css
.terminal-window {
  background: #0D0E0F;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 0.75rem;
  padding: 1.5rem;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.875rem;
}
```

### Code Editor Mockup Classes
```css
.code-editor {
  background: #1e1e1e;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 0.75rem;
  padding: 1.5rem;
  font-family: 'Monaco', 'Menlo', monospace;
}
```

### Chat Interface Mockup Classes
```css
.chat-interface {
  background: #0D0E0F;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 0.75rem;
  padding: 1.5rem;
}
```

## Integration

Add to `Index.tsx` immediately after the Hero component:

```tsx
<Hero />
<AlternatingFeaturesSection />
<ProductivitySection />
```

## File Location
Create component at: `src/components/AlternatingFeaturesSection.tsx`

## Dependencies
- React
- Lucide icons (for arrow in CTA links)
- Tailwind CSS classes
- Existing design system utilities