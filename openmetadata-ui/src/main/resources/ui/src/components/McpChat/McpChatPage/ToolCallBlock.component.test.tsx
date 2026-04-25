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
import ToolCallBlock from './ToolCallBlock.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ToolCallBlock', () => {
  const defaultProps = {
    input: { query: 'orders', limit: 10 },
    name: 'search_tables',
  };

  it('renders the tool name in the summary', () => {
    render(<ToolCallBlock {...defaultProps} />);

    expect(screen.getByText('search_tables')).toBeInTheDocument();
  });

  it('renders the input as pretty-printed JSON inside a pre element', () => {
    const { container } = render(<ToolCallBlock {...defaultProps} />);
    const pre = container.querySelector('pre');

    expect(pre?.textContent).toContain('"query"');
    expect(pre?.textContent).toContain('"orders"');
    expect(pre?.textContent).toContain('"limit"');
  });

  it('does not render the result section when result is undefined', () => {
    render(<ToolCallBlock {...defaultProps} />);

    expect(screen.queryByText('label.tool-result')).not.toBeInTheDocument();
  });

  it('renders the result section when result is provided', () => {
    render(<ToolCallBlock {...defaultProps} result="found 3 tables" />);

    expect(screen.getByText('label.tool-result')).toBeInTheDocument();
    expect(screen.getByText('found 3 tables')).toBeInTheDocument();
  });

  it('renders label.input heading', () => {
    render(<ToolCallBlock {...defaultProps} />);

    expect(screen.getByText('label.input')).toBeInTheDocument();
  });
});
