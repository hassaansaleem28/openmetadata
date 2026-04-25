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

import React, {
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactComponent as AddChatIcon } from '../../../assets/svg/add-chat.svg';
import {
  deleteConversation,
  listConversations,
  listMessages,
  McpConversation,
  McpMessage,
  streamChat,
  ToolCallStartEvent,
} from '../../../rest/mcpClientAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import MessageBubble from './MessageBubble.component';
import ToolCallBlock from './ToolCallBlock.component';
import TypingIndicator from './TypingIndicator.component';

interface ActiveToolCall {
  name: string;
  input: Record<string, unknown>;
}

interface StreamingState {
  text: string;
  toolCall: ActiveToolCall | null;
}

const McpChatPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversationId: routeConversationId } = useParams<{
    conversationId: string;
  }>();

  const [conversations, setConversations] = useState<McpConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(routeConversationId ?? null);
  const [messages, setMessages] = useState<McpMessage[]>([]);
  const [streaming, setStreaming] = useState<StreamingState>({
    text: '',
    toolCall: null,
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoadingConversations(true);
      const data = await listConversations();
      setConversations(data);
    } catch {
      showErrorToast(t('message.failed-to-fetch-mcp-conversations'));
    } finally {
      setIsLoadingConversations(false);
    }
  }, [t]);

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      try {
        setIsLoadingMessages(true);
        const data = await listMessages(conversationId);
        setMessages(data);
      } catch {
        showErrorToast(t('message.failed-to-fetch-mcp-messages'));
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
      navigate(`/mcp-chat/${activeConversationId}`, { replace: true });
    }
  }, [activeConversationId, fetchMessages, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming.text, scrollToBottom]);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setStreaming({ text: '', toolCall: null });
    navigate('/mcp-chat', { replace: true });
  }, [navigate]);

  const handleDeleteConversation = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      try {
        await deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          handleNewChat();
        }
      } catch {
        showErrorToast(t('message.failed-to-delete-mcp-conversation'));
      }
    },
    [activeConversationId, handleNewChat, t]
  );

  const handleSend = useCallback(async () => {
    const message = inputValue.trim();

    if (!message || isStreaming) {
      return;
    }

    setInputValue('');
    setIsStreaming(true);
    setStreaming({ text: '', toolCall: null });

    const optimisticUserMessage: McpMessage = {
      id: `__optimistic_${Date.now()}__`,
      conversationId: activeConversationId ?? '',
      role: 'user',
      content: [{ type: 'text', text: message }],
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);

    abortRef.current = new AbortController();

    try {
      let resolvedConversationId = activeConversationId;
      let accumulatedText = '';
      let activeToolCall: ActiveToolCall | null = null;
      const toolCallsInThisMessage: Array<{
        name: string;
        input: Record<string, unknown>;
        result?: string;
      }> = [];

      for await (const event of streamChat(
        { message, conversationId: activeConversationId ?? undefined },
        abortRef.current.signal
      )) {
        if (abortRef.current?.signal.aborted) {
          break;
        }

        switch (event.type) {
          case 'content_delta':
            accumulatedText += event.delta;
            setStreaming({ text: accumulatedText, toolCall: null });

            break;

          case 'tool_call_start':
            activeToolCall = {
              name: (event as ToolCallStartEvent).toolName,
              input: (event as ToolCallStartEvent).toolInput,
            };
            toolCallsInThisMessage.push({ ...activeToolCall });
            setStreaming({ text: accumulatedText, toolCall: activeToolCall });

            break;

          case 'tool_call_result':
            if (toolCallsInThisMessage.length > 0) {
              const last =
                toolCallsInThisMessage[toolCallsInThisMessage.length - 1];
              last.result = event.result;
            }
            activeToolCall = null;
            setStreaming((prev) => ({ ...prev, toolCall: null }));

            break;

          case 'message_complete':
            resolvedConversationId = event.conversationId;
            setMessages((prev) => {
              const withoutOptimistic = prev.filter(
                (m) => !m.id.startsWith('__optimistic_')
              );

              return [...withoutOptimistic, event.message];
            });
            setStreaming({ text: '', toolCall: null });
            if (!activeConversationId) {
              setActiveConversationId(resolvedConversationId);
              await fetchConversations();
            }

            break;

          case 'error':
            showErrorToast(event.error);

            break;

          default:
            break;
        }
      }
    } catch {
      showErrorToast(t('message.mcp-stream-error'));
      setMessages((prev) =>
        prev.filter((m) => !m.id.startsWith('__optimistic_'))
      );
    } finally {
      setIsStreaming(false);
      setStreaming({ text: '', toolCall: null });
      abortRef.current = null;
      textareaRef.current?.focus();
    }
  }, [activeConversationId, fetchConversations, inputValue, isStreaming, t]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    },
    []
  );

  const newChatBtnClass =
    'tw:flex tw:w-full tw:items-center tw:justify-center tw:gap-2 ' +
    'tw:rounded-[var(--radius-lg)] tw:border tw:border-[var(--color-border-secondary)] ' +
    'tw:bg-[var(--color-bg-primary)] tw:px-4 tw:py-2.5 ' +
    'tw:text-sm tw:font-medium tw:text-[var(--color-text-primary)] ' +
    'tw:transition-all tw:duration-150 ' +
    'hover:tw:border-[var(--color-border-brand)] hover:tw:text-[var(--color-text-brand)]';

  const convItemBaseClass =
    'tw:group tw:mx-2 tw:my-0.5 tw:flex tw:cursor-pointer tw:items-center ' +
    'tw:justify-between tw:rounded-[var(--radius-md)] tw:px-3 tw:py-2 ' +
    'tw:text-sm tw:transition-colors tw:duration-100';

  const convItemActiveClass =
    'tw:bg-[var(--color-bg-brand-secondary)] tw:text-[var(--color-text-brand)]';

  const convItemInactiveClass =
    'tw:text-[var(--color-text-secondary)] ' +
    'hover:tw:bg-[var(--color-bg-primary)] hover:tw:text-[var(--color-text-primary)]';

  const deleteBtnClass =
    'tw:ml-1 tw:hidden tw:h-5 tw:w-5 tw:flex-shrink-0 ' +
    'tw:items-center tw:justify-center tw:rounded ' +
    'tw:text-[var(--color-text-tertiary)] ' +
    'hover:tw:bg-[var(--color-bg-error-primary)] ' +
    'hover:tw:text-[var(--color-text-error-primary)] group-hover:tw:flex';

  const streamingBubbleClass =
    'tw:max-w-[75%] tw:rounded-[var(--radius-lg)] tw:rounded-bl-[var(--radius-none)] ' +
    'tw:bg-[var(--color-bg-secondary)] tw:px-4 tw:py-3 ' +
    'tw:text-sm tw:text-[var(--color-text-primary)] tw:shadow-[var(--shadow-xs)]';

  const inputWrapperClass =
    'tw:flex tw:items-end tw:gap-3 tw:rounded-[var(--radius-xl)] ' +
    'tw:border tw:border-[var(--color-border-secondary)] ' +
    'tw:bg-[var(--color-bg-primary)] tw:px-4 tw:py-3 ' +
    'tw:transition-all tw:duration-200 ' +
    'focus-within:tw:border-[var(--color-border-brand)] ' +
    'focus-within:tw:shadow-[0_0_0_3px_var(--color-bg-brand-secondary)]';

  const textareaClass =
    'tw:min-h-[24px] tw:max-h-40 tw:flex-1 tw:resize-none tw:border-none ' +
    'tw:bg-transparent tw:text-sm tw:leading-relaxed ' +
    'tw:text-[var(--color-text-primary)] tw:outline-none ' +
    'tw:placeholder:text-[var(--color-text-tertiary)]';

  const sendBtnClass =
    'tw:flex tw:h-8 tw:w-8 tw:flex-shrink-0 tw:items-center tw:justify-center ' +
    'tw:rounded-[var(--radius-md)] tw:bg-[var(--color-bg-brand-solid)] tw:text-white ' +
    'tw:transition-opacity tw:duration-150 hover:tw:opacity-90 ' +
    'disabled:tw:cursor-not-allowed disabled:tw:opacity-40';

  return (
    <div className="tw:flex tw:h-full tw:overflow-hidden tw:bg-[var(--color-bg-primary)]">
      {/* Sidebar */}
      <aside className="tw:flex tw:w-64 tw:flex-shrink-0 tw:flex-col tw:border-r tw:border-[var(--color-border-secondary)] tw:bg-[var(--color-bg-secondary)]">
        <div className="tw:p-4">
          <button
            className={newChatBtnClass}
            data-testid="mcp-new-chat-btn"
            onClick={handleNewChat}>
            <AddChatIcon className="tw:h-4 tw:w-4" />
            {t('label.new-conversation')}
          </button>
        </div>

        <div className="tw:flex-1 tw:overflow-y-auto tw:py-1">
          {isLoadingConversations ? (
            <div className="tw:flex tw:h-20 tw:items-center tw:justify-center">
              <TypingIndicator />
            </div>
          ) : conversations.length === 0 ? (
            <p className="tw:px-4 tw:py-6 tw:text-center tw:text-xs tw:text-[var(--color-text-tertiary)]">
              {t('message.no-mcp-conversations-yet')}
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                className={`${convItemBaseClass} ${
                  activeConversationId === conv.id
                    ? convItemActiveClass
                    : convItemInactiveClass
                }`}
                data-testid={`mcp-conversation-${conv.id}`}
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}>
                <span className="tw:flex-1 tw:truncate">{conv.title}</span>
                <button
                  aria-label={t('label.delete')}
                  className={deleteBtnClass}
                  data-testid={`mcp-delete-conversation-${conv.id}`}
                  onClick={(e) => handleDeleteConversation(e, conv.id)}>
                  <svg
                    className="tw:h-3 tw:w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24">
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <main className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden">
        <div className="tw:flex-1 tw:overflow-y-auto tw:px-6 tw:py-4">
          {isLoadingMessages ? (
            <div className="tw:flex tw:h-full tw:items-center tw:justify-center">
              <TypingIndicator />
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="tw:flex tw:h-full tw:flex-col tw:items-center tw:justify-center tw:gap-4 tw:text-center">
              <div className="tw:flex tw:h-16 tw:w-16 tw:items-center tw:justify-center tw:rounded-full tw:bg-[var(--color-bg-brand-secondary)] tw:shadow-[var(--shadow-sm)]">
                <AddChatIcon className="tw:h-8 tw:w-8 tw:text-[var(--color-text-brand)]" />
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <p className="tw:text-base tw:font-semibold tw:text-[var(--color-text-primary)]">
                  {t('label.ai-assistant')}
                </p>
                <p className="tw:max-w-xs tw:text-sm tw:leading-relaxed tw:text-[var(--color-text-tertiary)]">
                  {t('message.mcp-chat-welcome')}
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {isStreaming && streaming.toolCall && (
                <div className="tw:mb-2 tw:flex tw:justify-start">
                  <div className="tw:max-w-[75%] tw:text-sm">
                    <ToolCallBlock
                      input={streaming.toolCall.input}
                      name={streaming.toolCall.name}
                    />
                  </div>
                </div>
              )}

              {isStreaming && streaming.text && (
                <div className="tw:mb-4 tw:flex tw:justify-start">
                  <div className={streamingBubbleClass}>
                    <p className="tw:whitespace-pre-wrap tw:leading-relaxed">
                      {streaming.text}
                    </p>
                  </div>
                </div>
              )}

              {isStreaming && !streaming.text && !streaming.toolCall && (
                <div className="tw:mb-4 tw:flex tw:justify-start">
                  <div className="tw:rounded-[var(--radius-lg)] tw:rounded-bl-[var(--radius-none)] tw:bg-[var(--color-bg-secondary)] tw:shadow-[var(--shadow-xs)]">
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="tw:px-6 tw:pb-5 tw:pt-3">
          <div className={inputWrapperClass}>
            <textarea
              className={textareaClass}
              data-testid="mcp-chat-input"
              disabled={isStreaming}
              placeholder={t('label.type-mcp-placeholder')}
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button
              className={sendBtnClass}
              data-testid="mcp-send-btn"
              disabled={!inputValue.trim() || isStreaming}
              onClick={handleSend}>
              <svg
                className="tw:h-4 tw:w-4"
                fill="currentColor"
                viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          <p className="tw:mt-2 tw:text-center tw:text-xs tw:text-[var(--color-text-tertiary)]">
            {t('message.mcp-chat-hint')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default McpChatPage;
