export interface OutlineNode {
  id: string;
  text: string;
  children: OutlineNode[];
  isExpanded: boolean;
  isCompleted: boolean;
  note?: string;
  tags?: string[];
}

export type ViewMode = 'all' | 'active' | 'completed';
