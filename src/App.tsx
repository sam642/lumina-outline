import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Search, 
  Settings, 
  Moon, 
  Sun,
  CheckCircle2,
  Circle,
  Hash,
  FileText,
  Tag,
  X,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Calendar,
  Command,
  HelpCircle,
  Menu,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OutlineNode, AppMode } from './types';

const STORAGE_KEY = 'nxliner-data-v1';
const SETTINGS_KEY = 'nxliner-settings-v1';

// Initial dummy data
const initialData: OutlineNode[] = [
  {
    id: '1',
    text: 'Welcome to nxliner 🚀',
    isExpanded: true,
    isCompleted: false,
    createdAt: Date.now(),
    children: [
      {
        id: '1-1',
        text: 'Keyboard centric outliner for power users',
        isExpanded: true,
        isCompleted: false,
        children: []
      },
      {
        id: '1-2',
        text: 'Press ? for shortcuts help',
        isExpanded: true,
        isCompleted: false,
        children: []
      }
    ]
  },
  {
    id: '2',
    text: 'Getting Started',
    isExpanded: true,
    isCompleted: false,
    children: [
      {
        id: '2-1',
        text: 'Use j/k to move cursor',
        isExpanded: true,
        isCompleted: false,
        children: []
      },
      {
        id: '2-2',
        text: 'Press Enter or e to edit',
        isExpanded: true,
        isCompleted: false,
        children: []
      },
      {
        id: '2-3',
        text: 'Tab/Shift+Tab to indent/outdent',
        isExpanded: true,
        isCompleted: false,
        children: []
      }
    ]
  }
];

const generateId = () => Math.random().toString(36).substring(2, 11);

const extractTags = (text: string): string[] => {
  const matches = text.match(/#[\w-]+/g);
  return matches ? Array.from(new Set(matches.map(tag => tag.slice(1)))) : [];
};

// Flattening helper for selection logic
interface FlattenedItem {
  id: string;
  node: OutlineNode;
  parentId: string | null;
  depth: number;
}

const flattenTree = (nodes: OutlineNode[], currentHoistId: string | null, parentId: string | null = null, depth = 0): FlattenedItem[] => {
  let items: FlattenedItem[] = [];
  
  // Find the hoisted node if applicable
  const targetNodes = currentHoistId 
    ? findSubtree(nodes, currentHoistId)?.children || []
    : nodes;

  const traverse = (list: OutlineNode[], pId: string | null, d: number) => {
    list.forEach(node => {
      items.push({ id: node.id, node, parentId: pId, depth: d });
      if (node.isExpanded && node.children.length > 0) {
        traverse(node.children, node.id, d + 1);
      }
    });
  };

  if (currentHoistId) {
    const hoisted = findNodeAndPath(nodes, currentHoistId);
    if (hoisted) {
      items.push({ id: hoisted.node.id, node: hoisted.node, parentId: hoisted.parentId, depth: 0 });
      traverse(hoisted.node.children, hoisted.node.id, 1);
    }
  } else {
    traverse(nodes, null, 0);
  }

  return items;
};

const findSubtree = (nodes: OutlineNode[], id: string): OutlineNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findSubtree(node.children, id);
    if (found) return found;
  }
  return null;
};

const findNodeAndPath = (nodes: OutlineNode[], id: string, parentId: string | null = null): { node: OutlineNode, parentId: string | null } | null => {
  for (const node of nodes) {
    if (node.id === id) return { node, parentId };
    const found = findNodeAndPath(node.children, id, node.id);
    if (found) return found;
  }
  return null;
};

