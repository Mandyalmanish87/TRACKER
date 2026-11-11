import React from 'react';
import {
  Activity, BookOpen, CalendarDays, ChartPie, ClipboardCheck, ClipboardList,
  Heart, Home, NotebookPen, Settings2,
} from 'lucide-react';

export type BloomPage = 'overview' | 'cycle' | 'checkin' | 'symptoms' | 'journal' | 'care' | 'insights' | 'learn' | 'plan' | 'settings';

const pages: Array<{ id: BloomPage; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'cycle', label: 'Cycle', icon: CalendarDays },
  { id: 'checkin', label: 'Check-in', icon: ClipboardCheck },
  { id: 'symptoms', label: 'Symptoms', icon: Activity },
  { id: 'journal', label: 'Journal', icon: NotebookPen },
  { id: 'care', label: 'Comfort', icon: Heart },
  { id: 'insights', label: 'Insights', icon: ChartPie },
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'plan', label: 'My plan', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

interface BloomNavigationProps { activePage: BloomPage; onChange: (page: BloomPage) => void }

export const BloomNavigation: React.FC<BloomNavigationProps> = ({ activePage, onChange }) => (
  <nav aria-label="Bloom sections" className="bloom-navigation">
    <div className="bloom-navigation-label"><span className="bloom-brand-mark"><Heart className="h-4 w-4" fill="currentColor" /></span><div><strong>Bloom</strong><span>Your private space</span></div></div>
    <div className="bloom-navigation-items" role="group" aria-label="Bloom pages">
      {pages.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={activePage === id ? 'page' : undefined} onClick={() => onChange(id)} className="bloom-navigation-item"><Icon className="h-[17px] w-[17px]" aria-hidden="true" /><span>{label}</span>{activePage === id && <span className="bloom-active-mark" aria-hidden="true" />}</button>)}
    </div>
    <div className="bloom-navigation-note"><span className="bloom-privacy-dot" />Private to this device</div>
  </nav>
);
