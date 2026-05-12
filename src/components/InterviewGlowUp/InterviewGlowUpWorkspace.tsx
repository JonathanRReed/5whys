import * as React from 'react';
import {
  type GlowUpData,
  loadData,
  saveData,
} from '../../lib/glowup-store';
import InterviewHUD from './InterviewHUD';
import WorkspaceHeader from '../interview-glowup/WorkspaceHeader';
import WorkspaceTabs, { type Tab } from '../interview-glowup/WorkspaceTabs';
import DecodeSection from '../interview-glowup/DecodeSection';
import StoriesSection from '../interview-glowup/StoriesSection';
import VaultSection from '../interview-glowup/VaultSection';
import PacketSection from '../interview-glowup/PacketSection';

export default function InterviewGlowUpWorkspace() {
  const [data, setData] = React.useState<GlowUpData | null>(null);
  const [activeTab, setActiveTab] = React.useState<Tab>('decode');
  const [showHUD, setShowHUD] = React.useState(false);

  React.useEffect(() => {
    setData(loadData());
  }, []);

  React.useEffect(() => {
    if (data) {
      saveData(data);
    }
  }, [data]);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const currentRole = data.roles.find(r => r.id === data.currentRoleId);
  const currentPacket = data.packets.find(p => p.id === data.currentPacketId);

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

      <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--foam)/0.25)] bg-[hsl(var(--foam)/0.05)] px-4 py-2 text-sm text-muted-foreground">
        <svg className="h-4 w-4 flex-shrink-0 text-[hsl(var(--foam))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span><strong>No data leaves your browser.</strong> Everything is stored locally.</span>
      </div>

      <WorkspaceTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        showHUD={!!currentPacket}
        onLaunchHUD={() => setShowHUD(true)}
      />

      <div className="rounded-2xl border border-[hsl(var(--border)/0.35)] bg-[hsl(var(--overlay)/0.2)] p-6">
        {activeTab === 'decode' && (
          <DecodeSection
            data={data}
            setData={setData}
            currentRole={currentRole}
          />
        )}
        {activeTab === 'stories' && (
          <StoriesSection
            data={data}
            setData={setData}
            currentRole={currentRole}
          />
        )}
        {activeTab === 'vault' && (
          <VaultSection
            data={data}
            setData={setData}
            currentPacket={currentPacket}
          />
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
