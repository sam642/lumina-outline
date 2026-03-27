import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  GripVertical, 
  Search, 
  Settings, 
  Moon, 
  Sun,
  CheckCircle2,
  Circle,
  Hash,
  FileText,
  MoreHorizontal,
  Tag,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  DndContext, 
  DragOverlay, 
  closestCenter, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'motion/react';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { OutlineNode } from './types';

const STORAGE_KEY = 'lumina-outline-data';
const SETTINGS_KEY = 'lumina-outline-settings';

const initialData: OutlineNode[] = [
  {
    id: '1',
    text: 'Welcome to Lumina Outline',
    isExpanded: true,
    isCompleted: false,
    children: [
      {
        id: '1-1',
        text: 'Use Tab to indent an item',
        isExpanded: true,
        isCompleted: false,
        children: []
      },
      {
        id: '1-2',
        text: 'Use Shift + Tab to outdent',
        isExpanded: true,
        isCompleted: false,
        children: []
      },
      {
        id: '1-3',
        text: 'Press Enter to create a new item',
        isExpanded: true,
        isCompleted: false,
        children: []
      }
    ]
  },
  {
    id: '2',
    text: 'Project Ideas',
    isExpanded: true,
    isCompleted: false,
    children: [
      {
        id: '2-1',
        text: 'Build a custom outliner',
        isExpanded: true,
        isCompleted: true,
        children: []
      },
      {
        id: '2-2',
        text: 'Learn Framer Motion',
        isExpanded: true,
        isCompleted: false,
        children: []
      }
    ]
  }
];

const generateId = () => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36).substring(4);
};

