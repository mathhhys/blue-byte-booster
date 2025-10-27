import React from 'react';
import FirebasePng from './firebase.png';

export function Firebase() {
  return (
    <img
      src={FirebasePng}
      alt="Firebase Logo"
      className="w-full h-full object-contain"
    />
  );
}