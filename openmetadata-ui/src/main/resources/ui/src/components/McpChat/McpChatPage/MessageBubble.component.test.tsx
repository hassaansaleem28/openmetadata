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

import { render, screen } from '@testing-library/react';
import { McpMessage } from '../../../rest/mcpClientAPI';
import MessageBubble from './MessageBubble.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./ToolCallBlock.component', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => (
    <div data-testid="tool-call-block">{name}</div>
  ),
}));

const userMessage: McpMessage = {
  content: [{ text: 'Hello there', type: 'text' }],
  conversationId: 'conv-1',
  createdAt: Date.now(),
  id: 'msg-1',
  role: 'user',
};

const assistantMessage: McpMessage = {
  content: [{ text: 'How can I help?', type: 'text' }],
  conversationId: 'conv-1',
  createdAt: Date.now(),
  id: 'msg-2',
  role: 'assistant',
};

describe('MessageBubble', () => {
  it('renders the text content of a user message', () => {
    render(<MessageBubble message={userMessage} />);

    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders the text content of an assistant message', () => {
    render(<MessageBubble message={assistantMessage} />);

    expect(screen.getByText('How can I help?')).toBeInTheDocument();
  });

  it('concatenates multiple text blocks into a single paragraph', () => {
    const multiBlock: McpMessage = {
      ...assistantMessage,
      content: [
        { text: 'Part one. ', type: 'text' },
        { text: 'Part two.', type: 'text' },
      ],
    };

    render(<MessageBubble message={multiBlock} />);

    expect(screen.getByText('Part one. Part two.')).toBeInTheDocument();
  });

  it('renders a ToolCallBlock for each tool_use content block', () => {
    const messageWithTool: McpMessage = {
      ...assistantMessage,
      content: [
        {
          id: 'tool-1',
          input: { query: 'orders' },
          name: 'search_tables',
          type: 'tool_use',
        },
      ],
    };

    render(<MessageBubble message={messageWithTool} />);

    expect(screen.getByTestId('tool-call-block')).toBeInTheDocument();
    expect(screen.getByText('search_tables')).toBeInTheDocument();
  });

  it('renders both text and tool call blocks when both are present', () => {
    const mixed: McpMessage = {
      ...assistantMessage,
      content: [
        { text: 'Running a search...', type: 'text' },
        {
          id: 'tool-1',
          input: {},
          name: 'search_tables',
          type: 'tool_use',
        },
      ],
    };

    render(<MessageBubble message={mixed} />);

    expect(screen.getByText('Running a search...')).toBeInTheDocument();
    expect(screen.getByTestId('tool-call-block')).toBeInTheDocument();
  });

  it('renders nothing for a message with no text and no tool blocks', () => {
    const empty: McpMessage = {
      ...assistantMessage,
      content: [
        { content: 'raw result', toolUseId: 'tool-1', type: 'tool_result' },
      ],
    };

    render(<MessageBubble message={empty} />);

    expect(screen.queryByTestId('tool-call-block')).not.toBeInTheDocument();
  });
});
