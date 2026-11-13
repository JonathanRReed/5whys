import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DecodeSection, { isFillerLine } from '../src/components/interview-glow-up/DecodeSection';
import InterviewGlowUpWorkspace from '../src/components/interview-glow-up/InterviewGlowUpWorkspace';
import InterviewHUD from '../src/components/interview-glow-up/InterviewHUD';
import PacketPrint, { roleHeading } from '../src/components/interview-glow-up/PacketPrint';
import StoriesSection, { proofLine } from '../src/components/interview-glow-up/StoriesSection';
import { detectSkillsFromText } from '../src/lib/glowup-banks/detect';
import {
  type DecodedBullet,
  type DecodedRole,
  type GlowUpData,
  getTopGaps,
  type InterviewPacket,
  STORAGE_KEY,
  type Story,
} from '../src/lib/glowup-store';

function bullet(id: string, text: string, extra: Partial<DecodedBullet> = {}): DecodedBullet {
  return {
    id,
    text,
    status: 'active',
    primarySkillId: 'communication',
    secondarySkillIds: [],
    section: 'required',
    confirmed: false,
    origin: 'parsed',
    ...extra,
  };
}

const role: DecodedRole = {
  id: 'role',
  jobTitle: 'Community Programs Intern',
  company: '',
  rawJdText: 'Community Programs Intern\nWe ask for clear written communication and more.'.repeat(
    2
  ),
  bullets: [bullet('b1', 'Clear written communication')],
  createdAt: 1000,
  updatedAt: 1000,
};

const packet: InterviewPacket = {
  id: 'packet',
  roleId: 'role',
  mode: 'prep',
  topStoryIds: ['story'],
  customQuestions: ['What does a good first month look like?'],
  notes: '',
  panicAnswer: '',
  companyIntel: { keywords: ['community', 'reliable'], notes: '', links: [] },
  createdAt: 1000,
  updatedAt: 1000,
};

const story: Story = {
  id: 'story',
  primarySkillId: 'communication',
  otherSkillIds: [],
  trigger: 'Pantry schedule',
  hook: 'Volunteers kept missing shifts.',
  proofSnippet: '',
  play: 'I rebuilt our campus pantry volunteer schedule and the volunteers stopped missing shifts.',
  proof: 'No missed shifts for the rest of the term.',
  confidence: 60,
  readiness: 'solid',
  questionPrompts: [],
  tags: [],
  createdAt: 1000,
  updatedAt: 1000,
};

