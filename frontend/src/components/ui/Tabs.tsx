import { useState, ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export const Tabs = ({ tabs, defaultTab, activeTab: controlledActiveTab, onTabChange, className = '' }: TabsProps) => {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0].id);

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (controlledActiveTab !== undefined) {
      onTabChange?.(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`py-4 px-1 font-medium text-sm border-b-2 whitespace-nowrap transition-colors duration-200 ease-in-out ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="py-4">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};