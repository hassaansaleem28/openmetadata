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

import { McpMessage, MessageBlock } from '../../../rest/mcpClientAPI';
import ToolCallBlock from './ToolCallBlock.component';

export interface MessageBubbleProps {
  message: McpMessage;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.role === 'user';

  const textContent = message.content
    .filter(
      (b): b is Extract<MessageBlock, { type: 'text' }> => b.type === 'text'
    )
    .map((b) => b.text)
    .join('');

  const toolUseBlocks = message.content.filter(
    (b): b is Extract<MessageBlock, { type: 'tool_use' }> =>
      b.type === 'tool_use'
  );

  const toolResultBlocks = message.content.filter(
    (b): b is Extract<MessageBlock, { type: 'tool_result' }> =>
      b.type === 'tool_result'
  );

  return (
    <div
      className={`tw:mb-4 tw:flex tw:w-full ${
        isUser ? 'tw:justify-end' : 'tw:justify-start'
      }`}>
      <div
        className={`tw:max-w-[75%] tw:rounded-[var(--radius-lg)] tw:px-4 tw:py-3 tw:text-sm tw:shadow-[var(--shadow-xs)] ${
          isUser
            ? 'tw:rounded-br-[var(--radius-none)] tw:bg-[var(--color-bg-brand-solid)] tw:text-white'
            : 'tw:rounded-bl-[var(--radius-none)] tw:bg-[var(--color-bg-secondary)] tw:text-[var(--color-text-primary)]'
        }`}>
        {textContent && (
          <p className="tw:whitespace-pre-wrap tw:leading-relaxed">
            {textContent}
          </p>
        )}
        {toolUseBlocks.map((block) => {
          const resultBlock = toolResultBlocks.find(
            (r) => r.toolUseId === block.id
          );

          return (
            <ToolCallBlock
              input={block.input}
              key={block.id}
              name={block.name}
              result={resultBlock?.content}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MessageBubble;
