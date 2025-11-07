import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { parseSections, type ParsedJobPost } from '../../lib/role-decoder/parser';
import {
  detectSkills,
  type DetectedSkill,
  type SkillDictionary,
} from '../../lib/role-decoder/skills';
import {
  deleteSnapshot,
  generateId,
  loadExperiences,
  loadSnapshots,
  saveExperiences,
  saveSnapshot,
  type ExperienceMapping,
  type RoleDecoderSnapshot,
} from '../../lib/role-decoder/storage';

type RequestState = 'idle' | 'loading' | 'success' | 'error';

type RoleDecoderAppProps = {
  showHeader?: boolean;
  className?: string;
};

type BulletDraftInputs = {
  verb: string;
  what: string;
  how: string;
  impact: string;
};

type GeneratedBullet = {
  id: string;
  skillKey: string;
  text: string;
  createdAt: string;
};

type ExperienceDraft = {
  id?: string;
  title: string;
  summary: string;
  evidence: string;
  impact: string;
  confidence: number;
};

const ACTION_VERBS = [
  'Accelerated',
  'Built',
  'Directed',
  'Drove',
  'Enabled',
  'Led',
  'Optimized',
  'Orchestrated',
  'Redesigned',
  'Spearheaded',
  'Strengthened',
];

const EMPTY_INPUTS: BulletDraftInputs = { verb: '', what: '', how: '', impact: '' };
const EMPTY_EXPERIENCE_DRAFT: ExperienceDraft = {
  title: '',
  summary: '',
  evidence: '',
  impact: '',
  confidence: 3,
};

