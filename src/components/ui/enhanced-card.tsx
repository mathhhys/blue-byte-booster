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