const extractTags = (text: string): string[] => {
  const matches = text.match(/#[\w-]+/g);
  return matches ? matches.map(tag => tag.slice(1)) : [];
};

interface FlattenedNode extends OutlineNode {
  parentId: string | null;
  depth: number;
  index: number;
}

const flattenTree = (items: OutlineNode[], parentId: string | null = null, depth = 0): FlattenedNode[] => {
  return items.reduce<FlattenedNode[]>((acc, item, index) => {
    acc.push({ ...item, parentId, depth, index });
    if (item.isExpanded && item.children.length > 0) {
      acc.push(...flattenTree(item.children, item.id, depth + 1));
    }
    return acc;
  }, []);
};

const buildTree = (flattened: FlattenedNode[]): OutlineNode[] => {
  const root: OutlineNode[] = [];
  const nodesMap = new Map<string, OutlineNode>();

  flattened.forEach(item => {
    const node = { ...item, children: [] };
    nodesMap.set(node.id, node);
  });

  flattened.forEach(item => {
    const node = nodesMap.get(item.id)!;
    if (item.parentId === null) {
      root.push(node);
    } else {
      const parent = nodesMap.get(item.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        root.push(node); // Fallback
      }
    }
  });

  return root;
};

export default function App() {
  const [nodes, setNodes] = useState<OutlineNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [projectedDepth, setProjectedDepth] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Sanitize: Ensure no duplicate IDs at the root level at least
        const seen = new Set();
        const sanitized = parsed.filter((node: OutlineNode) => {
          if (seen.has(node.id)) return false;
          seen.add(node.id);
          return true;
        });
        setNodes(sanitized.length > 0 ? sanitized : initialData);
      } catch (e) {
        setNodes(initialData);
      }
    } else {
      setNodes(initialData);
    }

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const { showCompleted: savedShowCompleted, isDarkMode: savedIsDarkMode } = JSON.parse(savedSettings);
        if (savedShowCompleted !== undefined) setShowCompleted(savedShowCompleted);
        if (savedIsDarkMode !== undefined) setIsDarkMode(savedIsDarkMode);
      } catch (e) {
        // Ignore settings errors
      }
    }
  }, []);

  // Save data
  useEffect(() => {
    if (nodes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
    }
  }, [nodes]);

  // Save settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showCompleted, isDarkMode }));
  }, [showCompleted, isDarkMode]);

  const updateNode = useCallback((id: string, updates: Partial<OutlineNode>) => {
    const updateRecursive = (items: OutlineNode[]): OutlineNode[] => {
      return items.map(node => {
        if (node.id === id) {
          const newUpdates = { ...updates };
          if (updates.text !== undefined) {
            newUpdates.tags = extractTags(updates.text);
          }
          return { ...node, ...newUpdates };
        }
        if (node.children && node.children.length > 0) {
          return { ...node, children: updateRecursive(node.children) };
        }
        return node;
      });
    };
    setNodes(prev => updateRecursive(prev));
  }, []);

  const deleteNode = useCallback((id: string) => {
    const deleteRecursive = (items: OutlineNode[]): OutlineNode[] => {
      return items
        .filter(node => node.id !== id)
        .map(node => ({
          ...node,
          children: node.children ? deleteRecursive(node.children) : []
        }));
    };
    setNodes(prev => deleteRecursive(prev));
  }, []);

  const addNodeAfter = useCallback((targetId: string) => {
    const newNode: OutlineNode = {
      id: generateId(),
      text: '',
      isExpanded: true,
      isCompleted: false,
      children: [],
      tags: []
    };

    const addRecursive = (items: OutlineNode[]): { items: OutlineNode[], found: boolean } => {
      let found = false;
      const newItems: OutlineNode[] = [];

      for (const item of items) {
        newItems.push(item);
        if (item.id === targetId) {
          newItems.push(newNode);
          found = true;
        } else if (item.children && item.children.length > 0) {
          const result = addRecursive(item.children);
          if (result.found) {
            // Replace the last item with an updated version
            newItems[newItems.length - 1] = { ...item, children: result.items };
            found = true;
          }
        }
      }
      return { items: newItems, found };
    };

    setNodes(prev => {
      const result = addRecursive(prev);
      return result.items;
    });
    setFocusedId(newNode.id);
  }, []);

  const indentNode = useCallback((id: string) => {
    const indentRecursive = (items: OutlineNode[]): { items: OutlineNode[], success: boolean } => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === id && i > 0) {
          const nodeToMove = items[i];
          const newItems = items.filter(n => n.id !== id);
          const prevSibling = newItems[i - 1];
          newItems[i - 1] = {
            ...prevSibling,
            children: [...prevSibling.children, nodeToMove],
            isExpanded: true
          };
          return { items: newItems, success: true };
        }
        if (items[i].children && items[i].children.length > 0) {
          const result = indentRecursive(items[i].children);
          if (result.success) {
            const newItems = [...items];
            newItems[i] = { ...items[i], children: result.items };
            return { items: newItems, success: true };
          }
        }
      }
      return { items, success: false };
    };
    setNodes(prev => indentRecursive(prev).items);
  }, []);

  const outdentNode = useCallback((id: string) => {
    const findAndOutdent = (items: OutlineNode[]): { items: OutlineNode[], moved: OutlineNode | null, success: boolean } => {
      for (let i = 0; i < items.length; i++) {
        const childIdx = items[i].children.findIndex(c => c.id === id);
        if (childIdx !== -1) {
          const nodeToMove = items[i].children[childIdx];
          const newChildren = items[i].children.filter(c => c.id !== id);
          const newItems = [...items];
          newItems[i] = { ...items[i], children: newChildren };
          newItems.splice(i + 1, 0, nodeToMove);
          return { items: newItems, moved: nodeToMove, success: true };
        }
        if (items[i].children && items[i].children.length > 0) {
          const result = findAndOutdent(items[i].children);
          if (result.success) {
            const newItems = [...items];
            newItems[i] = { ...items[i], children: result.items };
            return { items: newItems, moved: result.moved, success: true };
          }
        }
      }
      return { items, moved: null, success: false };
    };

    setNodes(prev => findAndOutdent(prev).items);
  }, []);

  const getFilteredTree = useCallback((items: OutlineNode[]): OutlineNode[] => {
    return items.reduce((acc, node) => {
      // If showCompleted is false, we hide completed items unless they have matching children
      const matchesSearch = !searchQuery || node.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => node.tags?.includes(tag));
      const selfMatches = matchesSearch && matchesTags;
      
      const isVisible = showCompleted || !node.isCompleted;

      const filteredChildren = getFilteredTree(node.children);
      const hasMatchingChildren = filteredChildren.length > 0;

      if ((selfMatches && isVisible) || hasMatchingChildren) {
        acc.push({
          ...node,
          children: filteredChildren,
          // Force expansion if it has matching children to show the results
          isExpanded: (searchQuery || selectedTags.length > 0) && hasMatchingChildren ? true : node.isExpanded
        });
      }

      return acc;
    }, [] as OutlineNode[]);
  }, [searchQuery, selectedTags, showCompleted]);

  const filteredNodes = getFilteredTree(nodes);
  const flattenedNodes = flattenTree(filteredNodes);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setOffsetLeft(0);
    const activeNode = flattenedNodes.find(n => n.id === event.active.id);
    if (activeNode) setProjectedDepth(activeNode.depth);
  };

  const handleDragMove = (event: any) => {
    const { active, over, delta } = event;
    setOffsetLeft(delta.x);
    
    if (over) {
      const activeIndex = flattenedNodes.findIndex(n => n.id === active.id);
      const overIndex = flattenedNodes.findIndex(n => n.id === over.id);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        const activeNode = flattenedNodes[activeIndex];
        const indentationWidth = 24;
        const depthDelta = Math.round(delta.x / indentationWidth);
        let newDepth = activeNode.depth + depthDelta;
        
        // Constraints for depth
        let maxDepth = 0;
        if (overIndex === 0) {
          maxDepth = 0;
        } else {
          // The max depth is the depth of the item above it + 1
          const prevNodeIndex = activeIndex < overIndex ? overIndex : overIndex - 1;
          const prevNode = flattenedNodes[prevNodeIndex];
          maxDepth = prevNode ? prevNode.depth + 1 : 0;
        }
        
        newDepth = Math.max(0, Math.min(newDepth, maxDepth));
        setProjectedDepth(newDepth);
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id && projectedDepth !== null) {
      const activeIndex = flattenedNodes.findIndex(n => n.id === active.id);
      const overIndex = over ? flattenedNodes.findIndex(n => n.id === over.id) : activeIndex;
      
      if (activeIndex !== -1 && overIndex !== -1) {
        const activeNode = flattenedNodes[activeIndex];
        const finalDepth = projectedDepth;
        const depthDelta = finalDepth - activeNode.depth;

        // Find all descendants of the active node in the flattened list
        // Descendants are items that follow the active node and have a greater depth
        const descendants: string[] = [];
        for (let i = activeIndex + 1; i < flattenedNodes.length; i++) {
          if (flattenedNodes[i].depth > activeNode.depth) {
            descendants.push(flattenedNodes[i].id);
          } else {
            break;
          }
        }

        const newFlattened = [...flattenedNodes];
        
        // Move item and its descendants in flattened list if position changed
        let moved = newFlattened;
        if (activeIndex !== overIndex) {
          // We need to move the whole block (active node + descendants)
          const blockToMove = moved.splice(activeIndex, 1 + descendants.length);
          const newOverIndex = moved.findIndex(n => n.id === over?.id);
          moved.splice(newOverIndex, 0, ...blockToMove);
        }
        
        // Update depth and parentId for the moved block
        const finalFlattened = moved.map((node) => {
          if (node.id === active.id) {
            const index = moved.findIndex(n => n.id === node.id);
            let parentId: string | null = null;
            for (let i = index - 1; i >= 0; i--) {
              if (moved[i].depth < finalDepth) {
                parentId = moved[i].id;
                break;
              }
            }
            return { ...node, depth: finalDepth, parentId };
          }
          if (descendants.includes(node.id)) {
            return { ...node, depth: node.depth + depthDelta };
          }
          return node;
        });

        setNodes(buildTree(finalFlattened));
      }
    }

    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
    setProjectedDepth(null);
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const activeNode = activeId ? flattenedNodes.find(n => n.id === activeId) : null;

  const getAllTags = useCallback(() => {
    const tags = new Set<string>();
    const collectTags = (items: OutlineNode[]) => {
      items.forEach(node => {
        node.tags?.forEach(tag => tags.add(tag));
        if (node.children.length > 0) collectTags(node.children);
      });
    };
    collectTags(nodes);
    return Array.from(tags).sort();
  }, [nodes]);

  const allTags = getAllTags();

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${isDarkMode ? 'bg-[#151619] text-white' : 'bg-[#F9FAFB] text-gray-900'}`}>
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className={`h-screen sticky top-0 border-r overflow-y-auto ${isDarkMode ? 'bg-[#1a1b1e] border-gray-800' : 'bg-white border-gray-200'}`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Tags</h2>
                <button 
                  onClick={() => setSelectedTags([])}
                  className="text-[10px] text-indigo-500 hover:underline"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-1">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-indigo-600 text-white'
                        : isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag size={14} className={selectedTags.includes(tag) ? 'text-indigo-200' : 'text-gray-400'} />
                      <span>{tag}</span>
                    </div>
                  </button>
                ))}
                {allTags.length === 0 && (
                  <p className="text-xs text-gray-500 italic px-3">No tags found. Use #tag in your items.</p>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={`sticky top-0 z-10 border-b px-6 py-4 flex items-center justify-between backdrop-blur-md ${isDarkMode ? 'bg-[#151619]/80 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
            >
              <Tag size={18} className={showSidebar ? 'text-indigo-500' : 'text-gray-400'} />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Hash size={18} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Lumina Outline</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className={`relative flex items-center rounded-full px-3 py-1.5 transition-all ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <Search size={16} className="text-gray-400 mr-2" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none outline-none text-sm w-40 md:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button 
              onClick={() => setShowCompleted(!showCompleted)}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} ${!showCompleted ? 'text-indigo-500' : 'text-gray-400'}`}
              title={showCompleted ? "Hide Completed" : "Show Completed"}
            >
              {showCompleted ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>

            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-200 text-indigo-600'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <button className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}>
              <Settings size={20} className="text-gray-400" />
            </button>
          </div>
        </header>

        {/* Active Filters Bar */}
        {selectedTags.length > 0 && (
          <div className={`px-6 py-2 border-b flex items-center gap-2 overflow-x-auto ${isDarkMode ? 'bg-[#1a1b1e] border-gray-800' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-2">Filtering:</span>
            {selectedTags.map(tag => (
              <span 
                key={tag} 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium"
              >
                #{tag}
                <button onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-4xl mx-auto w-full px-6 py-12 flex-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToWindowEdges]}
          >
            <SortableContext
              items={flattenedNodes.map(n => n.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 relative">
                {/* Indentation Guides */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i}
                      className={`absolute top-0 bottom-0 border-l transition-opacity duration-300 ${isDarkMode ? 'border-gray-800/40' : 'border-gray-200/60'} ${activeId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      style={{ left: `${(i + 1) * 24 + 10}px` }}
                    />
                  ))}
                </div>

                {filteredNodes.map(node => (
                  <NodeItem 
                    key={node.id} 
                    node={node} 
                    level={0} 
                    isDarkMode={isDarkMode}
                    onUpdate={updateNode}
                    onDelete={deleteNode}
                    onAddAfter={addNodeAfter}
                    onIndent={indentNode}
                    onOutdent={outdentNode}
                    onToggleTag={toggleTag}
                    focusedId={focusedId}
                    setFocusedId={setFocusedId}
                    activeId={activeId}
                    projectedDepth={projectedDepth}
                  />
                ))}
                
                {filteredNodes.length === 0 && (
                  <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                      <FileText className="text-gray-400" size={32} />
                    </div>
                    <p className="text-gray-500">No items found matching your filters.</p>
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedTags([]);
                      }}
                      className="mt-4 px-4 py-2 text-indigo-600 hover:underline text-sm font-medium"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={dropAnimation}>
              {activeId && activeNode ? (
                <div className="relative">
                  {/* Indentation Guide Line */}
                  <div 
                    className="absolute top-0 bottom-0 border-l-2 border-indigo-500/30 -z-10 transition-all duration-200"
                    style={{ left: `${(projectedDepth ?? activeNode.depth) * 24 + 10}px` }}
                  />
                  
                  <div 
                    className={`flex items-start gap-1 py-1 px-2 rounded-md shadow-2xl border transition-all duration-200 ${isDarkMode ? 'bg-gray-800 border-indigo-500 shadow-indigo-500/20' : 'bg-white border-indigo-500 shadow-indigo-500/10'}`}
                    style={{ 
                      marginLeft: `${(projectedDepth ?? activeNode.depth) * 24}px`,
                      width: 'calc(100% - 48px)',
                      transform: 'scale(1.02)',
                    }}
                  >
                  <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-indigo-500/50 rounded-full" />
                  <div className="flex items-center mt-1.5">
                    <div className="p-0.5 opacity-50">
                      <ChevronDown size={14} />
                    </div>
                    <div className="w-4 h-4 flex items-center justify-center text-indigo-500">
                      <GripVertical size={12} />
                    </div>
                  </div>
                  <div className="mt-1.5 mr-1 text-indigo-500">
                    <Circle size={18} />
                  </div>
                  <div className="flex-1 py-1 text-[15px] font-medium">
                    {activeNode.text || "New Item"}
                  </div>
                </div>
              </div>
            ) : null}
            </DragOverlay>
          </DndContext>
        </main>

        {/* Footer / Shortcuts Info */}
        <footer className={`py-2 px-6 text-[10px] uppercase tracking-widest opacity-50 flex justify-center gap-6 ${isDarkMode ? 'bg-[#151619]' : 'bg-[#F9FAFB]'}`}>
          <span>Enter: New Item</span>
          <span>Tab: Indent</span>
          <span>Shift+Tab: Outdent</span>
          <span>Backspace: Delete if empty</span>
        </footer>
      </div>
    </div>
  );
}

interface NodeItemProps {
  key?: string;
  node: OutlineNode;
  level: number;
  isDarkMode: boolean;
  onUpdate: (id: string, updates: Partial<OutlineNode>) => void;
  onDelete: (id: string) => void;
  onAddAfter: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onToggleTag: (tag: string) => void;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  activeId: string | null;
  projectedDepth: number | null;
}

function NodeItem({ 
  node, 
  level, 
  isDarkMode, 
  onUpdate, 
  onDelete, 
  onAddAfter, 
  onIndent, 
  onOutdent,
  onToggleTag,
  focusedId,
  setFocusedId,
  activeId,
  projectedDepth
}: NodeItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 0,
  };

  const currentLevel = isDragging && projectedDepth !== null ? projectedDepth : level;

  useEffect(() => {
    if (focusedId === node.id && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusedId, node.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAddAfter(node.id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent(node.id);
      } else {
        onIndent(node.id);
      }
    } else if (e.key === 'Backspace' && node.text === '') {
      e.preventDefault();
      onDelete(node.id);
    } else if (e.key === 'ArrowUp') {
      // Basic navigation could be added here
    } else if (e.key === 'ArrowDown') {
      // Basic navigation could be added here
    }
  };

  return (
    <div className="group relative" ref={setNodeRef} style={style}>
      {/* Drop Indicator - Show when another item is dragged over this one */}
      {isOver && !isDragging && activeId && (
        <div 
          className="absolute left-0 right-0 h-0.5 bg-indigo-500 z-20 pointer-events-none"
          style={{ 
            top: '-1px',
            marginLeft: `${level * 24}px`
          }}
        />
      )}
      
      <div 
        className={`flex items-start gap-1 py-1 px-2 rounded-md transition-all duration-200 ${focusedId === node.id ? (isDarkMode ? 'bg-gray-800/50 ring-1 ring-indigo-500/30' : 'bg-indigo-50/50 ring-1 ring-indigo-500/30') : 'hover:bg-gray-100/50 dark:hover:bg-gray-800/30'}`}
        style={{ marginLeft: `${currentLevel * 24}px` }}
      >
        <div className="flex items-center mt-1.5">
          <button 
            onClick={() => onUpdate(node.id, { isExpanded: !node.isExpanded })}
            className={`p-0.5 rounded transition-colors ${node.children.length === 0 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            {node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          <div 
            {...attributes} 
            {...listeners}
            className="w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-500"
          >
            <GripVertical size={12} />
          </div>
        </div>

        <button 
          onClick={() => onUpdate(node.id, { isCompleted: !node.isCompleted })}
          className={`mt-1.5 mr-1 transition-colors ${node.isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'}`}
        >
          {node.isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>

        <div className="flex-1 min-w-0" onClick={() => focusedId !== node.id && setFocusedId(node.id)}>
          {focusedId === node.id ? (
            <input
              ref={inputRef}
              type="text"
              value={node.text}
              onChange={(e) => onUpdate(node.id, { text: e.target.value })}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // We don't necessarily want to clear focusedId on blur 
                // because we might be clicking a tag or a button
              }}
              className={`w-full bg-transparent border-none outline-none py-1 text-[15px] leading-relaxed transition-all ${node.isCompleted ? 'line-through opacity-40' : 'opacity-100'}`}
              placeholder="Type something..."
            />
          ) : (
            <div className={`py-1 text-[15px] leading-relaxed cursor-text break-words ${node.isCompleted ? 'line-through opacity-40' : 'opacity-100'}`}>
              {node.text.split(/(#[\w-]+)/g).map((part, i) => 
                part.startsWith('#') ? (
                  <button 
                    key={i} 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTag(part.slice(1));
                    }}
                    className="text-indigo-500 font-medium hover:underline px-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    {part}
                  </button>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
              {node.text === '' && <span className="text-gray-400 italic">Type something...</span>}
            </div>
          )}
          {node.note !== undefined && (
            <textarea
              value={node.note}
              onChange={(e) => onUpdate(node.id, { note: e.target.value })}
              className={`w-full bg-transparent border-none outline-none text-xs opacity-60 resize-none h-auto min-h-[1.5rem] mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
              placeholder="Add a note..."
              rows={1}
            />
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 mt-1 transition-opacity">
          <button 
            onClick={() => onUpdate(node.id, { note: node.note === undefined ? '' : undefined })}
            className={`p-1 rounded transition-colors ${node.note !== undefined ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
            title="Toggle Note"
          >
            <FileText size={14} />
          </button>
          <button 
            onClick={() => onDelete(node.id)}
            className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button className="p-1 text-gray-400 hover:text-indigo-500 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {node.isExpanded && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <NodeItem 
                key={child.id} 
                node={child} 
                level={level + 1} 
                isDarkMode={isDarkMode}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddAfter={onAddAfter}
                onIndent={onIndent}
                onOutdent={onOutdent}
                onToggleTag={onToggleTag}
                focusedId={focusedId}
                setFocusedId={setFocusedId}
                activeId={activeId}
                projectedDepth={projectedDepth}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
