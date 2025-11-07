import * as React from 'react';

export default function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <a 
            href="/" 
            className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <span className="font-semibold text-lg">Career Tools</span>
          </a>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            <a 
              href="/career"
              className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
            >
              Career 5 Whys
            </a>
            <a 
              href="/resume-game"
              className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
            >
              Resume Game
            </a>
            <a 
              href="/networking-practice"
              className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
            >
              Networking Practice
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
