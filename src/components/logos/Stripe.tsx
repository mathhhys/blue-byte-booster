import React from 'react';
import StripePng from './stripe.png';

export function Stripe() {
  return (
    <img
      src={StripePng}
      alt="Stripe Logo"
      className="w-full h-full object-contain"
    />
  );
}