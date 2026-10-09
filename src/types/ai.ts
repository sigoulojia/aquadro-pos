export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: AIToolCall[];
  proposal?: AIProposal;
}

export interface AIToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: any;
}

export type ProposalActionType = 'INVENTORY_ADJUSTMENT' | 'PRICE_CHANGE' | 'CREATE_PROMOTION';

export interface AIProposal {
  id: string;
  actionType: ProposalActionType;
  title: string;
  description: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requiresManagerPin: boolean;
  createdAt: string;
}
