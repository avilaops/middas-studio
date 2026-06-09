export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
  response_format?: { type: 'text' | 'json_object' };
  tools?: any[];
  tool_choice?: any;
  seed?: number;
};

export type ApiLog = {
  module: string;
  endpoint: string;
  model?: string;
  request?: any;
  response?: any;
  status_code?: number;
  duration_ms?: number;
  error?: string;
};
