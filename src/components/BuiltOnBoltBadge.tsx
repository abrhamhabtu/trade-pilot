import React from 'react';
import { Zap } from 'lucide-react';

export const BuiltOnBoltBadge: React.FC = () => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <a
        href="https://bolt.new"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-full hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        style={{
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(59, 246, 138, 0.3)'
        }}
      >
        <Zap className="h-4 w-4" />
        <span className="text-sm font-semibold">Built on Bolt</span>
      </a>
    </div>
  );
};