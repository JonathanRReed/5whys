import * as React from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';

const POWER_WORDS = [
  'achieved', 'accelerated', 'advanced', 'advised', 'advocated', 'analyzed', 'architected', 'authored', 'automated',
  'built', 'boosted', 'brokered', 'captained', 'chair', 'championed', 'charted', 'coached', 'collaborated', 'communicated',
  'completed', 'conceived', 'conducted', 'consolidated', 'constructed', 'consulted', 'coordinated', 'created', 'cultivated',
  'decreased', 'delivered', 'demonstrated', 'designed', 'developed', 'devised', 'directed', 'doubled', 'drove', 'earned',
  'edited', 'eliminated', 'established', 'evaluated', 'executed', 'expanded', 'expedited', 'facilitated', 'founded', 'generated',
  'grew', 'guided', 'head', 'headed', 'helped', 'identified', 'implemented', 'improved', 'inaugurated', 'increased',
  'influenced', 'initiated', 'innovated', 'inspected', 'installed', 'instituted', 'instructed', 'integrated', 'launched', 'led',
  'managed', 'mastered', 'mentored', 'moderated', 'monitored', 'negotiated', 'obtained', 'operated', 'organized', 'originated',
  'oversaw', 'performed', 'pioneered', 'planned', 'presented', 'produced', 'programmed', 'promoted', 'proposed', 'published',
  'reduced', 'refined', 'reorganized', 'replaced', 'resolved', 'revamped', 'reversed', 'revitalized', 'saved', 'scheduled',
  'secured', 'spearheaded', 'sponsored', 'standardized', 'streamlined', 'strengthened', 'structured', 'succeeded', 'supervised',
  'supported', 'taught', 'tested', 'trained', 'transformed', 'troubleshooted', 'upgraded', 'won'
];

