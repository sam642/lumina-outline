export interface OutlineNode {
  id: string;
  text: string;
  children: OutlineNode[];
  isExpanded: boolean;
  isCompleted: boolean;
  note?: string;
  tags?: string[];
  dueDate?: string;
  createdAt?: number;
  completedAt?: number;
}

export type ViewMode = 'all' | 'active' | 'completed';
export type AppMode = 'selection' | 'edit';
