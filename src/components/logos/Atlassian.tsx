import React from 'react';
import AtlassianPng from './atlassian.png';

export function Atlassian() {
  return (
    <img
      src={AtlassianPng}
      alt="Atlassian Logo"
      className="w-full h-full object-contain"
    />
  );
}