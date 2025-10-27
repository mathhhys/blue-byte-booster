import React from 'react';
import GitHubPng from './github.png';

export function GitHub() {
  return (
    <img
      src={GitHubPng}
      alt="GitHub Logo"
      className="w-full h-full object-contain"
    />
  );
}