function seed(data: Partial<GlowUpData>) {
  const full: GlowUpData = {
    version: 1,
    roles: [role],
    packets: [{ ...packet, topStoryIds: [] }],
    stories: [],
    currentRoleId: role.id,
    currentPacketId: packet.id,
    ...data,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  return full;
}

beforeEach(() => {
  localStorage.clear();
  window.print = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

describe('workspace saving', () => {
  it('says the edit was not saved when storage refuses it', async () => {
    seed({});
    render(<InterviewGlowUpWorkspace />);
    openTab(/Decode the job/);
    const company = await screen.findByLabelText('Company');
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === STORAGE_KEY) throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    fireEvent.change(company, { target: { value: 'City Parks Department' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('would not save your last change');
    expect(screen.getByText(/Not saved/)).toBeInTheDocument();
    expect(screen.queryByText(/^Saved$/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Download a backup file' }).length).toBe(2);
  });
});

describe('workspace tabs and drafts', () => {
  it('keeps an unsaved story when switching tabs and back', async () => {
    seed({});
    render(<InterviewGlowUpWorkspace />);
    // A decoded role with no stories opens on Build stories.
    fireEvent.click(await screen.findByRole('button', { name: '+ New story' }));
    fireEvent.change(screen.getByLabelText(/What you did/), {
      target: { value: 'I rebuilt the volunteer schedule.' },
    });
    openTab(/Decode the job/);
    openTab(/Build stories/);
    expect(screen.getByLabelText(/What you did/)).toHaveValue('I rebuilt the volunteer schedule.');
  });

  it('stays on Decode the job when the posting is pasted but not parsed', async () => {
    seed({ roles: [{ ...role, bullets: [] }] });
    render(<InterviewGlowUpWorkspace />);
    expect(await screen.findByRole('button', { name: 'Parse the requirements' })).toBeVisible();
    expect(screen.getByRole('tab', { name: /Decode the job/ })).toHaveAttribute(
      'data-state',
      'active'
    );
  });

  it('keeps the only saved role reachable after Decode another job', () => {
    const data: GlowUpData = {
      version: 1,
      roles: [role],
      packets: [packet],
      stories: [],
      currentRoleId: null,
      currentPacketId: null,
    };
    render(<DecodeSection data={data} setData={vi.fn()} currentRole={undefined} />);
    expect(screen.getByRole('combobox', { name: 'Switch role' })).toBeInTheDocument();
  });
});

describe('decoder flags', () => {
  it('flags filler, not short requirements', () => {
    expect(isFillerLine('Other duties as assigned')).toBe(true);
    for (const text of [
      'Spanish language skills',
      'Clear written communication',
      'CPR certified',
    ]) {
      expect(isFillerLine(text)).toBe(false);
    }
    const data: GlowUpData = {
      version: 1,
      roles: [],
      packets: [],
      stories: [],
      currentRoleId: 'role',
      currentPacketId: null,
    };
    const shortRole = {
      ...role,
      bullets: [
        bullet('a', 'Spanish language skills'),
        bullet('b', 'CPR certified'),
        bullet('c', 'Other duties as assigned', { section: 'unclassified' }),
      ],
    };
    render(
      <DecodeSection
        data={{ ...data, roles: [shortRole] }}
        setData={vi.fn()}
        currentRole={shortRole}
      />
    );
    expect(screen.queryByText('noise?')).not.toBeInTheDocument();
    expect(screen.getAllByText('often filler')).toHaveLength(1);
    // The header and the count below agree, or say why they differ.
    expect(screen.getByRole('heading', { name: 'Lines from the posting (3)' })).toBeInTheDocument();
    expect(screen.getByTestId('lines-counted')).toHaveTextContent(
      '2 of 3 are counted below as required, nice to have, or a duty.'
    );
    expect(screen.getByTestId('tests-denominator')).toHaveTextContent('Counted over the 2 lines');
  });

  it('calls spreadsheet record keeping administrative, not data analysis', () => {
    const ids = (text: string) => detectSkillsFromText(text).map((s) => s.skillId);
    expect(ids('Track pantry visits in a spreadsheet')).not.toContain('data-analysis');
    expect(ids('Comfortable with Excel or Google Sheets')).not.toContain('data-analysis');
    expect(ids('Track pantry visits in a spreadsheet')).toContain('administrative');
    expect(ids('Analyze visit trends in Excel')).toContain('data-analysis');
  });
});

describe('stories', () => {
  it('does not let an "idk" story close a skill gap', () => {
    const data: GlowUpData = {
      version: 1,
      roles: [role],
      packets: [packet],
      stories: [{ ...story, play: 'idk' }],
      currentRoleId: 'role',
      currentPacketId: 'packet',
    };
    expect(getTopGaps(data, role.bullets)).toContain('communication');
    expect(getTopGaps({ ...data, stories: [story] }, role.bullets)).not.toContain('communication');
  });

  it('asks one gentle follow-up instead of saving "idk" as a story', () => {
    const data: GlowUpData = {
      version: 1,
      roles: [role],
      packets: [packet],
      stories: [],
      currentRoleId: 'role',
      currentPacketId: 'packet',
    };
    render(
      <StoriesSection
        data={data}
        setData={vi.fn()}
        currentRole={role}
        currentPacket={packet}
        onGoToDecode={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '+ New story' }));
    fireEvent.change(screen.getByLabelText(/What you did/), { target: { value: 'idk' } });
    expect(screen.getByText(/That is an honest answer/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and add to packet' })).toBeDisabled();
  });

  it('asks for the parts in the order a person tells them, and for the proof once', () => {
    const data: GlowUpData = {
      version: 1,
      roles: [role],
      packets: [packet],
      stories: [],
      currentRoleId: 'role',
      currentPacketId: 'packet',
    };
    render(
      <StoriesSection
        data={data}
        setData={vi.fn()}
        currentRole={role}
        currentPacket={packet}
        onGoToDecode={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '+ New story' }));
    const fields = ['A short name for it', 'The situation', 'What you did', 'What came of it'].map(
      (label) => screen.getByLabelText(new RegExp(label))
    );
    for (let i = 1; i < fields.length; i += 1) {
      expect(
        fields[i - 1].compareDocumentPosition(fields[i]) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
    expect(screen.queryByLabelText(/Proof in one line/)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/proof/i)).toHaveLength(1);
  });

  it('opens an older story whose proof lived only in the short line', () => {
    const older = { ...story, proof: '', proofSnippet: 'Finished on time' };
    const setData = vi.fn();
    const data: GlowUpData = {
      version: 1,
      roles: [role],
      packets: [packet],
      stories: [older],
      currentRoleId: 'role',
      currentPacketId: 'packet',
    };
    render(
      <StoriesSection
        data={data}
        setData={setData}
        currentRole={role}
        currentPacket={packet}
        onGoToDecode={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit story: Pantry schedule/ }));
    expect(screen.getByLabelText(/What came of it/)).toHaveValue('Finished on time');
    fireEvent.click(screen.getByRole('button', { name: 'Save story' }));
    const saved = (setData.mock.calls[0][0] as GlowUpData).stories[0];
    expect(saved.proof).toBe('Finished on time');
    expect(saved.proofSnippet).toBe('Finished on time');
  });

  it('derives the cheat-sheet line from the proof', () => {
    expect(proofLine('No missed shifts for the rest of the term. My manager noticed.')).toBe(
      'No missed shifts for the rest of the term.'
    );
  });
});

describe('cheat sheet (HUD)', () => {
  it('lets a focused button take Enter and Space', () => {
    render(<InterviewHUD packet={packet} stories={[story]} role={role} onClose={vi.fn()} />);
    const close = screen.getByRole('button', { name: 'Close HUD' });
    close.focus();
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    close.dispatchEvent(space);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    close.dispatchEvent(enter);
    expect(space.defaultPrevented).toBe(false);
    expect(enter.defaultPrevented).toBe(false);
    expect(screen.queryByPlaceholderText(/Search stories/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pantry schedule/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('keeps its shortcuts when focus is on the sheet itself', () => {
    render(<InterviewHUD packet={packet} stories={[story]} role={role} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(screen.getByPlaceholderText(/Search stories/)).toBeInTheDocument();
  });

  it('titles the sheet without a stray colon when no company was entered', () => {
    render(<InterviewHUD packet={packet} stories={[story]} role={role} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Community Programs Intern$/
    );
    expect(roleHeading({ ...role, company: 'City Parks' })).toBe(
      'Community Programs Intern at City Parks'
    );
  });
});

describe('printing', () => {
  it('prints the packet with each story in full, keywords, and questions to ask', () => {
    render(
      <PacketPrint packet={packet} stories={[story]} role={role} from="packet" onDone={vi.fn()} />
    );
    const sheet = screen.getByTestId('packet-print');
    expect(sheet).toHaveTextContent('Community Programs Intern');
    expect(sheet).not.toHaveTextContent(/^:/);
    expect(sheet).toHaveTextContent(story.play);
    expect(sheet).toHaveTextContent(story.proof);
    expect(sheet).toHaveTextContent('community, reliable');
    expect(sheet).toHaveTextContent('What does a good first month look like?');
    expect(sheet.querySelector('input, textarea')).toBeNull();
    expect(document.documentElement.dataset.print).toBe('resume');
  });

  it('prints the cheat sheet from the open cheat sheet', async () => {
    seed({ packets: [packet], stories: [story] });
    render(<InterviewGlowUpWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /Open the cheat sheet/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Print the cheat sheet' }));
    await waitFor(() => expect(screen.getByTestId('packet-print')).toBeInTheDocument());
    expect(screen.getByTestId('packet-print')).toHaveTextContent('One-screen cheat sheet (HUD)');
    expect(screen.getByTestId('packet-print')).toHaveTextContent(story.play);
    // The dialog steps aside so it does not hide the sheet on paper.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('turns the browser print with the cheat sheet open into the cheat sheet', async () => {
    seed({ packets: [packet], stories: [story] });
    render(<InterviewGlowUpWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /Open the cheat sheet/ }));
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.getByTestId('packet-print')).toHaveTextContent(story.play);
    expect(window.print).not.toHaveBeenCalled();
  });
});