export default function RoleDecoderApp({ showHeader = true, className }: RoleDecoderAppProps) {
  const [input, setInput] = React.useState('');
  const [dictionary, setDictionary] = React.useState<SkillDictionary | null>(null);
  const [dictionaryState, setDictionaryState] = React.useState<RequestState>('idle');
  const [dictionaryError, setDictionaryError] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParsedJobPost | null>(null);
  const [parseState, setParseState] = React.useState<RequestState>('idle');
  const [skills, setSkills] = React.useState<DetectedSkill[]>([]);
  const [selectedSkillKey, setSelectedSkillKey] = React.useState<string | null>(null);
  const [skillContexts, setSkillContexts] = React.useState<Record<string, string[]>>({});
  const [draftInputs, setDraftInputs] = React.useState<Record<string, BulletDraftInputs>>({});
  const [generatedBullets, setGeneratedBullets] = React.useState<GeneratedBullet[]>([]);
  const [experiences, setExperiences] = React.useState<ExperienceMapping[]>([]);
  const [experienceDraft, setExperienceDraft] = React.useState<ExperienceDraft>({ ...EMPTY_EXPERIENCE_DRAFT });
  const [fitCoverage, setFitCoverage] = React.useState(0);
  const [snapshots, setSnapshots] = React.useState<RoleDecoderSnapshot[]>([]);
  const [exportState, setExportState] = React.useState<RequestState>('idle');

  React.useEffect(() => {
    if (dictionaryState !== 'idle') return;
    let cancelled = false;

    async function loadDictionary() {
      try {
        setDictionaryState('loading');
        const response = await fetch('/data/skills.json');
        if (!response.ok) {
          throw new Error(`Failed to load skills dictionary (${response.status})`);
        }
        const payload = (await response.json()) as SkillDictionary;
        if (!cancelled) {
          setDictionary(payload);
          setDictionaryState('success');
        }
      } catch (error) {
        if (cancelled) return;
        setDictionaryError(error instanceof Error ? error.message : 'Unknown error loading dictionary.');
        setDictionaryState('error');
      }
    }

    loadDictionary();
    return () => {
      cancelled = true;
    };
  }, [dictionaryState]);

  React.useEffect(() => {
    setSnapshots(loadSnapshots());
  }, []);

  React.useEffect(() => {
    setExperiences(loadExperiences());
  }, []);

  const handleParse = React.useCallback(() => {
    if (!dictionary || !input.trim()) return;
    setParseState('loading');

    try {
      const result = parseSections(input.trim());
      const consolidated = result.sections.map((section) => section.lines.join(' ')).join(' ');
      const detected = detectSkills(consolidated, dictionary);
      const contextAccumulator: Record<string, Set<string>> = {};

      for (const section of result.sections) {
        for (const line of section.lines) {
          const normalizedLine = line.toLowerCase();
          for (const skill of detected) {
            if (!contextAccumulator[skill.key]) {
              contextAccumulator[skill.key] = new Set();
            }
            const matchesLine = skill.matches.some((keyword) => normalizedLine.includes(keyword.toLowerCase()));
            if (matchesLine) {
              contextAccumulator[skill.key]?.add(line.trim());
            }
          }
        }
      }

      const contextMap = Object.fromEntries(
        Object.entries(contextAccumulator).map(([key, values]) => [key, Array.from(values).slice(0, 8)])
      );

      setParsed(result);
      setSkills(detected);
      setSkillContexts(contextMap);
      setSelectedSkillKey((previous) => {
        if (previous && detected.some((skill) => skill.key === previous)) return previous;
        return detected[0]?.key ?? null;
      });
      setFitCoverage(calculateFitCoverage(detected));
      setParseState('success');
    } catch (error) {
      console.error('Failed to parse job description', error);
      setParsed(null);
      setSkills([]);
      setSkillContexts({});
      setSelectedSkillKey(null);
      setFitCoverage(0);
      setParseState('error');
    }
  }, [dictionary, input]);

  const selectedSkill = React.useMemo(
    () => (selectedSkillKey ? skills.find((skill) => skill.key === selectedSkillKey) ?? null : null),
    [selectedSkillKey, skills]
  );

  const selectedInputs = React.useMemo(() => {
    if (!selectedSkillKey) return EMPTY_INPUTS;
    return draftInputs[selectedSkillKey] ?? EMPTY_INPUTS;
  }, [draftInputs, selectedSkillKey]);

  const experiencesForSelectedSkill = React.useMemo(() => {
    if (!selectedSkillKey) return [] as ExperienceMapping[];
    return experiences
      .filter((experience) => experience.skillKey === selectedSkillKey)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [experiences, selectedSkillKey]);

  const sortedExperiences = React.useMemo(() => {
    return [...experiences].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [experiences]);

  React.useEffect(() => {
    if (!selectedSkill) {
      setExperienceDraft({ ...EMPTY_EXPERIENCE_DRAFT });
      return;
    }
    setExperienceDraft((previous) => {
      if (previous.id) return previous;
      const existingTitle = previous.title.trim() || selectedSkill.label;
      return {
        ...EMPTY_EXPERIENCE_DRAFT,
        title: existingTitle,
      };
    });
  }, [selectedSkill]);

  const handleExperienceDraftChange = React.useCallback((field: keyof ExperienceDraft, value: string) => {
    setExperienceDraft((previous) => {
      if (field === 'confidence') {
        const numeric = Math.min(5, Math.max(1, Number(value) || 3));
        return { ...previous, confidence: numeric };
      }
      return { ...previous, [field]: value };
    });
  }, []);

  const handleAppendEvidence = React.useCallback((line: string) => {
    setExperienceDraft((previous) => {
      const existing = previous.evidence
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      if (existing.includes(line.trim())) return previous;
      const next = [...existing, line.trim()];
      return { ...previous, evidence: next.join('\n') };
    });
  }, []);

  const handleResetExperienceDraft = React.useCallback(() => {
    setExperienceDraft((previous) => {
      const base = { ...EMPTY_EXPERIENCE_DRAFT };
      if (selectedSkill) {
        base.title = selectedSkill.label;
      }
      return base;
    });
  }, [selectedSkill]);

  const handleSaveExperience = React.useCallback(() => {
    if (!selectedSkill) return;
    const normalizedTitle = (experienceDraft.title || selectedSkill.label).trim();
    const summary = experienceDraft.summary.trim();
    if (!summary) return;
    const evidenceList = experienceDraft.evidence
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const impact = experienceDraft.impact.trim();
    const confidence = Math.min(5, Math.max(1, experienceDraft.confidence || 3));

    const experience: ExperienceMapping = {
      id: experienceDraft.id ?? generateId('exp'),
      skillKey: selectedSkill.key,
      skillLabel: selectedSkill.label,
      title: normalizedTitle,
      summary,
      evidence: evidenceList,
      impact,
      confidence,
      updatedAt: new Date().toISOString(),
    };

    setExperiences((previous) => {
      const existingIndex = previous.findIndex((item) => item.id === experience.id);
      let next: ExperienceMapping[];
      if (existingIndex >= 0) {
        next = [...previous];
        next[existingIndex] = experience;
      } else {
        next = [experience, ...previous];
      }
      saveExperiences(next);
      return next;
    });

    setExperienceDraft({ ...EMPTY_EXPERIENCE_DRAFT, title: selectedSkill.label });
  }, [experienceDraft, selectedSkill]);

  const handleEditExperience = React.useCallback(
    (experience: ExperienceMapping) => {
      setSelectedSkillKey(experience.skillKey);
      setExperienceDraft({
        id: experience.id,
        title: experience.title,
        summary: experience.summary,
        evidence: experience.evidence.join('\n'),
        impact: experience.impact,
        confidence: experience.confidence,
      });
    },
    []
  );

  const handleDeleteExperience = React.useCallback(
    (experienceId: string) => {
      setExperiences((previous) => {
        const next = previous.filter((experience) => experience.id !== experienceId);
        saveExperiences(next);
        return next;
      });
      setExperienceDraft((previous) => (previous.id === experienceId ? { ...EMPTY_EXPERIENCE_DRAFT } : previous));
    },
    []
  );

  const experienceSaveDisabled =
    !selectedSkill || experienceDraft.summary.trim().length === 0 || experienceDraft.confidence < 1 || experienceDraft.confidence > 5;

  const updateDraftField = React.useCallback(
    (field: keyof BulletDraftInputs, value: string) => {
      if (!selectedSkillKey) return;
      setDraftInputs((previous) => {
        const existing = previous[selectedSkillKey] ?? EMPTY_INPUTS;
        return {
          ...previous,
          [selectedSkillKey]: { ...existing, [field]: value },
        };
      });
    },
    [selectedSkillKey]
  );

  const handleGenerateBullet = React.useCallback(() => {
    if (!selectedSkillKey) return;
    const inputs = draftInputs[selectedSkillKey] ?? EMPTY_INPUTS;
    if (!inputs.verb.trim() || !inputs.what.trim()) return;

    const text = buildBullet(inputs);
    if (!text) return;

    setGeneratedBullets((previous) => [
      {
        id: generateId('bullet'),
        skillKey: selectedSkillKey,
        text,
        createdAt: new Date().toISOString(),
      },
      ...previous,
    ]);
  }, [draftInputs, selectedSkillKey]);

  const handleCopyBullet = React.useCallback((bullet: GeneratedBullet) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(bullet.text).catch((error) => {
      console.error('Failed to copy bullet', error);
    });
  }, []);

  const handleSaveSnapshot = React.useCallback(() => {
    if (!parsed || skills.length === 0) return;
    const id = generateId('snapshot');
    const title = parsed.sections.find((section) => section.key === 'purpose')?.heading ?? 'Decoded role';
    const textPreview = parsed.text.slice(0, 160) + (parsed.text.length > 160 ? '…' : '');
    const relevantExperiences = experiences.filter((experience) =>
      skills.some((skill) => skill.key === experience.skillKey)
    );

    const snapshot: RoleDecoderSnapshot = {
      id,
      title,
      text: textPreview,
      createdAt: new Date().toISOString(),
      fitCoverage,
      skillCount: skills.length,
      experiences: relevantExperiences,
    };

    saveSnapshot(snapshot);
    setSnapshots(loadSnapshots());
  }, [experiences, fitCoverage, parsed, skills]);

  const handleDeleteSnapshot = React.useCallback((id: string) => {
    deleteSnapshot(id);
    setSnapshots(loadSnapshots());
  }, []);

  const handleExportMarkdown = React.useCallback(() => {
    if (!parsed) return;
    setExportState('loading');

    try {
      const sectionLines = parsed.sections.flatMap((section) => [
        `## ${section.heading}`,
        ...section.lines.map((line) => `- ${line}`),
        '',
      ]);

      const skillLines = skills.map(
        (skill) => `- ${skill.label}: ${skill.frequency} hits (${Math.round(skill.confidence * 100)}% confidence)`
      );

      const relevantExperiences = experiences.filter((experience) =>
        skills.some((skill) => skill.key === experience.skillKey)
      );

      const experienceLines =
        relevantExperiences.length > 0
          ? relevantExperiences.flatMap((experience) => {
              const lines = [`### ${experience.title} (${experience.skillLabel})`];
              if (experience.summary) lines.push(`- Summary: ${experience.summary}`);
              if (experience.evidence.length) {
                lines.push('- Evidence:');
                lines.push(...experience.evidence.map((item) => `  - ${item}`));
              }
              if (experience.impact) lines.push(`- Impact: ${experience.impact}`);
              lines.push(`- Confidence: ${experience.confidence}/5`);
              lines.push('');
              return lines;
            })
          : ['No experiences captured yet.', ''];

      const bulletLines = generatedBullets.map((bullet) => `- ${bullet.text}`);

      const markdown = [
        '# Role Decoder Snapshot',
        '',
        `Generated ${new Date().toLocaleString()}`,
        '',
        '## Skills',
        ...skillLines,
        '',
        '## Experience Mapper',
        ...experienceLines,
        '',
        '## Generated Bullets',
        ...bulletLines,
        '',
        ...sectionLines,
      ].join('\n');

      triggerDownload(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), 'role-decoder.md');
      setExportState('success');
    } catch (error) {
      console.error('Failed to export markdown', error);
      setExportState('error');
    }
  }, [experiences, generatedBullets, parsed, skills]);

  const handleExportJson = React.useCallback(() => {
    if (!parsed) return;
    setExportState('loading');

    try {
      const relevantExperiences = experiences.filter((experience) =>
        skills.some((skill) => skill.key === experience.skillKey)
      );

      const payload = {
        generatedAt: new Date().toISOString(),
        fitCoverage,
        sections: parsed.sections,
        skills,
        bullets: generatedBullets,
        experiences: relevantExperiences,
      };

      triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'role-decoder.json');
      setExportState('success');
    } catch (error) {
      console.error('Failed to export JSON', error);
      setExportState('error');
    }
  }, [experiences, fitCoverage, generatedBullets, parsed, skills]);

  const dictionaryStatusMessage = React.useMemo(() => {
    if (dictionaryState === 'loading') return 'Loading local skill dictionary…';
    if (dictionaryState === 'error') return dictionaryError ?? 'Unable to load skill dictionary.';
    return null;
  }, [dictionaryError, dictionaryState]);

  const containerClasses = cn(
    'mx-auto max-w-6xl px-4 pb-16 space-y-10 text-[hsl(var(--foreground))]',
    showHeader ? 'pt-12' : 'pt-8',
    className
  );

  return (
    <div className={containerClasses}>
      {showHeader && (
        <header className="text-center space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-[hsl(var(--foam))]">Flagship Module</p>
          <h1 className="text-4xl font-semibold text-[hsl(var(--foreground))]">Role Decoder Pro</h1>
          <p className="mx-auto max-w-2xl text-[hsl(var(--muted-foreground))]">
            Paste a job description to segment responsibilities, extract skills, and map coverage across your evidence library —
            all offline.
          </p>
        </header>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,_1.1fr)_0.9fr]">
        <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-[hsl(var(--foreground))]">Job description intake</CardTitle>
            {dictionaryStatusMessage ? (
              <p className="text-xs text-[hsl(var(--destructive))]">{dictionaryStatusMessage}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Paste the job post here to begin decoding..."
              className="min-h-[280px] resize-y border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            />
            <Button
              type="button"
              className="h-11 rounded-xl border border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.4)]"
              disabled={!input.trim() || !dictionary || dictionaryState !== 'success' || parseState === 'loading'}
              onClick={handleParse}
            >
              {parseState === 'loading' ? 'Parsing…' : 'Parse & extract skills'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-[hsl(var(--foreground))]">Skill map snapshot</CardTitle>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Ranked skills and confidence scores based on the current job description.</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {skills.length === 0 ? (
              <p className="text-[hsl(var(--muted-foreground))]">
                Paste a description and run the parser to see O*NET-aligned skills with match confidence. The full Fit Map and
                exports will unlock as the pipeline comes online.
              </p>
            ) : (
              <ul className="space-y-3">
                {skills.map((skill) => (
                  <li key={skill.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedSkillKey(skill.key)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        selectedSkillKey === skill.key
                          ? 'border-[hsl(var(--primary)/0.8)] bg-[hsl(var(--primary)/0.1)] shadow-[0_0_25px_hsl(var(--primary)/0.25)]'
                          : 'border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] hover:border-[hsl(var(--border)/0.7)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[hsl(var(--foreground))]">
                        <span className="font-medium">{skill.label}</span>
                        <span className="text-xs text-[hsl(var(--primary))]">
                          {skill.frequency} hits · {Math.round(skill.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--border)/0.3)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--iris))] to-[hsl(var(--love))]"
                          style={{ width: `${Math.min(100, Math.max(10, skill.frequency * 20))}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                        Matched keywords: {Array.from(new Set(skill.matches.map((match) => match.toLowerCase()))).join(', ')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-[hsl(var(--foreground))]">Section breakdown preview</CardTitle>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Quick view of the parsed sections — future iterations will expose inline editing, evidence linking, and export actions.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {parsed ? (
            parsed.sections.map((section) => (
              <div key={`${section.key}-${section.heading}`} className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{section.heading}</h3>
                <ul className="mt-3 space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {section.lines.slice(0, 6).map((line, index) => (
                    <li key={index} className="leading-relaxed">
                      {line}
                    </li>
                  ))}
                  {section.lines.length > 6 ? (
                    <li className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">+ more</li>
                  ) : null}
                </ul>
              </div>
            ))
          ) : (
            <div className="lg:col-span-3 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-6 text-sm text-[hsl(var(--muted-foreground))]">
              No sections parsed yet. Add a job description and select "Parse & extract skills" to populate this view.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-[hsl(var(--foreground))]">Bullet builder & exports</CardTitle>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Select a skill to draft STAR-aligned résumé bullets seeded by matched lines.</p>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {selectedSkill ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{selectedSkill.label}</h3>
                <p className="mt-1 text-xs text-[hsl(var(--primary))]">
                  Confidence {Math.round(selectedSkill.confidence * 100)}% · {selectedSkill.frequency} signal hits
                </p>
                <ul className="mt-3 space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {(skillContexts[selectedSkill.key] ?? []).length ? (
                    skillContexts[selectedSkill.key]!.map((line, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          onClick={() => handleAppendEvidence(line)}
                          className="w-full rounded-lg border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.4)] p-2 text-left transition hover:border-[hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--primary)/0.1)]"
                        >
                          {line}
                          <span className="mt-1 block text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                            Tap to add as evidence
                          </span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="text-[hsl(var(--muted-foreground))]">No direct line matches captured yet.</li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Experience mapper</h3>
                  <span className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                    Confidence {experienceDraft.confidence}/5
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Experience title</label>
                  <Input
                    value={experienceDraft.title}
                    onChange={(event) => handleExperienceDraftChange('title', event.target.value)}
                    placeholder="e.g., GTM analytics overhaul"
                    className="bg-[hsl(var(--overlay)/0.4)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Summary</label>
                  <Textarea
                    value={experienceDraft.summary}
                    onChange={(event) => handleExperienceDraftChange('summary', event.target.value)}
                    placeholder="Capture the situation and outcome in 2–3 sentences."
                    className="min-h-[110px] border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.35)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Evidence lines</label>
                  <Textarea
                    value={experienceDraft.evidence}
                    onChange={(event) => handleExperienceDraftChange('evidence', event.target.value)}
                    placeholder="Each line becomes a bullet. Tap matches above to append quickly."
                    className="min-h-[120px] border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.35)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Impact & signal</label>
                  <Textarea
                    value={experienceDraft.impact}
                    onChange={(event) => handleExperienceDraftChange('impact', event.target.value)}
                    placeholder="What changed? Include numbers, users, or scope."
                    className="min-h-[90px] border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.35)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Confidence score (1–5)</label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={experienceDraft.confidence}
                    onChange={(event) => handleExperienceDraftChange('confidence', event.target.value)}
                    className="bg-[hsl(var(--overlay)/0.4)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="flex-1 h-11 rounded-xl border border-[hsl(var(--love)/0.6)] bg-[hsl(var(--love)/0.2)] text-[hsl(var(--love-foreground))] hover:bg-[hsl(var(--love)/0.35)]"
                    disabled={experienceSaveDisabled}
                    onClick={handleSaveExperience}
                  >
                    Save experience
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 h-11 border border-[hsl(var(--border)/0.5)] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
                    onClick={handleResetExperienceDraft}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Action verb</label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Input
                    value={selectedInputs.verb}
                    onChange={(event) => updateDraftField('verb', event.target.value)}
                    placeholder="e.g., Led"
                    className="bg-[hsl(var(--overlay)/0.4)] border-[hsl(var(--border)/0.5)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                  <select
                    className="rounded-md border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.4)] px-3 text-xs text-[hsl(var(--foreground))]"
                    value={selectedInputs.verb || ''}
                    onChange={(event) => updateDraftField('verb', event.target.value)}
                  >
                    <option value="">Verb bank</option>
                    {ACTION_VERBS.map((verb) => (
                      <option key={verb} value={verb}>
                        {verb}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">What you delivered</label>
                <Textarea
                  value={selectedInputs.what}
                  onChange={(event) => updateDraftField('what', event.target.value)}
                  placeholder="Summarize the project, scope, or artifact."
                  className="min-h-[100px] border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.35)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                />

                <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">How you achieved it</label>
                <Textarea
                  value={selectedInputs.how}
                  onChange={(event) => updateDraftField('how', event.target.value)}
                  placeholder="e.g., by partnering with design + eng to..."
                  className="min-h-[80px] border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.35)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                />

                <label className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Impact / metric</label>
                <Textarea
                  value={selectedInputs.impact}
                  onChange={(event) => updateDraftField('impact', event.target.value)}
                  placeholder="e.g., resulting in a 22% lift in activation within 6 weeks"
                  className="min-h-[80px] border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.35)] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                />

                <Button
                  type="button"
                  className="h-11 rounded-xl border border-[hsl(var(--love)/0.6)] bg-[hsl(var(--love)/0.2)] text-[hsl(var(--love-foreground))] hover:bg-[hsl(var(--love)/0.35)]"
                  onClick={handleGenerateBullet}
                  disabled={!selectedInputs.verb.trim() || !selectedInputs.what.trim()}
                >
                  Generate bullet
                </Button>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-6 text-sm text-[hsl(var(--muted-foreground))]">
              Select a skill from the skill map to start drafting a bullet.
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Live preview</h3>
              <p className="mt-3 text-base text-[hsl(var(--foreground))]">
                {selectedSkill ? buildBullet(selectedInputs) || 'Draft updates will appear here.' : 'No skill selected yet.'}
              </p>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Captured experiences</h3>
                <span className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                  {experiencesForSelectedSkill.length} linked
                </span>
              </div>
              {experiencesForSelectedSkill.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Save experiences above to build your personal evidence library for this skill.
                </p>
              ) : (
                <ul className="space-y-3 text-xs text-[hsl(var(--foreground))]">
                  {experiencesForSelectedSkill.map((experience) => (
                    <li key={experience.id} className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.35)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-medium text-[hsl(var(--foreground))]">{experience.title}</h4>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                            Confidence {experience.confidence}/5 · Updated {new Date(experience.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="border border-[hsl(var(--border)/0.5)] bg-transparent text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
                            onClick={() => handleEditExperience(experience)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="border border-[hsl(var(--destructive)/0.5)] bg-transparent text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.2)]"
                            onClick={() => handleDeleteExperience(experience.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      {experience.summary ? <p className="mt-2 text-[hsl(var(--foreground))]">{experience.summary}</p> : null}
                      {experience.evidence.length ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Evidence</p>
                          <ul className="space-y-1 text-[hsl(var(--foreground))]">
                            {experience.evidence.map((line, index) => (
                              <li key={index} className="rounded border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] px-2 py-1">
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {experience.impact ? (
                        <p className="mt-2 text-[hsl(var(--foreground))]">
                          <span className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Impact</span>
                          <br />
                          {experience.impact}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Generated bullets</h4>
              {generatedBullets.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Generated bullets will appear here for quick copy and comparison.</p>
              ) : (
                <ul className="space-y-3">
                  {generatedBullets.map((bullet) => (
                    <li key={bullet.id} className="rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                          {skills.find((skill) => skill.key === bullet.skillKey)?.label ?? 'Skill match'}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="border border-[hsl(var(--border)/0.5)] bg-transparent text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.1)]"
                          onClick={() => handleCopyBullet(bullet)}
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="mt-3 text-sm text-[hsl(var(--foreground))]">{bullet.text}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                        Saved {new Date(bullet.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">Exports & persistence</h4>
                <span className="text-xs text-[hsl(var(--primary))]">Fit coverage {Math.round(fitCoverage * 100)}%</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.1)] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--overlay)/0.2)]"
                  disabled={!parsed || exportState === 'loading'}
                  onClick={handleExportMarkdown}
                >
                  Export Markdown
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl border border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.35)]"
                  disabled={!parsed || exportState === 'loading'}
                  onClick={handleExportJson}
                >
                  Export JSON
                </Button>
              </div>
              <Button
                type="button"
                className="w-full h-11 rounded-xl border border-[hsl(var(--love)/0.6)] bg-[hsl(var(--love)/0.2)] text-[hsl(var(--love-foreground))] hover:bg-[hsl(var(--love)/0.35)]"
                disabled={!parsed || !skills.length}
                onClick={handleSaveSnapshot}
              >
                Save snapshot
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--card)/0.5)] border-[hsl(var(--border)/0.5)] backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg text-[hsl(var(--foreground))]">Recent decoded roles</CardTitle>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Stored locally in your browser for offline reuse.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {snapshots.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No saved snapshots yet. Decode a role and choose "Save snapshot."</p>
          ) : (
            <ul className="space-y-3">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id} className="rounded-2xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                        {new Date(snapshot.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{snapshot.title}</h3>
                      <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{snapshot.text}</p>
                      {snapshot.experiences.length ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                            Experiences ({snapshot.experiences.length})
                          </p>
                          <ul className="space-y-2 text-xs text-[hsl(var(--foreground))]">
                            {snapshot.experiences.slice(0, 3).map((experience) => (
                              <li key={experience.id} className="rounded border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--overlay)/0.3)] p-2">
                                <span className="font-medium text-[hsl(var(--foreground))]">{experience.title}</span>
                                <span className="ml-2 text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                                  {experience.skillLabel}
                                </span>
                                {experience.summary ? <p className="mt-1 text-[hsl(var(--foreground))]">{experience.summary}</p> : null}
                              </li>
                            ))}
                            {snapshot.experiences.length > 3 ? (
                              <li className="text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">+ more saved</li>
                            ) : null}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs text-[hsl(var(--primary))]">
                      <span>Fit {Math.round(snapshot.fitCoverage * 100)}% · {snapshot.skillCount} skills</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="border border-[hsl(var(--destructive)/0.5)] bg-transparent text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.2)]"
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildBullet(inputs: BulletDraftInputs) {
  if (!inputs.verb && !inputs.what) return '';
  const parts: string[] = [];
  const verb = capitalize(inputs.verb);
  if (verb) parts.push(verb);
  if (inputs.what.trim()) parts.push(inputs.what.trim());

  let sentence = parts.join(' ');

  if (inputs.how.trim()) {
    const fragment = inputs.how.trim();
    const needsConnector = !fragment.toLowerCase().startsWith('by') && !fragment.toLowerCase().startsWith('through');
    sentence += needsConnector ? ` by ${fragment}` : ` ${fragment}`;
  }

  if (inputs.impact.trim()) {
    const impact = inputs.impact.trim();
    const needsSeparator = !impact.startsWith('(') && !impact.startsWith('—');
    sentence += needsSeparator ? ` — ${impact}` : ` ${impact}`;
  }

  return `• ${sentence.replace(/\s+/g, ' ').trim()}.`;
}

function capitalize(value: string) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function calculateFitCoverage(skills: DetectedSkill[]) {
  if (!skills.length) return 0;
  const maxFrequency = Math.max(...skills.map((skill) => skill.frequency));
  if (maxFrequency === 0) return 0;
  const normalized = skills.map((skill) => Math.min(1, skill.frequency / maxFrequency));
  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
