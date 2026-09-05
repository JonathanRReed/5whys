import * as React from 'react';
import { type GlowUpData, loadData, saveData } from '../../lib/glowup-store';
import DecodeSection from '../interview-glow-up/DecodeSection';
import PacketSection from '../interview-glow-up/PacketSection';
import StoriesSection from '../interview-glow-up/StoriesSection';
import VaultSection from '../interview-glow-up/VaultSection';
import WorkspaceHeader from '../interview-glow-up/WorkspaceHeader';
import WorkspaceTabs, { type Tab } from '../interview-glow-up/WorkspaceTabs';
import InterviewHUD from './InterviewHUD';

export default function InterviewGlowUpWorkspace() {
  const [data, setData] = React.useState<GlowUpData>(() => loadData());
  const [activeTab, setActiveTab] = React.useState<Tab>('decode');
  const [showHUD, setShowHUD] = React.useState(false);

  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!data) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveData(data);
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [data]);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const currentRole = data.roles.find((r) => r.id === data.currentRoleId);
  const currentPacket = data.packets.find((p) => p.id === data.currentPacketId);

  if (showHUD && currentPacket) {
    return (
      <InterviewHUD
        packet={currentPacket}
        stories={data.stories}
        role={currentRole}
        onClose={() => setShowHUD(false)}
      />
    );
  }

  const handleClearData = () => {
    setData(loadData());
  };

  return (
    <div className="space-y-6">
      <WorkspaceHeader onClearData={handleClearData} />

      <div className="flex items-center gap-2 rounded-lg border border-foam/25 bg-foam/5 px-4 py-2 text-sm text-muted-foreground">
        <svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-foam"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>
          <strong>No data leaves your browser.</strong> Everything is stored locally.
        </span>
      </div>

      <WorkspaceTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        showHUD={!!currentPacket}
        onLaunchHUD={() => setShowHUD(true)}
      />

      <div className="rounded-2xl border border-border/35 bg-overlay/20 p-6">
        {activeTab === 'decode' && (
          <DecodeSection data={data} setData={setData} currentRole={currentRole} />
        )}
        {activeTab === 'stories' && (
          <StoriesSection data={data} setData={setData} currentRole={currentRole} />
        )}
        {activeTab === 'vault' && (
          <VaultSection data={data} setData={setData} currentPacket={currentPacket} />
        )}
        {activeTab === 'packet' && (
          <PacketSection
            data={data}
            setData={setData}
            currentRole={currentRole}
            currentPacket={currentPacket}
            onLaunchHUD={() => setShowHUD(true)}
          />
        )}
      </div>
    </div>
  );
}
