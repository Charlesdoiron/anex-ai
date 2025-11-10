"use client";

interface SidebarProps {
  isOpen: boolean;
  onNewChat: () => void;
}

export function Sidebar({ isOpen, onNewChat }: SidebarProps) {
  return (
    <div
      className={`${
        isOpen ? "w-64" : "w-0"
      } transition-all duration-200 bg-[#fef9f4] dark:bg-[#202123] flex flex-col overflow-hidden ${
        isOpen ? "border-r border-gray-800" : ""
      }`}
    >
      {isOpen && (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 px-2">
            <div className="mt-2 px-2">{/* Empty chat history */}</div>
          </div>
        </>
      )}
    </div>
  );
}
