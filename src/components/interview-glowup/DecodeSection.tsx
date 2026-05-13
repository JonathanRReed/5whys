import * as React from 'react';
import { cn } from '../../lib/utils';
import {
  type GlowUpData,
  type DecodedRole,
  type DecodedBullet,
  generateId,
  createRole,
  updateRole,
  getSkillFrequencyMap,
  getTopGaps,
} from '../../lib/glowup-store';
import {
  SKILL_BANK,
  getSkillName,
  detectSkillsFromText,
} from '../../lib/glowup-banks';
import { PartyIcon } from './icons';

type Props = {
  data: GlowUpData;
  setData: React.Dispatch<React.SetStateAction<GlowUpData>>;
  currentRole: DecodedRole | undefined;
};

export default function DecodeSection({ data, setData, currentRole }: Props) {
  const [jobTitle, setJobTitle] = React.useState(currentRole?.jobTitle ?? '');
  const [company, setCompany] = React.useState(currentRole?.company ?? '');
  const [jdUrl, setJdUrl] = React.useState(currentRole?.jdUrl ?? '');
  const [rawJdText, setRawJdText] = React.useState(currentRole?.rawJdText ?? '');
  const [bullets, setBullets] = React.useState<DecodedBullet[]>(currentRole?.bullets ?? []);
  const [selectedBullets, setSelectedBullets] = React.useState<Set<string>>(new Set());

  const parseJD = () => {
    if (!rawJdText.trim()) return;
    const lines = rawJdText
      .split(/\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    const parsed: DecodedBullet[] = [];
    for (const line of lines) {
      const cleanLine = line
        .replace(/^[\u2022\-\*\u25E6\u25CB\u25CF]\s*/, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .trim();
      if (!cleanLine) continue;
      const suggestions = detectSkillsFromText(cleanLine);
      parsed.push({
        id: generateId(),
        text: cleanLine,
        status: 'active',
        primarySkillId: suggestions[0]?.skillId ?? null,
        secondarySkillIds: suggestions.slice(1).map(s => s.skillId),
        suggestion: suggestions,
      });
    }
    setBullets(parsed);
  };

  const saveRole = () => {
    if (!jobTitle.trim()) return;
    const payload = { jobTitle, company, jdUrl: jdUrl || undefined, rawJdText, bullets };
    if (currentRole) {
      setData(updateRole(data, currentRole.id, payload));
    } else {
      setData(createRole(data, payload));
    }
  };

  const skillFreq = currentRole ? getSkillFrequencyMap(currentRole) : new Map();
  const totalBullets = bullets.filter(b => b.status === 'active' && b.primarySkillId).length;
  const topGaps = currentRole ? getTopGaps(data, currentRole) : [];
  const isNoise = (text: string) => text.split(/\s+/).length < 4;

  const handleBulkTag = (skillId: string) => {
    setBullets(bullets.map(b => selectedBullets.has(b.id) ? { ...b, primarySkillId: skillId } : b));
    setSelectedBullets(new Set());
  };

  const handleBulkIgnore = () => {
    setBullets(bullets.map(b => selectedBullets.has(b.id) ? { ...b, status: 'ignored' as const } : b));
    setSelectedBullets(new Set());
  };

  const inputClass =
    'w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--foam))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foam))]';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="job-title" className="mb-1 block text-sm font-medium text-foreground">Job Title</label>
          <input id="job-title" type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g., Senior Software Engineer" className={inputClass} />
        </div>
        <div>
          <label htmlFor="company" className="mb-1 block text-sm font-medium text-foreground">Company</label>
          <input id="company" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g., Acme Corp" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="jd-url" className="mb-1 block text-sm font-medium text-foreground">Job Description URL (optional)</label>
        <input id="jd-url" type="url" value={jdUrl} onChange={e => setJdUrl(e.target.value)} placeholder="https://..." className={inputClass} />
      </div>
      <div>
        <label htmlFor="jd-text" className="mb-1 block text-sm font-medium text-foreground">Paste Full Job Description</label>
        <textarea id="jd-text" value={rawJdText} onChange={e => setRawJdText(e.target.value)} placeholder="Paste the entire job description here. Include bullet points, requirements, responsibilities..." rows={8} className={inputClass} />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={parseJD} className="rounded-lg bg-[hsl(var(--foam))] px-4 py-2 text-sm font-semibold text-[hsl(var(--background))] transition-colors hover:bg-[hsl(var(--foam)/0.9)]">Parse Bullets</button>
          <button type="button" onClick={saveRole} disabled={!jobTitle.trim()} className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[hsl(var(--overlay)/0.5)] disabled:opacity-50">Save Role</button>
        </div>
      </div>

      {bullets.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-foreground">Parsed Bullets ({bullets.length})</h3>
            {selectedBullets.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedBullets.size} selected</span>
                <select aria-label="Bulk tag selected bullets" onChange={e => { if (e.target.value) handleBulkTag(e.target.value); }} className="rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-2 py-1 text-sm text-foreground" defaultValue="">
                  <option value="">Bulk tag...</option>
                  {SKILL_BANK.map(skill => (<option key={skill.id} value={skill.id}>{skill.name}</option>))}
                </select>
                <button type="button" onClick={handleBulkIgnore} className="rounded-lg border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-2 py-1 text-sm text-destructive">Ignore</button>
              </div>
            )}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-3">
            {bullets.map(bullet => (
              <div key={bullet.id} className={cn(
                'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                bullet.status === 'ignored'
                  ? 'border-[hsl(var(--border)/0.2)] bg-[hsl(var(--overlay)/0.1)] opacity-50'
                  : isNoise(bullet.text)
                    ? 'border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)]'
                    : 'border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.2)]'
              )}>
                <input type="checkbox" aria-label={`Select bullet: ${bullet.text.substring(0, 50)}`} checked={selectedBullets.has(bullet.id)} onChange={e => {
                  const newSet = new Set(selectedBullets);
                  if (e.target.checked) newSet.add(bullet.id); else newSet.delete(bullet.id);
                  setSelectedBullets(newSet);
                }} className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--foam))]" />
                <div className="flex-1 space-y-2">
                  <p className={cn('text-sm', bullet.status === 'ignored' ? 'text-muted-foreground line-through' : 'text-foreground')}>
                    {bullet.text}
                    {isNoise(bullet.text) && bullet.status !== 'ignored' && (
                      <span className="ml-2 rounded bg-[hsl(var(--gold)/0.2)] px-1.5 py-0.5 text-xs text-[hsl(var(--gold))]">noise?</span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={bullet.primarySkillId ?? ''} onChange={e => {
                      setBullets(bullets.map(b => b.id === bullet.id ? { ...b, primarySkillId: e.target.value || null } : b));
                    }} className="rounded border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--overlay)/0.3)] px-2 py-1 text-xs text-foreground">
                      <option value="">Select skill...</option>
                      {SKILL_BANK.map(skill => (<option key={skill.id} value={skill.id}>{skill.name}</option>))}
                    </select>
                    {bullet.suggestion && bullet.suggestion.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Suggested:</span>
                        {bullet.suggestion.slice(0, 2).map(s => (
                          <button key={s.skillId} type="button" onClick={() => {
                            setBullets(bullets.map(b => b.id === bullet.id ? { ...b, primarySkillId: s.skillId } : b));
                          }} className="rounded-full bg-[hsl(var(--foam)/0.15)] px-2 py-0.5 text-xs text-[hsl(var(--foam))] hover:bg-[hsl(var(--foam)/0.25)]">
                            {getSkillName(s.skillId)} ({s.confidence}%)
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => {
                      setBullets(bullets.map(b => b.id === bullet.id ? { ...b, status: b.status === 'ignored' ? 'active' : 'ignored' } : b));
                    }} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
                      {bullet.status === 'ignored' ? 'Restore' : 'Ignore'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {skillFreq.size > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[hsl(var(--border)/0.3)] bg-[hsl(var(--overlay)/0.15)] p-4">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Skill Frequency Map</h4>
            <div className="space-y-2">
              {Array.from(skillFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skillId, count]) => {
                const pct = totalBullets > 0 ? Math.round((count / totalBullets) * 100) : 0;
                return (
                  <div key={skillId} className="flex items-center gap-2">
                    <span className="w-24 truncate text-sm text-foreground">{getSkillName(skillId)}</span>
                    <div className="flex-1 h-2 rounded-full bg-[hsl(var(--overlay)/0.4)]">
                      <div className="h-full rounded-full bg-[hsl(var(--foam))]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.05)] p-4">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-destructive">Top 3 Gaps (No Stories Yet)</h4>
            {topGaps.length === 0 ? (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">All skills covered! <PartyIcon className="h-4 w-4" /></p>
            ) : (
              <ul className="space-y-1">
                {topGaps.map(skillId => (
                  <li key={skillId} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    {getSkillName(skillId)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
