import * as React from 'react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';

const ids = ['profession','why1','why2','why3','why4','why5','root'] as const;

type Id = typeof ids[number];

function usePersistedState<T>(key: Id, initial: T) {
  const [value, setValue] = React.useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : initial;
  });
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}


export default function Career5Whys() {
  const [profession, setProfession] = usePersistedState('profession','');
  const [why1, setWhy1] = usePersistedState('why1','');
  const [why2, setWhy2] = usePersistedState('why2','');
  const [why3, setWhy3] = usePersistedState('why3','');
  const [why4, setWhy4] = usePersistedState('why4','');
  const [why5, setWhy5] = usePersistedState('why5','');
  const [root, setRoot] = usePersistedState('root','');

  const whys = [why1, why2, why3, why4, why5];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg mb-6">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">
            Career Reflection: 5 Whys
          </h1>
          <p className="text-gray-600 text-base max-w-lg mx-auto">
            A structured approach to uncover the deeper motivation behind your career choice. 
            Answer each "why" to dig deeper into your purpose.
          </p>
        </header>

        {/* Main Form */}
        <div className="space-y-8">
          {/* Profession Section */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-md font-medium text-sm">
                1
              </div>
              <Label htmlFor="profession" className="text-base font-medium text-gray-900">
                What profession are you aiming for?
              </Label>
            </div>
            <Input 
              id="profession" 
              placeholder="e.g., Data Analyst, UX Designer, Software Engineer" 
              value={profession} 
              onChange={(e)=>setProfession(e.target.value)}
              className="text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </section>

          {/* Why Questions */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-700 rounded-md font-medium text-sm">
                2
              </div>
              <h2 className="text-base font-medium text-gray-900">
                The 5 Whys: Dig deeper
              </h2>
            </div>
            
            <div className="space-y-4">
              {whys.map((why, i) => {
                const setters = [setWhy1, setWhy2, setWhy3, setWhy4, setWhy5];
                
                return (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        {i + 1}
                      </div>
                      <Label className="text-sm font-medium text-gray-700">
                        Why?
                      </Label>
                    </div>
                    <Textarea 
                      value={why} 
                      onChange={(e)=>setters[i](e.target.value)} 
                      placeholder={`Level ${i + 1}: Why do you want this?`}
                      className="text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none min-h-[80px]"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Root Motivation */}
          <section className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-md font-medium text-sm">
                3
              </div>
              <h2 className="text-base font-medium text-gray-900">
                Root Motivation
              </h2>
            </div>
            
            <div className="bg-white rounded-md border border-blue-200 p-4 mb-4">
              <Label htmlFor="root" className="text-sm font-medium text-gray-700 mb-2 block">
                The ROOT of why I want this career is:
              </Label>
              <Textarea 
                id="root"
                value={root} 
                onChange={(e)=>setRoot(e.target.value)} 
                placeholder="Synthesize your answers into the core motivation..."
                className="text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none min-h-[100px]"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              
              <Button 
                variant="outline"
                onClick={()=>{
                  const data = { profession, why1, why2, why3, why4, why5, root };
                  const md = `# Career 5 Whys Reflection\n\n## Profession\n${profession || 'Not specified'}\n\n## The 5 Whys Journey\n1. **Why?** ${why1 || 'Not answered'}\n2. **Why?** ${why2 || 'Not answered'}\n3. **Why?** ${why3 || 'Not answered'}\n4. **Why?** ${why4 || 'Not answered'}\n5. **Why?** ${why5 || 'Not answered'}\n\n## Root Motivation\n**${root || 'Not synthesized'}**\n\n---\n*Generated on ${new Date().toLocaleDateString()}*`;
                  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'career-5whys-reflection.md';
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm px-4 py-2"
              >
                Export
              </Button>
              
              <Button 
                variant="ghost"
                onClick={() => {
                  if (confirm('Clear all your progress? This cannot be undone.')) {
                    [profession, why1, why2, why3, why4, why5, root].forEach((_, i) => {
                      localStorage.removeItem(ids[i]);
                    });
                    window.location.reload();
                  }
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 font-medium text-sm px-4 py-2"
              >
                Clear All
              </Button>
            </div>
            
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Take your time with each question. Honest reflection leads to meaningful insights.
          </p>
        </footer>
      </div>
    </div>
  );
}