export default function App() {
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [mode, setMode] = useState<AppMode>('selection');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoistId, setHoistId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setNodes(JSON.parse(saved));
      } catch {
        setNodes(initialData);
      }
    } else {
      setNodes(initialData);
    }

    const setts = localStorage.getItem(SETTINGS_KEY);
    if (setts) {
      try {
        const { isDarkMode: dm, showCompleted: sc } = JSON.parse(setts);
        setIsDarkMode(dm ?? true);
        setShowCompleted(sc ?? true);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (nodes.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ isDarkMode, showCompleted }));
  }, [isDarkMode, showCompleted]);

  // Derived state
  const flattened = useMemo(() => flattenTree(nodes, hoistId), [nodes, hoistId]);
  
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    flattened.forEach(item => {
      item.node.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [flattened]);

  const filteredFlattened = useMemo(() => {
    let result = flattened;
    if (!showCompleted) {
      result = result.filter(item => !item.node.isCompleted);
    }
    if (selectedTags.length > 0) {
      result = result.filter(item => 
        selectedTags.every(tag => item.node.tags?.includes(tag))
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => item.node.text.toLowerCase().includes(q) || (item.node.note && item.node.note.toLowerCase().includes(q)));
    }
    return result;
  }, [flattened, showCompleted, searchQuery, selectedTags]);

  // Selection management
  useEffect(() => {
    if (!selectedId && filteredFlattened.length > 0) {
      setSelectedId(filteredFlattened[0].id);
    }
  }, [filteredFlattened, selectedId]);

  const moveSelection = (direction: 'up' | 'down') => {
    const currentIndex = filteredFlattened.findIndex(i => i.id === selectedId);
    if (direction === 'up' && currentIndex > 0) {
      setSelectedId(filteredFlattened[currentIndex - 1].id);
    } else if (direction === 'down' && currentIndex < filteredFlattened.length - 1) {
      setSelectedId(filteredFlattened[currentIndex + 1].id);
    }
  };

  // Node operations
  const updateNode = useCallback((id: string, updates: Partial<OutlineNode>) => {
    const updateRecursive = (list: OutlineNode[]): OutlineNode[] => {
      return list.map(node => {
        if (node.id === id) {
          if (updates.isCompleted !== undefined) {
             updates.completedAt = updates.isCompleted ? Date.now() : undefined;
          }
          // Auto-extract tags if text changes
          if (updates.text !== undefined) {
            updates.tags = extractTags(updates.text);
          }
          return { ...node, ...updates };
        }
        return { ...node, children: updateRecursive(node.children) };
      });
    };
    setNodes(prev => updateRecursive(prev));
  }, []);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const deleteNode = useCallback((id: string) => {
    const delRecursive = (list: OutlineNode[]): OutlineNode[] => {
      return list
        .filter(n => n.id !== id)
        .map(n => ({ ...n, children: delRecursive(n.children) }));
    };
    setNodes(prev => {
      const parent = filteredFlattened.find(f => f.id === id);
      const currentIndex = filteredFlattened.findIndex(f => f.id === id);
      if (currentIndex > 0) setSelectedId(filteredFlattened[currentIndex - 1].id);
      else if (filteredFlattened.length > 1) setSelectedId(filteredFlattened[1].id);
      else setSelectedId(null);
      return delRecursive(prev);
    });
  }, [filteredFlattened]);

  const addNode = (afterId: string | null) => {
    const newId = generateId();
    const newNode: OutlineNode = {
      id: newId,
      text: '',
      isExpanded: true,
      isCompleted: false,
      createdAt: Date.now(),
      children: []
    };

    if (!afterId) {
      setNodes(prev => [newNode, ...prev]);
    } else {
      const insertAt = (list: OutlineNode[]): OutlineNode[] => {
        const index = list.findIndex(n => n.id === afterId);
        if (index !== -1) {
          const newList = [...list];
          newList.splice(index + 1, 0, newNode);
          return newList;
        }
        return list.map(n => ({ ...n, children: insertAt(n.children) }));
      };
      setNodes(prev => insertAt(prev));
    }
    
    setSelectedId(newId);
    setMode('edit');
  };

  const indentNode = (id: string) => {
    const parentInfo = findNodeAndPath(nodes, id);
    if (!parentInfo) return;
    const { parentId } = parentInfo;

    const lift = (list: OutlineNode[]): { list: OutlineNode[], success: boolean } => {
      const idx = list.findIndex(n => n.id === id);
      if (idx > 0) {
        const node = list[idx];
        const prev = list[idx - 1];
        const newList = list.filter(n => n.id !== id);
        newList[idx - 1] = { ...prev, children: [...prev.children, node], isExpanded: true };
        return { list: newList, success: true };
      }
      for (let i = 0; i < list.length; i++) {
        const res = lift(list[i].children);
        if (res.success) {
          const newList = [...list];
          newList[i] = { ...list[i], children: res.list };
          return { list: newList, success: true };
        }
      }
      return { list, success: false };
    };
    setNodes(prev => lift(prev).list);
  };

  const outdentNode = (id: string) => {
    const parentInfo = findNodeAndPath(nodes, id);
    if (!parentInfo || !parentInfo.parentId) return;

    const drop = (list: OutlineNode[], currentParentId: string | null = null): { list: OutlineNode[], success: boolean, extracted: OutlineNode | null } => {
      const idx = list.findIndex(n => n.id === id);
      if (idx !== -1 && currentParentId) {
        // We are in a children list
        const node = list[idx];
        return { list: list.filter(n => n.id !== id), success: true, extracted: node };
      }
      
      for (let i = 0; i < list.length; i++) {
        const res = drop(list[i].children, list[i].id);
        if (res.success) {
          const newList = [...list];
          newList[i] = { ...list[i], children: res.list };
          if (res.extracted) {
             newList.splice(i + 1, 0, res.extracted);
          }
          return { list: newList, success: true, extracted: null };
        }
      }
      return { list, success: false, extracted: null };
    };
    setNodes(prev => drop(prev).list);
  };

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isHelpOpen) {
        if (e.key === 'Escape' || e.key === '?') setIsHelpOpen(false);
        return;
      }

      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if (mode === 'selection' && !isInput) {
        switch (e.key.toLowerCase()) {
          case 'j': moveSelection('down'); break;
          case 'k': moveSelection('up'); break;
          case 'arrowdown': e.preventDefault(); moveSelection('down'); break;
          case 'arrowup': e.preventDefault(); moveSelection('up'); break;
          case 'enter': e.preventDefault(); setMode('edit'); break;
          case 'e': e.preventDefault(); setMode('edit'); break;
          case ' ': e.preventDefault(); if (selectedId) updateNode(selectedId, { isCompleted: !flattened.find(f => f.id === selectedId)?.node.isCompleted }); break;
          case 'n': e.preventDefault(); setMode('edit'); break; // note editing usually separate but same for now
          case 'tab': 
            e.preventDefault(); 
            if (selectedId) {
              if (e.shiftKey) outdentNode(selectedId);
              else indentNode(selectedId);
            }
            break;
          case 'd':
            if (e.ctrlKey) {
               e.preventDefault();
               if (selectedId) deleteNode(selectedId);
            }
            break;
          case 'h':
            if (selectedId) {
               if (hoistId === selectedId) setHoistId(null);
               else setHoistId(selectedId);
            }
            break;
          case 'u': setHoistId(null); break;
          case '?': setIsHelpOpen(true); break;
          case '/': e.preventDefault(); document.getElementById('search-input')?.focus(); break;
        }
      } else if (mode === 'edit') {
         if (e.key === 'Escape') setMode('selection');
         if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setMode('selection'); addNode(selectedId); }
         if (e.key === 'Tab') {
           e.preventDefault();
           if (selectedId) {
             if (e.shiftKey) outdentNode(selectedId);
             else indentNode(selectedId);
           }
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedId, flattened, filteredFlattened, nodes, hoistId, isHelpOpen]);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 grid-bg ${isDarkMode ? 'dark bg-[#141414] text-[#E4E3E0]' : 'bg-[#E4E3E0] text-[#141414]'}`}>
      {/* Navigation */}
      <nav className={`sticky top-0 z-50 border-b flex items-center justify-between px-6 py-3 backdrop-blur-md ${isDarkMode ? 'bg-[#141414]/80 border-[#2d2d2d]' : 'bg-[#E4E3E0]/80 border-[#141414]/10'}`}>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 font-mono font-bold tracking-tighter">
              <div className="bg-[#141414] dark:bg-[#E4E3E0] text-[#E4E3E0] dark:text-[#141414] p-1 px-2 rounded-sm transform -skew-x-12">NX</div>
              <span className="text-xl">LINER</span>
           </div>
           
           {hoistId && (
             <div className="flex items-center gap-1 text-xs opacity-60">
                <ChevronRight size={14} />
                <button onClick={() => setHoistId(null)} className="hover:underline">Home</button>
                <ChevronRight size={14} />
                <span className="font-medium truncate max-w-[150px]">{findSubtree(nodes, hoistId)?.text}</span>
             </div>
           )}
        </div>

        <div className="flex items-center gap-4">
           {allTags.length > 0 && (
             <div className="flex items-center gap-1.5 px-2 border-r border-[#141414]/10 dark:border-[#2d2d2d] mr-2 overflow-x-auto max-w-[300px] no-scrollbar">
                {allTags.map(tag => (
                   <button 
                     key={tag}
                     onClick={() => toggleTag(tag)}
                     className={`px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap font-mono transition-all ${
                       selectedTags.includes(tag) 
                         ? 'bg-blue-500 text-white' 
                         : 'bg-black/5 dark:bg-white/5 opacity-40 hover:opacity-100'
                     }`}
                   >
                     #{tag}
                   </button>
                ))}
             </div>
           )}

           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border ${isDarkMode ? 'bg-[#1a1a1a] border-[#2d2d2d]' : 'bg-white border-[#141414]/10'}`}>
              <Search size={14} className="opacity-40" />
              <input 
                id="search-input"
                type="text" 
                placeholder="Search ( / )" 
                className="bg-transparent border-none outline-none text-xs w-48 font-mono"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="opacity-40 hover:opacity-100">
                  <X size={14} />
                </button>
              )}
           </div>

           <button 
             onClick={() => setShowCompleted(!showCompleted)}
             className={`p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-sm transition-colors ${!showCompleted ? 'text-blue-500' : 'opacity-40'}`}
             title={showCompleted ? "Hide Completed" : "Show Completed"}
           >
              {showCompleted ? <Eye size={18} /> : <EyeOff size={18} />}
           </button>

           <button 
             onClick={() => setIsDarkMode(!isDarkMode)}
             className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-sm transition-colors opacity-40 hover:opacity-100"
           >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
           </button>

           <button 
             onClick={() => setIsHelpOpen(true)}
             className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-sm transition-colors opacity-40 hover:opacity-100"
           >
              <HelpCircle size={18} />
           </button>
        </div>
      </nav>

      {/* Workspace */}
      <main className="max-w-4xl mx-auto px-6 py-12">
         {/* Toolbar */}
         <div className="mb-8 flex items-end justify-between border-b border-[#141414]/10 dark:border-[#2d2d2d] pb-4">
            <div>
               <h2 className="font-serif italic text-3xl opacity-90">{hoistId ? findSubtree(nodes, hoistId)?.text : 'All Tasks'}</h2>
               <p className="text-xs font-mono opacity-40 mt-1 uppercase tracking-widest">
                  {filteredFlattened.length} items · {filteredFlattened.filter(f => f.node.isCompleted).length} completed
               </p>
            </div>
            
            <div className="flex gap-2 text-[10px] font-mono opacity-40 uppercase">
               <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded-sm">selection mode: {mode}</span>
               {hoistId && <span className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded-sm">hoisted</span>}
            </div>
         </div>

         {/* List */}
         <div className="relative space-y-0.5">
            {/* Tag filter summary */}
            {selectedTags.length > 0 && (
               <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-500/5 rounded-sm border border-blue-500/20">
                  <span className="text-[10px] font-mono uppercase opacity-60">Filtered by:</span>
                  <div className="flex gap-1">
                     {selectedTags.map(tag => (
                        <button 
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className="bg-blue-500 text-white px-1.5 py-0.5 rounded-sm text-[10px] font-mono flex items-center gap-1"
                        >
                           #{tag} <X size={10} />
                        </button>
                     ))}
                  </div>
                  <button 
                    onClick={() => setSelectedTags([])}
                    className="ml-auto text-[10px] font-mono uppercase opacity-40 hover:opacity-100 border-b border-transparent hover:border-current"
                  >
                     Clear filters
                  </button>
               </div>
            )}

            {/* Focus Line */}
            {selectedId && (
               <motion.div 
                 layoutId="focus-line"
                 className="absolute left-0 w-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-20"
                 initial={false}
                 animate={{ 
                   height: 32, 
                   top: filteredFlattened.findIndex(f => f.id === selectedId) * 32 
                 }}
                 transition={{ type: 'spring', stiffness: 500, damping: 50 }}
               />
            )}

            {filteredFlattened.map((item, index) => (
              <NodeRow 
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                isEditMode={selectedId === item.id && mode === 'edit'}
                onUpdate={updateNode}
                onSelect={setSelectedId}
                onAdd={addNode}
                onIndent={indentNode}
                onOutdent={outdentNode}
                onDelete={deleteNode}
                onHoist={setHoistId}
                onTagClick={toggleTag}
              />
            ))}

            {filteredFlattened.length === 0 && (
               <div className="text-center py-20 opacity-40 italic font-serif">
                  No items found. Press Enter to start typing.
               </div>
            )}
         </div>
      </main>

      {/* Keyboard Help Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full max-w-2xl p-8 rounded-sm shadow-2xl border ${isDarkMode ? 'bg-[#1a1a1a] border-[#2d2d2d]' : 'bg-white border-[#141414]/10'}`}
            >
              <div className="flex items-center justify-between mb-8 border-b pb-4 border-[#141414]/10 dark:border-[#2d2d2d]">
                 <h2 className="text-2xl font-serif italic">nxliner Shortcuts</h2>
                 <button onClick={() => setIsHelpOpen(false)}><X size={20} /></button>
              </div>

              <div className="grid grid-cols-2 gap-8 text-sm">
                 <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-blue-500 mb-4">Navigation</h3>
                    <div className="space-y-3">
                       <ShortcutItem keys={['j', 'k']} desc="Move selection down/up" />
                       <ShortcutItem keys={['Enter', 'e']} desc="Edit current item" />
                       <ShortcutItem keys={['Esc']} desc="Exit edit mode / selection" />
                       <ShortcutItem keys={['/']} desc="Focus search" />
                    </div>
                 </div>
                 <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-blue-500 mb-4">Actions</h3>
                    <div className="space-y-3">
                       <ShortcutItem keys={['Space']} desc="Toggle completion" />
                       <ShortcutItem keys={['Tab']} desc="Indent (Move right)" />
                       <ShortcutItem keys={['Shift', 'Tab']} desc="Outdent (Move left)" />
                       <ShortcutItem keys={['h']} desc="Hoist (Zoom into branch)" />
                       <ShortcutItem keys={['u']} desc="Unhoist (Go up)" />
                       <ShortcutItem keys={['Ctrl', 'D']} desc="Delete item" />
                    </div>
                 </div>
              </div>
              
              <div className="mt-12 pt-6 border-t border-[#141414]/10 dark:border-[#2d2d2d] flex justify-between items-center opacity-40 font-mono text-[10px]">
                 <span>v1.0.0 "Checkvist Style"</span>
                 <span>nxliner project</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShortcutItem({ keys, desc }: { keys: string[], desc: string }) {
  return (
    <div className="flex items-center justify-between">
       <span className="opacity-60">{desc}</span>
       <div className="flex gap-1">
          {keys.map(k => (
            <kbd key={k} className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono min-w-[24px] text-center">{k}</kbd>
          ))}
       </div>
    </div>
  );
}

interface NodeRowProps {
  item: FlattenedItem;
  isSelected: boolean;
  isEditMode: boolean;
  onUpdate: (id: string, updates: Partial<OutlineNode>) => void;
  onSelect: (id: string) => void;
  onAdd: (afterId: string | null) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onDelete: (id: string) => void;
  onHoist: (id: string) => void;
  onTagClick: (tag: string) => void;
}

const NodeRow: React.FC<NodeRowProps> = ({ 
  item, 
  isSelected, 
  isEditMode, 
  onUpdate, 
  onSelect, 
  onAdd, 
  onIndent, 
  onOutdent,
  onDelete,
  onHoist,
  onTagClick
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditMode]);

  const toggleComplete = () => onUpdate(item.id, { isCompleted: !item.node.isCompleted });

  const renderText = () => {
    if (!item.node.text) return <span className="opacity-30 italic">Add task...</span>;
    
    // Simple regex to match tags and highlight them visually
    const parts = item.node.text.split(/(#[\w-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        const tag = part.slice(1);
        return (
          <span 
            key={i} 
            onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
            className="text-blue-500 hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div 
      onClick={() => onSelect(item.id)}
      className={`group flex items-start h-8 transition-colors ${isSelected ? 'bg-blue-500/5 dark:bg-blue-500/10' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'}`}
      style={{ paddingLeft: `${item.depth * 28 + 12}px` }}
    >
       <div className="flex items-center h-full w-6 justify-center">
          {item.node.children.length > 0 ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { isExpanded: !item.node.isExpanded }); }}
              className="opacity-40 hover:opacity-100 transition-opacity"
            >
              {item.node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-4 h-4 rounded-full border border-current opacity-10" />
          )}
       </div>

       <button 
         onClick={(e) => { e.stopPropagation(); toggleComplete(); }}
         className={`mt-1.5 mr-3 transition-colors ${item.node.isCompleted ? 'text-green-500 opacity-100' : 'opacity-20 hover:opacity-100'}`}
       >
          {item.node.isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
       </button>

       <div className="flex-1 flex items-center h-full min-w-0">
          {isEditMode ? (
            <input 
              ref={inputRef}
              type="text"
              className="w-full bg-transparent border-none outline-none font-sans text-sm h-full"
              value={item.node.text}
              onChange={e => onUpdate(item.id, { text: e.target.value })}
              onBlur={() => onSelect(item.id)} // Keep selection on blur is handled by mode
            />
          ) : (
            <div className={`text-sm truncate font-sans ${item.node.isCompleted ? 'line-through opacity-40 italic' : 'opacity-90'}`}>
               {renderText()}
            </div>
          )}
       </div>

       {/* Item Meta */}
       <div className="flex items-center gap-3 pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.node.isExpanded && !isEditMode && (
             <button onClick={() => onHoist(item.id)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-sm opacity-40 hover:opacity-100 transition-all">
                <Maximize2 size={12} />
             </button>
          )}
          <button onClick={() => onDelete(item.id)} className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded-sm opacity-40 hover:opacity-100 transition-all">
             <Trash2 size={12} />
          </button>
       </div>
    </div>
  );
}
