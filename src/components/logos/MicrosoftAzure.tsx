import React from 'react';
import MicrosoftAzurePng from './Microsoft_Azure.svg.png';

export function MicrosoftAzure() {
  return (
    <img
      src={MicrosoftAzurePng}
      alt="Microsoft Azure Logo"
      className="w-full h-full object-contain"
    />
  );
}