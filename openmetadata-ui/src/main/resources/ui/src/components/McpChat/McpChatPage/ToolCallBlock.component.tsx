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

import { useTranslation } from 'react-i18next';

export interface ToolCallBlockProps {
  name: string;
  input: Record<string, unknown>;
  result?: string;
}

const ToolCallBlock = ({ input, name, result }: ToolCallBlockProps) => {
  const { t } = useTranslation();

  const summaryClass =
    'tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:gap-1.5 ' +
    'tw:bg-[var(--color-bg-secondary)] tw:px-3 tw:py-2 ' +
    'tw:text-[var(--color-text-secondary)] hover:tw:bg-[var(--color-bg-primary)]';

  return (
    <details className="tw:mt-2 tw:overflow-hidden tw:rounded-[var(--radius-md)] tw:border tw:border-[var(--color-border-primary)] tw:text-xs">
      <summary className={summaryClass}>
        <span className="tw:font-semibold tw:text-[var(--color-text-primary)]">
          {t('label.tool-call')}:
        </span>
        <code className="tw:font-mono">{name}</code>
      </summary>
      <div className="tw:space-y-2 tw:bg-[var(--color-bg-primary)] tw:px-3 tw:py-2">
        <div>
          <p className="tw:mb-1 tw:font-semibold tw:text-[var(--color-text-secondary)]">
            {t('label.input')}
          </p>
          <pre className="tw:break-all tw:whitespace-pre-wrap tw:font-mono tw:text-[var(--color-text-primary)]">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
        {result !== undefined && (
          <div>
            <p className="tw:mb-1 tw:font-semibold tw:text-[var(--color-text-secondary)]">
              {t('label.tool-result')}
            </p>
            <pre className="tw:break-all tw:whitespace-pre-wrap tw:font-mono tw:text-[var(--color-text-primary)]">
              {result}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
};

export default ToolCallBlock;
