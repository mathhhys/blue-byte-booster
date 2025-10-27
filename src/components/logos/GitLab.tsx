import React from 'react';
import GitLabPng from './gitlab.png';

export function GitLab() {
  return (
    <img
      src={GitLabPng}
      alt="GitLab Logo"
      className="w-full h-full object-contain"
    />
  );
}