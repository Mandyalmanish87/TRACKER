import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  parseRouteFromHash,
  resolveNavTabFromLocation,
  getInitialNavTab,
  ACTIVE_TAB_STORAGE_KEY,
  getActiveTabStorageKey,
} from '../src/App';
import {
  ACTIVE_WORKSPACE_STORAGE_KEY,
  getActiveWorkspaceStorageKey,
  getActiveChannelStorageKey,
  getSavedWorkspaceId,
  saveActiveWorkspaceId,
  getSavedChannelId,
  saveActiveChannelId,
  ClassSpaceProvider,
  useClassSpace,
} from '../src/context/ClassSpaceContext';
import { AppProvider, useApp } from '../src/context/AppContext';
import { classSpaceService } from '../src/services/classSpaceService';
import { authService, AuthUser } from '../src/services/authService';
import { Navigation } from '../src/components/common/Navigation';

describe('P0 Bug Regression Suite — Refresh Navigation and Active ClassSpace Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    window.location.pathname = '/';
    authService._setTestUser(null);
  });

  afterEach(() => {
    window.location.hash = '';
    window.location.pathname = '/';
    authService._setTestUser(null);
    localStorage.clear();
  });

  describe('1. Exact Current Route / Tab Persistence Across Refresh', () => {
    it('restores exact non-dashboard tab from URL hash upon page reload', () => {
      const tabs = [
        'attendance',
        'settings',
        'syllabus',
        'planner',
        'tests',
        'focus',
        'gym',
        'nutrition',
        'reminders',
        'eduhub',
        'timetable',
        'classspace',
      ];

      for (const tab of tabs) {
        window.location.hash = `#${tab}`;
        expect(resolveNavTabFromLocation()).toBe(tab);
        expect(getInitialNavTab()).toBe(tab);
      }
    });

    it('parses channel sub-routes from hash (e.g. #classspace/the-commons, #classspace/study-vault)', () => {
      window.location.hash = '#classspace/the-commons';
      const parsed1 = parseRouteFromHash(window.location.hash);
      expect(parsed1.tab).toBe('classspace');
      expect(parsed1.subRoute).toBe('the-commons');
      expect(resolveNavTabFromLocation()).toBe('classspace');

      window.location.hash = '#classspace/study-vault';
      const parsed2 = parseRouteFromHash(window.location.hash);
      expect(parsed2.tab).toBe('classspace');
      expect(parsed2.subRoute).toBe('study-vault');
      expect(resolveNavTabFromLocation()).toBe('classspace');

      window.location.hash = '#classspace/class-pulse';
      const parsed3 = parseRouteFromHash(window.location.hash);
      expect(parsed3.tab).toBe('classspace');
      expect(parsed3.subRoute).toBe('class-pulse');
      expect(resolveNavTabFromLocation()).toBe('classspace');
    });

    it('falls back to persisted localStorage tab when hash is empty', () => {
      window.location.hash = '';
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'attendance');
      expect(getInitialNavTab()).toBe('attendance');

      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'settings');
      expect(getInitialNavTab()).toBe('settings');

      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'classspace');
      expect(getInitialNavTab()).toBe('classspace');
    });

    it('prefers user-scoped active tab when userId is provided', () => {
      window.location.hash = '';
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'attendance');
      localStorage.setItem(getActiveTabStorageKey('usr_student_42'), 'eduhub');

      // Without userId, returns global
      expect(getInitialNavTab()).toBe('attendance');
      // With userId, returns user-scoped
      expect(getInitialNavTab('usr_student_42')).toBe('eduhub');
    });
  });

  describe('2. Active ClassSpace Workspace Persistence Across Refresh', () => {
    it('persists and retrieves active workspace ID per user', () => {
      const wsId = 'ws_cs_101';
      const userId = 'usr_alice';

      saveActiveWorkspaceId(wsId, userId);
      expect(getSavedWorkspaceId(userId)).toBe(wsId);
      expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe(wsId);
      expect(localStorage.getItem(getActiveWorkspaceStorageKey(userId))).toBe(wsId);
    });

    it('gracefully handles clearing active workspace ID on sign out or delete', () => {
      const userId = 'usr_bob';
      saveActiveWorkspaceId('ws_physics', userId);
      expect(getSavedWorkspaceId(userId)).toBe('ws_physics');

      saveActiveWorkspaceId(null, userId);
      expect(getSavedWorkspaceId(userId)).toBeNull();
      expect(localStorage.getItem(getActiveWorkspaceStorageKey(userId))).toBeNull();
    });

    it('restores saved workspace during ClassSpaceContext hydration', async () => {
      const testUser: AuthUser = {
        id: 'usr_charlie',
        email: 'charlie@college.edu',
        name: 'Charlie Student',
      };
      authService._setTestUser(testUser);

      // Create two workspaces for this user in local storage
      const ws1 = await classSpaceService.createWorkspace(testUser, { name: 'Batch A - Algorithms' });
      const ws2 = await classSpaceService.createWorkspace(testUser, { name: 'Batch B - Data Systems' });

      expect(ws1.workspace).toBeDefined();
      expect(ws2.workspace).toBeDefined();

      // Explicitly select ws2 and persist it
      saveActiveWorkspaceId(ws2.workspace!.id, testUser.id);

      // Mount ClassSpaceProvider inside AppProvider
      let contextValue: any = null;
      const Consumer = () => {
        contextValue = useClassSpace();
        const { authUser } = useApp();
        return (
          <div>
            <div>Auth: {authUser?.id || 'null'}</div>
            <div>WsCount: {contextValue.workspaces.length}</div>
            <div>Loaded: {contextValue.activeWorkspace?.name || 'none'}</div>
          </div>
        );
      };

      render(
        <AppProvider>
          <ClassSpaceProvider>
            <Consumer />
          </ClassSpaceProvider>
        </AppProvider>
      );

      // Active workspace must be restored to ws2, NOT ws1 or null
      await waitFor(() => {
        expect(contextValue.activeWorkspace).not.toBeNull();
        expect(contextValue.activeWorkspace.id).toBe(ws2.workspace!.id);
        expect(contextValue.activeWorkspace.name).toBe('Batch B - Data Systems');
      });
    });

    it('falls back gracefully to first available workspace if saved ID is deleted or invalid', async () => {
      const testUser: AuthUser = {
        id: 'usr_dan',
        email: 'dan@college.edu',
        name: 'Dan Student',
      };
      authService._setTestUser(testUser);

      const ws = await classSpaceService.createWorkspace(testUser, { name: 'Batch C - Chemistry' });
      expect(ws.workspace).toBeDefined();

      // Point to a non-existent / deleted workspace ID in storage
      saveActiveWorkspaceId('ws_deleted_or_invalid_id', testUser.id);

      let contextValue: any = null;
      const Consumer = () => {
        contextValue = useClassSpace();
        return <div>Loaded: {contextValue.activeWorkspace?.name || 'none'}</div>;
      };

      render(
        <AppProvider>
          <ClassSpaceProvider>
            <Consumer />
          </ClassSpaceProvider>
        </AppProvider>
      );

      // Must gracefully fall back to ws.workspace without throwing or staying null
      await waitFor(() => {
        expect(contextValue.activeWorkspace).not.toBeNull();
        expect(contextValue.activeWorkspace.id).toBe(ws.workspace!.id);
        expect(contextValue.activeWorkspace.name).toBe('Batch C - Chemistry');
      });
    });
  });

  describe('3. Channel Persistence Across Refresh', () => {
    it('persists and restores channel ID per workspace', () => {
      const wsId = 'ws_cs_101';
      const channelId = 'chan_study_vault';

      saveActiveChannelId(wsId, channelId);
      expect(getSavedChannelId(wsId)).toBe(channelId);
      expect(localStorage.getItem(getActiveChannelStorageKey(wsId))).toBe(channelId);
    });

    it('restores channel from URL hash if present', async () => {
      const testUser: AuthUser = {
        id: 'usr_eva',
        email: 'eva@college.edu',
        name: 'Eva Student',
      };
      authService._setTestUser(testUser);

      const wsRes = await classSpaceService.createWorkspace(testUser, { name: 'Batch D' });
      const wsId = wsRes.workspace!.id;
      saveActiveWorkspaceId(wsId, testUser.id);

      // Simulate URL hash on refresh: #classspace/study-vault
      window.location.hash = '#classspace/study-vault';

      let contextValue: any = null;
      const Consumer = () => {
        contextValue = useClassSpace();
        return <div>Active Channel: {contextValue.activeChannel?.name || 'none'}</div>;
      };

      render(
        <AppProvider>
          <ClassSpaceProvider>
            <Consumer />
          </ClassSpaceProvider>
        </AppProvider>
      );

      await waitFor(() => {
        expect(contextValue.activeChannel).not.toBeNull();
        expect(contextValue.activeChannel.slug).toBe('study-vault');
      });
    });
  });

  describe('4. Navigation Tab Bar Visibility Invariant', () => {
    it('shows ClassSpace in navigation tabs when user has an active workspace even if userMode was initially individual', async () => {
      const testUser: AuthUser = {
        id: 'usr_frank',
        email: 'frank@college.edu',
        name: 'Frank Student',
      };
      authService._setTestUser(testUser);

      const ws = await classSpaceService.createWorkspace(testUser, { name: 'Batch E - Engineering' });
      saveActiveWorkspaceId(ws.workspace!.id, testUser.id);

      const Consumer = () => {
        return <Navigation currentTab="dashboard" onSelectTab={() => {}} />;
      };

      render(
        <AppProvider>
          <ClassSpaceProvider>
            <Consumer />
          </ClassSpaceProvider>
        </AppProvider>
      );

      // ClassSpace must be visible in Navigation
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Classroom Hub/i })).toBeDefined();
      });
    });
  });

  describe('5. Multi-Account / Logout Storage Isolation', () => {
    it('eradicates active workspace and active tab from global keys on signout while preserving user archive', () => {
      const userId = 'usr_grace';
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'classspace');
      localStorage.setItem(getActiveTabStorageKey(userId), 'classspace');
      saveActiveWorkspaceId('ws_grace_ws', userId);

      // Call archiveAndClearLocalData
      classSpaceService.archiveAndClearLocalData(userId);

      // Global keys must be cleared so guest/next user does not inherit Grace's state
      expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)).toBeNull();

      // Grace's user-scoped key remains safely stored in her archive
      expect(localStorage.getItem(getActiveWorkspaceStorageKey(userId))).toBe('ws_grace_ws');
    });

    it('restores user-scoped active workspace and tab on re-login', () => {
      const userId = 'usr_henry';
      localStorage.setItem(`tracker_active_workspace_id_${userId}`, 'ws_henry_math');
      localStorage.setItem(`tracker_active_nav_tab_${userId}`, 'classspace');

      // Call restoreArchivedData
      classSpaceService.restoreArchivedData(userId);

      expect(localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe('ws_henry_math');
      expect(localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)).toBe('classspace');
    });
  });
});
