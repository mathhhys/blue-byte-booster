import React from 'react';
import SupabasePng from './supabase.png';

export function Supabase() {
  return (
    <img
      src={SupabasePng}
      alt="Supabase Logo"
      className="w-full h-full object-contain"
    />
  );
}