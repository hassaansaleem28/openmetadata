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

import React, { lazy } from 'react';
import { ReactComponent as AddChatIcon } from '../../assets/svg/add-chat.svg';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import {
  AppPlugin,
  LeftSidebarItemExample,
  PluginRouteProps,
  RoutePosition,
} from '../Settings/Applications/plugins/AppPlugin';

const MCP_CHAT_ROUTE = '/mcp-chat';
const MCP_CHAT_ROUTE_WITH_ID = '/mcp-chat/:conversationId';
const MCP_SIDEBAR_KEY = 'mcp-chat';

const McpChatPage = withSuspenseFallback(
  lazy(() => import('./McpChatPage/McpChatPage.component'))
);

export class McpApplicationPlugin implements AppPlugin {
  readonly name: string;
  readonly isInstalled: boolean;

  constructor(name: string, isInstalled: boolean) {
    this.name = name;
    this.isInstalled = isInstalled;
  }

  getSidebarActions(): LeftSidebarItemExample[] {
    return [
      {
        key: MCP_SIDEBAR_KEY,
        title: 'label.ai-assistant',
        redirect_url: MCP_CHAT_ROUTE,
        icon: AddChatIcon as React.FunctionComponent<
          React.SVGAttributes<SVGElement>
        >,
        dataTestId: 'app-bar-item-mcp-chat',
        index: 1,
      },
    ];
  }

  getRoutes(): PluginRouteProps[] {
    return [
      {
        path: MCP_CHAT_ROUTE,
        element: React.createElement(McpChatPage),
        position: RoutePosition.AUTHENTICATED_ROUTE,
      },
      {
        path: MCP_CHAT_ROUTE_WITH_ID,
        element: React.createElement(McpChatPage),
        position: RoutePosition.AUTHENTICATED_ROUTE,
      },
    ];
  }
}
