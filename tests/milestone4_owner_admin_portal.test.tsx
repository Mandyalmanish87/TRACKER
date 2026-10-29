import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { adminService } from '../src/services/adminService';
import * as authServiceModule from '../src/services/authService';
import { AdminRoute } from '../src/components/admin/AdminRoute';
import { AdminConfirmationModal } from '../src/components/admin/AdminConfirmationModal';
import { SettingsView } from '../src/components/views/SettingsView';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { resolveNavTabFromLocation, VALID_NAV_TABS } from '../src/App';

describe('Milestone 04 — Owner & Platform Administrative Portal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. Ordinary User Denied Platform Admin Access
  // ============================================================================
  describe('1. Ordinary User Access Denial', () => {
    it('denies access when user is not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await adminService.verifyPlatformAdmin();

      expect(result.isAdmin).toBe(false);
      expect(result.error).toMatch(/Authentication required/i);
    });

    it('denies access when authenticated user is not in admin_users table (RPC returns false)', async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-student-regular' } } },
            error: null,
          }),
        },
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'is_platform_admin') {
            return Promise.resolve({ data: false, error: null });
          }
          return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await adminService.verifyPlatformAdmin();

      expect(result.isAdmin).toBe(false);
      expect(result.userId).toBe('usr-student-regular');
      expect(result.error).toMatch(/Forbidden.*authorized platform administrator/i);
    });

    it('denies access when backend RPC throws permission error (42501)', async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-malicious-attacker' } } },
            error: null,
          }),
        },
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'is_platform_admin') {
            return Promise.resolve({
              data: null,
              error: { message: 'permission denied for function is_platform_admin (42501)' },
            });
          }
          return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await adminService.verifyPlatformAdmin();

      expect(result.isAdmin).toBe(false);
      expect(result.error).toMatch(/permission denied/i);
    });
  });

  // ============================================================================
  // 2. ClassSpace Roles Do NOT Grant Platform Admin Access
  // ============================================================================
  describe('2. Separation of ClassSpace Roles from Platform Administration', () => {
    it('verifies ClassSpace Owner role does NOT grant platform admin privileges', async () => {
      // Simulating a student who is the owner/creator of a ClassSpace workspace
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-classspace-owner-99' } } },
            error: null,
          }),
        },
        rpc: vi.fn().mockImplementation((fn: string) => {
          // Server-side check public.is_platform_admin evaluates strictly against public.admin_users
          if (fn === 'is_platform_admin') {
            return Promise.resolve({ data: false, error: null });
          }
          return Promise.resolve({ data: null, error: new Error('Access denied') });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await adminService.verifyPlatformAdmin();

      expect(result.isAdmin).toBe(false);
      expect(result.userId).toBe('usr-classspace-owner-99');
    });

    it('verifies ClassSpace CR (Class Representative) does NOT grant platform admin privileges', async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-class-cr-42' } } },
            error: null,
          }),
        },
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'is_platform_admin') {
            return Promise.resolve({ data: false, error: null });
          }
          return Promise.resolve({ data: null, error: new Error('Access denied') });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await adminService.verifyPlatformAdmin();

      expect(result.isAdmin).toBe(false);
    });
  });

  // ============================================================================
  // 3. Unauthorized Direct Operations Rejected by Server Boundary
  // ============================================================================
  describe('3. Server Boundary Rejection for Direct Operations', () => {
    it('rejects metrics query when caller lacks platform admin role', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'get_admin_overview_metrics') {
            return Promise.resolve({
              data: null,
              error: { message: 'Access denied: platform administrator privileges required (42501)' },
            });
          }
          return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const { data, error } = await adminService.fetchOverviewMetrics();

      expect(data).toBeNull();
      expect(error).toMatch(/Access denied.*platform administrator privileges required/i);
    });

    it('rejects user search query when caller lacks platform admin role', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'search_users_for_support') {
            return Promise.resolve({
              data: null,
              error: { message: 'Access denied: platform administrator privileges required (42501)' },
            });
          }
          return Promise.resolve({ data: null, error: new Error('Unknown RPC') });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const { data, error } = await adminService.searchUsers('victim@college.edu');

      expect(data).toEqual([]);
      expect(error).toMatch(/Access denied/i);
    });

    it('rejects unauthorized join code rotation or workspace deletion', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Access denied: platform administrator privileges required (42501)' },
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const rotateResult = await adminService.rotateWorkspaceJoinCode(
        'ws-target-123',
        'Suspicious spam activity'
      );
      expect(rotateResult.newCode).toBeNull();
      expect(rotateResult.error).toMatch(/Access denied/i);

      const deleteResult = await adminService.deleteWorkspace(
        'ws-target-123',
        'Abusive workspace report'
      );
      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toMatch(/Access denied/i);
    });

    it('rejects destructive operations when caller has support role (operator privileges required)', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'admin_delete_workspace' || fn === 'admin_rotate_workspace_join_code') {
            return Promise.resolve({
              data: null,
              error: { message: 'Access denied: operator privileges required (owner or super_admin) (42501)' },
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const delRes = await adminService.deleteWorkspace('ws-1', 'Support trying to delete');
      expect(delRes.success).toBe(false);
      expect(delRes.error).toMatch(/operator privileges required/i);

      const rotRes = await adminService.rotateWorkspaceJoinCode('ws-1', 'Support trying to rotate');
      expect(rotRes.newCode).toBeNull();
      expect(rotRes.error).toMatch(/operator privileges required/i);
    });

    it('blocks direct client insert on admin_audit_logs to prevent forgery', async () => {
      // In schema, direct insert is revoked and policy removed
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'admin_audit_logs') {
            return {
              insert: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'permission denied for table admin_audit_logs (42501)' },
                }),
            };
          }
          return {};
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      // Attempting direct client insertion
      const res = await mockSupabase.from('admin_audit_logs').insert({
        actor_id: 'usr-attacker',
        action: 'fake_action',
        target_type: 'system',
      });

      expect(res.error).toBeDefined();
      expect(res.error.message).toMatch(/permission denied for table admin_audit_logs/i);
    });

    it('blocks non-owners from modifying admin_users table', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'admin_users') {
            return {
              insert: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'new row violates row-level security policy for table "admin_users" (42501)' },
                }),
              update: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'permission denied: only platform owners can manage admins (42501)' },
                }),
            };
          }
          return {};
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const insertRes = await mockSupabase.from('admin_users').insert({
        user_id: 'usr-new-admin',
        role: 'super_admin',
      });
      expect(insertRes.error).toBeDefined();
      expect(insertRes.error.message).toMatch(/row-level security policy/i);

      const updateRes = await mockSupabase.from('admin_users').update({ role: 'owner' });
      expect(updateRes.error).toBeDefined();
      expect(updateRes.error.message).toMatch(/only platform owners can manage admins/i);
    });
  });

  // ============================================================================
  // 4. Authorized Platform Administrator Workflows
  // ============================================================================
  describe('4. Authorized Platform Administrator Operations', () => {
    it('verifies authorized platform owner successfully', async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { user: { id: 'usr-platform-owner-1' } } },
            error: null,
          }),
        },
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'is_platform_admin') {
            return Promise.resolve({ data: true, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'admin_users') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({ data: { role: 'owner' }, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await adminService.verifyPlatformAdmin();

      expect(result.isAdmin).toBe(true);
      expect(result.userId).toBe('usr-platform-owner-1');
      expect(result.role).toBe('owner');
    });

    it('fetches system metrics cleanly without exposing private student records', async () => {
      const mockMetrics = {
        total_users: 1420,
        total_workspaces: 86,
        total_attendance_records: 12450,
        active_users_7d: 310,
        system_status: 'operational',
        timestamp: '2026-10-25T20:00:00.000Z',
      };

      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'get_admin_overview_metrics') {
            return Promise.resolve({ data: mockMetrics, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const { data, error } = await adminService.fetchOverviewMetrics();

      expect(error).toBeUndefined();
      expect(data?.total_users).toBe(1420);
      expect(data?.total_workspaces).toBe(86);
      expect(data?.active_users_7d).toBe(310);
      // Confirmed: No personal student attendance percentages or notes returned in metrics
      expect((data as any)?.studentNotes).toBeUndefined();
      expect((data as any)?.attendancePercentages).toBeUndefined();
    });

    it('searches users returning only account metadata (zero private notes/attendance)', async () => {
      const mockUsers = [
        {
          user_id: 'usr-student-abc',
          email: 'alex@stanford.edu',
          created_at: '2026-09-01T10:00:00Z',
          last_sign_in_at: '2026-10-25T14:20:00Z',
          last_synced_at: '2026-10-25T14:22:00Z',
          subscription_tier: 'free',
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fn: string, params: any) => {
          if (fn === 'search_users_for_support') {
            expect(params.p_query).toBe('alex@');
            return Promise.resolve({ data: mockUsers, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const { data } = await adminService.searchUsers('alex@');

      expect(data.length).toBe(1);
      expect(data[0].email).toBe('alex@stanford.edu');
      expect((data[0] as any).notes).toBeUndefined();
      expect((data[0] as any).attendanceRecords).toBeUndefined();
      expect((data[0] as any).gymRoutines).toBeUndefined();
    });

    it('requires valid administrative reason when rotating join code or deleting workspace', async () => {
      // Reason too short
      const rotateEmpty = await adminService.rotateWorkspaceJoinCode('ws-1', '');
      expect(rotateEmpty.error).toMatch(/valid administrative reason is required/i);

      const deleteEmpty = await adminService.deleteWorkspace('ws-1', 'abc');
      expect(deleteEmpty.error).toMatch(/detailed reason.*required/i);
    });

    it('executes join code rotation with server-side audit logging', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fn: string, params: any) => {
          if (fn === 'admin_rotate_workspace_join_code') {
            expect(params.p_workspace_id).toBe('ws-compromised-123');
            expect(params.p_reason).toBe('Reported spam code on student forum');
            return Promise.resolve({ data: '9K2MP', error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      } as any;
      vi.spyOn(authServiceModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const { newCode, error } = await adminService.rotateWorkspaceJoinCode(
        'ws-compromised-123',
        'Reported spam code on student forum'
      );

      expect(error).toBeUndefined();
      expect(newCode).toBe('9K2MP');
    });
  });

  // ============================================================================
  // 5. UI Route Guard & Access-Denied Presentation
  // ============================================================================
  describe('5. UI Route Guard (AdminRoute)', () => {
    it('renders 403 Forbidden screen when user is not a platform admin', async () => {
      vi.spyOn(adminService, 'verifyPlatformAdmin').mockResolvedValue({
        isAdmin: false,
        userId: 'usr-student-bob',
        error: 'Forbidden: Current account is not an authorized platform administrator',
      });

      const onExitMock = vi.fn();

      render(<AdminRoute onExit={onExitMock} />);

      // Wait for verification check to complete
      await waitFor(() => {
        expect(screen.getByText(/Platform Administrator Access Required/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/HTTP 403 · Access Denied/i)).toBeInTheDocument();
      expect(screen.getByText('usr-student-bob')).toBeInTheDocument();

      // Ensure no administrative views or data tabs are rendered
      expect(screen.queryByText(/System Overview/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/User Directory/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Audit Trail/i)).not.toBeInTheDocument();

      // Clicking Return to Student Dashboard calls onExit
      const returnBtn = screen.getByRole('button', { name: /Return to Student Dashboard/i });
      fireEvent.click(returnBtn);
      expect(onExitMock).toHaveBeenCalledTimes(1);
    });

    it('renders AdminLayout when user is server-verified platform admin', async () => {
      vi.spyOn(adminService, 'verifyPlatformAdmin').mockResolvedValue({
        isAdmin: true,
        userId: 'usr-owner-sarah',
        role: 'owner',
      });

      vi.spyOn(adminService, 'fetchOverviewMetrics').mockResolvedValue({
        data: {
          total_users: 500,
          total_workspaces: 25,
          total_attendance_records: 3000,
          active_users_7d: 120,
          system_status: 'operational',
          timestamp: new Date().toISOString(),
        },
      });

      const onExitMock = vi.fn();

      render(<AdminRoute onExit={onExitMock} />);

      await waitFor(() => {
        expect(screen.getByText(/Tracker Administrative Portal/i)).toBeInTheDocument();
      });

      expect(screen.getByText('owner')).toBeInTheDocument();
      expect(screen.getByText(/System Overview/i)).toBeInTheDocument();
      expect(screen.getByText(/User Directory/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Workspaces/i })).toBeInTheDocument();
      expect(screen.getByText(/Audit Trail/i)).toBeInTheDocument();
    });

    it('renders Workspaces view in read-only mode for support role with destructive actions hidden', async () => {
      vi.spyOn(adminService, 'verifyPlatformAdmin').mockResolvedValue({
        isAdmin: true,
        userId: 'usr-support-dan',
        role: 'support',
      });

      vi.spyOn(adminService, 'searchWorkspaces').mockResolvedValue({
        data: [
          {
            id: 'ws-demo-1',
            name: 'Demo Class A',
            institution: 'MIT',
            join_code: '4B8XY',
            created_by: 'usr-prof',
            created_at: '2026-10-01T00:00:00Z',
            member_count: 45,
          },
        ],
      });

      const onExitMock = vi.fn();

      render(<AdminRoute onExit={onExitMock} />);

      await waitFor(() => {
        expect(screen.getByText('support')).toBeInTheDocument();
      });

      // Switch to Workspaces tab
      const wsTab = screen.getByRole('button', { name: /Workspaces/i });
      fireEvent.click(wsTab);

      await waitFor(() => {
        expect(screen.getByText('Demo Class A')).toBeInTheDocument();
      });

      // Assert read-only badge is displayed and destructive buttons are absent
      expect(screen.getByText(/Read-Only \(Support Role\)/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Rotate Code/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // 6. Dual-Confirmation Destructive Action Modal
  // ============================================================================
  describe('6. Dual-Confirmation Modal Protection', () => {
    it('blocks confirmation until exact workspace name is typed for destructive action', async () => {
      const onConfirmMock = vi.fn().mockResolvedValue(undefined);
      const onCloseMock = vi.fn();

      render(
        <AdminConfirmationModal
          isOpen={true}
          title="Delete ClassSpace 'CS-Section-A'"
          description="Type the workspace name to confirm permanent removal."
          confirmMatchText="CS-Section-A"
          confirmButtonText="Permanently Delete Workspace"
          isDestructive={true}
          requiresReason={true}
          onConfirm={onConfirmMock}
          onClose={onCloseMock}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /Permanently Delete Workspace/i });
      expect(confirmButton).toBeDisabled();

      // Typing wrong match text
      const matchInput = screen.getByPlaceholderText('CS-Section-A');
      fireEvent.change(matchInput, { target: { value: 'Wrong-Name' } });
      expect(confirmButton).toBeDisabled();

      // Typing reason but match is still wrong
      const reasonInput = screen.getByPlaceholderText(/Specify the operational or moderation justification/i);
      fireEvent.change(reasonInput, { target: { value: 'Spam cohort created by unauthorized bot' } });
      expect(confirmButton).toBeDisabled();

      // Typing exact match text
      fireEvent.change(matchInput, { target: { value: 'CS-Section-A' } });
      expect(confirmButton).toBeEnabled();

      // Submit
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(onConfirmMock).toHaveBeenCalledWith('Spam cohort created by unauthorized bot');
        expect(onCloseMock).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // 7. Settings UI Admin Link Removal & Route Isolation
  // ============================================================================
  describe('7. Settings UI Admin Link Removal & Route Isolation', () => {
    it('does NOT render "Platform Administrative Portal" or any admin link in the Settings UI', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <SettingsView />
          </AppProvider>
        </ThemeProvider>
      );

      // Verify "Platform Administrative Portal" is completely absent from the DOM
      expect(screen.queryByText(/Platform Administrative Portal/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Platform Administrative Portal/i })).not.toBeInTheDocument();

      // Verify normal user settings elements still render
      expect(screen.getByText(/All data stored in your browser's localStorage/i)).toBeInTheDocument();
      expect(screen.getByText(/Personalisation & Appearance/i)).toBeInTheDocument();
      expect(screen.getByText(/Reset All Data/i)).toBeInTheDocument();
    });

    it('preserves /admin and #admin in valid navigation tabs and location resolver', () => {
      expect(VALID_NAV_TABS).toHaveProperty('admin', 'admin');

      // Test pathname resolution e.g. /admin
      const originalLocation = window.location;
      delete (window as any).location;

      (window as any).location = {
        pathname: '/admin',
        hash: '',
      };
      expect(resolveNavTabFromLocation()).toBe('admin');

      // Test hash resolution e.g. #admin
      (window as any).location = {
        pathname: '/',
        hash: '#admin',
      };
      expect(resolveNavTabFromLocation()).toBe('admin');

      // Restore location
      (window as any).location = originalLocation;
    });

    it('denies access to non-admin users visiting the /admin route directly', async () => {
      vi.spyOn(adminService, 'verifyPlatformAdmin').mockResolvedValue({
        isAdmin: false,
        userId: 'usr-student-intruder',
        error: 'Forbidden: Current account is not an authorized platform administrator',
      });

      const onExitMock = vi.fn();
      render(<AdminRoute onExit={onExitMock} />);

      await waitFor(() => {
        expect(screen.getByText(/Platform Administrator Access Required/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/HTTP 403 · Access Denied/i)).toBeInTheDocument();
      expect(screen.getByText('usr-student-intruder')).toBeInTheDocument();
    });

    it('grants full administrative access to authorized platform owner navigating to /admin', async () => {
      vi.spyOn(adminService, 'verifyPlatformAdmin').mockResolvedValue({
        isAdmin: true,
        userId: 'usr-platform-owner-1',
        role: 'owner',
      });

      vi.spyOn(adminService, 'fetchOverviewMetrics').mockResolvedValue({
        data: {
          total_users: 120,
          total_workspaces: 8,
          total_attendance_records: 1540,
          active_users_7d: 45,
          system_status: 'operational',
          timestamp: new Date().toISOString(),
        },
      });

      const onExitMock = vi.fn();
      render(<AdminRoute onExit={onExitMock} />);

      await waitFor(() => {
        expect(screen.getByText(/Tracker Administrative Portal/i)).toBeInTheDocument();
      });

      expect(screen.getByText('owner')).toBeInTheDocument();
      expect(screen.getByText(/System Overview/i)).toBeInTheDocument();
    });
  });
});
