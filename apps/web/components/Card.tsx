import React from 'react';

export function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card ${className}`}>
      <div className="small">{title}</div>
      {children}
    </div>
  );
}
