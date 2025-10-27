import React from 'react';
import SlackPng from './slack.png';

export function Slack() {
  return (
    <img
      src={SlackPng}
      alt="Slack Logo"
      className="w-full h-full object-contain"
    />
  );
}