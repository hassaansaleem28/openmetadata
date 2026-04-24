/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { PagingResponse } from 'Models';
import { getBasePath } from '../utils/HistoryUtils';
import { getOidcToken } from '../utils/SwTokenStorageUtils';
import APIClient from './index';

const BASE_URL = '/mcp-client';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface McpConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
}

export type MessageBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface McpMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: MessageBlock[];
  tokenUsage?: TokenUsage;
  createdAt: number;
}

// ── SSE stream event types ────────────────────────────────────────────────────

export interface ContentDeltaEvent {
  type: 'content_delta';
  delta: string;
}

export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface ToolCallResultEvent {
  type: 'tool_call_result';
  toolName: string;
  result: string;
}

export interface MessageCompleteEvent {
  type: 'message_complete';
  message: McpMessage;
  conversationId: string;
}

export interface StreamErrorEvent {
  type: 'error';
  error: string;
}

export type ChatStreamEvent =
  | ContentDeltaEvent
  | ToolCallStartEvent
  | ToolCallResultEvent
  | MessageCompleteEvent
  | StreamErrorEvent;

// ── Request types ─────────────────────────────────────────────────────────────

export interface ChatStreamRequest {
  message: string;
  conversationId?: string;
}

// ── Conversation CRUD ─────────────────────────────────────────────────────────

export const listConversations = async (): Promise<McpConversation[]> => {
  const response = await APIClient.get<PagingResponse<McpConversation[]>>(
    `${BASE_URL}/conversations`
  );

  return response.data.data;
};

export const deleteConversation = async (id: string): Promise<void> => {
  await APIClient.delete(`${BASE_URL}/conversations/${id}`);
};

export const listMessages = async (
  conversationId: string
): Promise<McpMessage[]> => {
  const response = await APIClient.get<PagingResponse<McpMessage[]>>(
    `${BASE_URL}/conversations/${conversationId}/messages`
  );

  return response.data.data;
};

// ── SSE streaming chat ────────────────────────────────────────────────────────
//
// EventSource only supports GET — we need POST to send a body, and the auth
// token cannot be set via EventSource headers. We use fetch with a
// ReadableStream instead.

export async function* streamChat(
  request: ChatStreamRequest
): AsyncGenerator<ChatStreamEvent> {
  const token = await getOidcToken();
  const basePath = getBasePath();

  const response = await fetch(`${basePath}/api/v1${BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue;
        }

        const payload = line.slice(6).trim();

        if (payload === '[DONE]') {
          return;
        }

        yield JSON.parse(payload) as ChatStreamEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
