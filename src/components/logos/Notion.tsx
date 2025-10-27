import React from 'react';
import NotionPng from './notion.png';

export function Notion() {
  return (
    <img
      src={NotionPng}
      alt="Notion Logo"
      className="w-full h-full object-contain"
    />
  );
}