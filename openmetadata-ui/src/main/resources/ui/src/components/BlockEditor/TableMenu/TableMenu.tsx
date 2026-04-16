/*
 *  Copyright 2023 Collate.
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
import { Editor } from '@tiptap/react';
import { Button, Space, Tooltip } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import tippy, { Instance } from 'tippy.js';
import { ReactComponent as IconDeleteTable } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconAddColumnAfter } from '../../../assets/svg/ic-format-add-column-after.svg';
import { ReactComponent as IconAddRowAfter } from '../../../assets/svg/ic-format-add-row-after.svg';
import { ReactComponent as IconDeleteColumn } from '../../../assets/svg/ic-format-delete-column.svg';
import { ReactComponent as IconDeleteRow } from '../../../assets/svg/ic-format-delete-row.svg';

interface TableMenuProps {
  editor: Editor;
}

const TABLE_WRAPPER_SELECTOR = '.tableWrapper';
const TABLE_CELL_SELECTOR = 'td, th';
const SELECTED_TABLE_CELL_SELECTOR = 'td.selectedCell, th.selectedCell';

const buildRect = (
  top: number,
  left: number,
  right: number,
  bottom: number
): DOMRect => {
  return {
    x: left,
    y: top,
    top,
    left,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({
      x: left,
      y: top,
      top,
      left,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    }),
  } as DOMRect;
};

const getSelectedCellsRect = (tableWrapper: Element): DOMRect | null => {
  const selectedCells = tableWrapper.querySelectorAll<HTMLElement>(
    SELECTED_TABLE_CELL_SELECTOR
  );

  if (!selectedCells.length) {
    return null;
  }

  let top = Number.POSITIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  selectedCells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();

    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  });

  return buildRect(top, left, right, bottom);
};

const getReferenceRect = (target: Element): DOMRect => {
  const cell = target.closest<HTMLElement>(TABLE_CELL_SELECTOR);

  if (cell) {
    return cell.getBoundingClientRect();
  }

  const tableWrapper = target.closest<HTMLElement>(TABLE_WRAPPER_SELECTOR);

  if (!tableWrapper) {
    return target.getBoundingClientRect();
  }

  return (
    getSelectedCellsRect(tableWrapper) ?? tableWrapper.getBoundingClientRect()
  );
};

const TableMenu = (props: TableMenuProps) => {
  const { editor } = props;
  const { view, isEditable } = editor;
  const menuRef = useRef<HTMLDivElement>(null);
  const tableMenuPopup = useRef<Instance | null>(null);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    const { target } = event;

    if (!(target instanceof Element)) {
      return;
    }

    const table = target.closest(TABLE_WRAPPER_SELECTOR);

    if (!table) {
      return;
    }

    const referenceElement =
      target.closest<HTMLElement>(TABLE_CELL_SELECTOR) ??
      target.closest<HTMLElement>(TABLE_WRAPPER_SELECTOR) ??
      target;

    tableMenuPopup.current?.setProps({
      getReferenceClientRect: () => getReferenceRect(referenceElement),
    });

    tableMenuPopup.current?.show();
  }, []);

  useEffect(() => {
    if (menuRef.current && isEditable) {
      menuRef.current.remove();
      menuRef.current.style.visibility = 'visible';

      tableMenuPopup.current = tippy(view.dom, {
        getReferenceClientRect: null,
        content: menuRef.current,
        appendTo: 'parent',
        trigger: 'manual',
        interactive: true,
        arrow: false,
        placement: 'top',
        hideOnClick: true,
        onShown: () => {
          menuRef.current?.focus();
        },
      });
    }

    return () => {
      tableMenuPopup.current?.destroy();
      tableMenuPopup.current = null;
    };
  }, [isEditable]);

  useEffect(() => {
    if (!isEditable) {
      return;
    }

    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseDown, isEditable]);

  return (
    <div className="table-menu" ref={menuRef}>
      <Space size="middle">
        <Tooltip showArrow={false} title="Add row after current row">
          <Button
            data-testid="Add row after current row"
            type="text"
            onClick={() => editor.chain().focus().addRowAfter().run()}>
            <IconAddRowAfter style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Add column after current column">
          <Button
            data-testid="Add column after current column"
            type="text"
            onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <IconAddColumnAfter style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Delete current row">
          <Button
            data-testid="Delete current row"
            type="text"
            onClick={() => editor.chain().focus().deleteRow().run()}>
            <IconDeleteRow style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Delete current column">
          <Button
            data-testid="Delete current col"
            type="text"
            onClick={() => editor.chain().focus().deleteColumn().run()}>
            <IconDeleteColumn style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Delete table">
          <Button
            data-testid="Delete table"
            type="text"
            onClick={() => {
              editor.chain().focus().deleteTable().run();
              tableMenuPopup.current?.hide();
            }}>
            <IconDeleteTable style={{ verticalAlign: 'middle' }} width={14} />
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

export default TableMenu;