function usePersistedState<T>(key: string, initial: T) {
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

export default function ResumeGame() {
  const [resumeText, setResumeText] = usePersistedState('resume-game-text', '');
  const [scores, setScores] = React.useState({ quantify: 0, powerWords: 0, format: 0 });

  const analyzeResume = (text: string) => {
    // Quantify: Count numbers and percentages
    const quantifyMatches = text.match(/\d+\.?\d*%?/g) || [];
    const quantifyScore = Math.min(quantifyMatches.length, 3);

    // Power Words: Count strong verbs
    const lowerText = text.toLowerCase();
    const powerWordMatches = POWER_WORDS.filter(word => lowerText.includes(word));
    const powerWordsScore = Math.min(powerWordMatches.length, 3);

    // Format: Count bullet points and check structure
    const bulletPoints = text.match(/^[-•*]\s+.+$/gm) || [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const formatScore = bulletPoints.length >= 3 && bulletPoints.length <= 5 ? 3 : 
                        bulletPoints.length >= 2 ? 2 : 
                        bulletPoints.length >= 1 ? 1 : 0;

    setScores({ quantify: quantifyScore, powerWords: powerWordsScore, format: formatScore });
  };

  React.useEffect(() => {
    analyzeResume(resumeText);
  }, [resumeText]);

  const totalScore = scores.quantify + scores.powerWords + scores.format;
  const getBadge = () => {
    if (totalScore >= 8) return { title: 'Resume Boss', color: 'text-green-600', bg: 'bg-green-50' };
    if (totalScore >= 5) return { title: 'Getting There', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { title: 'Needs Work', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const badge = getBadge();

  const highlightText = (text: string) => {
    let highlighted = text;
    
    // Highlight numbers
    highlighted = highlighted.replace(/\d+\.?\d*%?/g, '<mark class="bg-pink-200 px-1 rounded">$&</mark>');
    
    // Highlight power words
    POWER_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<mark class="bg-purple-200 px-1 rounded">$&</mark>`);
    });
    
    return highlighted;
  };

  return (
    <div className="min-h-screen bg-[#f5e9dc]">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-600 rounded-2xl mb-6">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Resume Game
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Level up your bullet points through the power of numbers, verbs, and structure.
          </p>
        </header>

        {/* Input Section */}
        <section className="mb-12">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-gray-900">
                Paste Your Resume Bullet Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="• Managed a team of 8 waiters&#10;• Increased sales by 25%&#10;• Led coordination of 3 community events&#10;• Developed new training program&#10;• Reduced customer complaints by 40%"
                className="min-h-[200px] font-mono text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500"
              />
              <div className="mt-4 text-sm text-gray-500">
                {resumeText.length > 0 && (
                  <span>Character count: {resumeText.length} | Lines: {resumeText.split('\n').filter(line => line.trim()).length}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Game Board */}
        <section className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Quantify Card */}
          <Card className="bg-[#ffe4ec] border-pink-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-pink-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-pink-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  {scores.quantify}
                </div>
                Quantify
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-pink-700 mb-3">
                Highlight every time you quantify something with numbers or percentages.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Numbers found:</span>
                  <span className="font-medium">{resumeText.match(/\d+\.?\d*%?/g)?.length || 0}</span>
                </div>
                <div className="w-full bg-pink-200 rounded-full h-2">
                  <div 
                    className="bg-pink-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(scores.quantify / 3) * 100}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 p-2 bg-white rounded text-xs text-pink-600">
                💡 "Managed team of 8" → Better than "Managed team"
              </div>
            </CardContent>
          </Card>

          {/* Power Words Card */}
          <Card className="bg-[#f3e8ff] border-purple-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-purple-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  {scores.powerWords}
                </div>
                Power Words
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-700 mb-3">
                Use strong action verbs to show impact and leadership.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Power words found:</span>
                  <span className="font-medium">
                    {POWER_WORDS.filter(word => resumeText.toLowerCase().includes(word)).length}
                  </span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(scores.powerWords / 3) * 100}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 p-2 bg-white rounded text-xs text-purple-600">
                💡 "Helped organize" → "Led coordination of"
              </div>
            </CardContent>
          </Card>

          {/* Format Card */}
          <Card className="bg-[#d1fae5] border-green-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                  {scores.format}
                </div>
                Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-700 mb-3">
                Use bullet points and aim for 3-5 points per experience.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Bullet points:</span>
                  <span className="font-medium">{resumeText.match(/^[-•*]\s+.+$/gm)?.length || 0}</span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(scores.format / 3) * 100}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 p-2 bg-white rounded text-xs text-green-600">
                💡 Use • or - for consistent bullet points
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Examples Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            Before & After Examples
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-lg font-medium text-red-800">❌ Before</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>• Managed a team of waiters</p>
                  <p>• Helped organize events</p>
                  <p>• Was responsible for training</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg font-medium text-green-800">✅ After</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>• <mark className="bg-pink-200 px-1 rounded">Managed</mark> team of <mark className="bg-pink-200 px-1 rounded">8</mark> waiters</p>
                  <p>• <mark className="bg-purple-200 px-1 rounded">Led</mark> coordination of <mark className="bg-pink-200 px-1 rounded">3</mark> community events</p>
                  <p>• <mark className="bg-purple-200 px-1 rounded">Developed</mark> training program that <mark className="bg-purple-200 px-1 rounded">increased</mark> efficiency by <mark className="bg-pink-200 px-1 rounded">25%</mark></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Scoreboard */}
        <section className="text-center">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">Final Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-6xl font-bold text-gray-900">
                {totalScore}/9
              </div>
              
              <div className={`inline-flex items-center px-6 py-3 rounded-full ${badge.bg} ${badge.color}`}>
                <span className="text-lg font-semibold">{badge.title}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-600">{scores.quantify}</div>
                  <div className="text-sm text-gray-600">Quantify</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{scores.powerWords}</div>
                  <div className="text-sm text-gray-600">Power Words</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{scores.format}</div>
                  <div className="text-sm text-gray-600">Format</div>
                </div>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button 
                  onClick={() => {
                    setResumeText('');
                    setScores({ quantify: 0, powerWords: 0, format: 0 });
                  }}
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Clear & Try Again
                </Button>
                
                <Button 
                  onClick={() => {
                    const summary = `# Resume Game Results\n\n**Score: ${totalScore}/9** - ${badge.title}\n\n## Breakdown\n- Quantify: ${scores.quantify}/3\n- Power Words: ${scores.powerWords}/3\n- Format: ${scores.format}/3\n\n## Your Resume Text:\n${resumeText}`;
                    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'resume-game-results.md';
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Export Results
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}