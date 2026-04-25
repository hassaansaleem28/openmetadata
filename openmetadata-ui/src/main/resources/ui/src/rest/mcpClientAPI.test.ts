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

import { ChatStreamEvent, streamChat } from './mcpClientAPI';

jest.mock('../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn().mockResolvedValue('test-token'),
}));

jest.mock('../utils/HistoryUtils', () => ({
  getBasePath: jest.fn().mockReturnValue(''),
}));

// jsdom does not implement ReadableStream, so we mock the reader interface directly.
function makeSseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const chunks = lines.map((line) => encoder.encode(`${line}\n`));
  let index = 0;

  const reader = {
    read: jest.fn().mockImplementation(() => {
      if (index < chunks.length) {
        return Promise.resolve({ done: false, value: chunks[index++] });
      }

      return Promise.resolve({ done: true, value: undefined });
    }),
    releaseLock: jest.fn(),
  };

  return {
    body: { getReader: () => reader },
    ok: true,
    status: 200,
  } as unknown as Response;
}

async function collect(
  gen: AsyncGenerator<ChatStreamEvent>
): Promise<ChatStreamEvent[]> {
  const results: ChatStreamEvent[] = [];
  for await (const item of gen) {
    results.push(item);
  }

  return results;
}

describe('streamChat', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('yields a content_delta event parsed from SSE data', async () => {
    const event: ChatStreamEvent = { type: 'content_delta', delta: 'Hello' };
    (global.fetch as jest.Mock).mockResolvedValue(
      makeSseResponse([`data: ${JSON.stringify(event)}`, 'data: [DONE]'])
    );

    const events = await collect(streamChat({ message: 'hi' }));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it('stops yielding after the [DONE] sentinel', async () => {
    const first: ChatStreamEvent = { type: 'content_delta', delta: 'first' };
    const ignored: ChatStreamEvent = {
      type: 'content_delta',
      delta: 'ignored',
    };
    (global.fetch as jest.Mock).mockResolvedValue(
      makeSseResponse([
        `data: ${JSON.stringify(first)}`,
        'data: [DONE]',
        `data: ${JSON.stringify(ignored)}`,
      ])
    );

    const events = await collect(streamChat({ message: 'hi' }));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(first);
  });

  it('skips malformed JSON payloads without throwing', async () => {
    const good: ChatStreamEvent = { type: 'content_delta', delta: 'good' };
    (global.fetch as jest.Mock).mockResolvedValue(
      makeSseResponse([
        'data: {not valid json',
        `data: ${JSON.stringify(good)}`,
        'data: [DONE]',
      ])
    );

    const events = await collect(streamChat({ message: 'hi' }));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(good);
  });

  it('handles data: without space after colon per SSE spec', async () => {
    const event: ChatStreamEvent = {
      type: 'content_delta',
      delta: 'no-space',
    };
    (global.fetch as jest.Mock).mockResolvedValue(
      makeSseResponse([`data:${JSON.stringify(event)}`, 'data: [DONE]'])
    );

    const events = await collect(streamChat({ message: 'hi' }));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it('ignores non-data SSE lines (event:, id:, comments)', async () => {
    const event: ChatStreamEvent = { type: 'content_delta', delta: 'real' };
    (global.fetch as jest.Mock).mockResolvedValue(
      makeSseResponse([
        'event: message',
        'id: 42',
        ': heartbeat comment',
        `data: ${JSON.stringify(event)}`,
        '',
        'data: [DONE]',
      ])
    );

    const events = await collect(streamChat({ message: 'hi' }));

    expect(events).toHaveLength(1);
  });

  it('passes the abort signal through to fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      makeSseResponse(['data: [DONE]'])
    );
    const controller = new AbortController();

    await collect(streamChat({ message: 'hi' }, controller.signal));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('throws when the server responds with a non-ok status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      body: null,
      ok: false,
      status: 500,
    } as unknown as Response);

    await expect(collect(streamChat({ message: 'hi' }))).rejects.toThrow(
      'Stream request failed with status 500'
    );
  });

  it('yields multiple events in order before [DONE]', async () => {
    const e1: ChatStreamEvent = { type: 'content_delta', delta: 'A' };
    const e2: ChatStreamEvent = { type: 'content_delta', delta: 'B' };
    const e3: ChatStreamEvent = { type: 'content_delta', delta: 'C' };
    (global.fetch as jest.Mock).mockResolvedValue(
      makeSseResponse([
        `data: ${JSON.stringify(e1)}`,
        `data: ${JSON.stringify(e2)}`,
        `data: ${JSON.stringify(e3)}`,
        'data: [DONE]',
      ])
    );

    const events = await collect(streamChat({ message: 'hi' }));

    expect(events).toEqual([e1, e2, e3]);
  });
});
