'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/simple-toast';
import { useAlert } from '@/components/ui/custom-alert';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { User } from '@/lib/types';

export default function UsersPage() {
  return (
    <ThemeProvider>
      <UsersPageContent />
    </ThemeProvider>
  );
}

function UsersPageContent() {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const router = useRouter();
  const { success, error, warning } = useToast();
  const { showAlert, showConfirm } = useAlert();
  
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'judge' | 'staff' | 'admin' | 'superadmin'>('all');
  
  // Create/Edit user modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    userType: 'judge' as 'judge' | 'staff' | 'admin' | 'superadmin',
    staffPermissions: {
      announcer: false,
      backstage: false,
      media: false,
      runner: false,
      eventViewer: false,
      scoreApprover: false,
      judgeAccess: false
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (!session) {
      router.push('/portal/admin');
      return;
    }
    
    try {
      const adminData = JSON.parse(session);
      if (!adminData.isAdmin) {
        router.push('/judge/dashboard');
        return;
      }
      // Get current user info
      fetchCurrentUser(adminData.id);
    } catch {
      router.push('/portal/admin');
    }
    
    fetchUsers();
  }, [router]);
  
  const fetchCurrentUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${userId}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };
  
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch regular users
      const usersResponse = await fetch('/api/users');
      const usersData = await usersResponse.json();
      
      // Fetch staff accounts (clients)
      const clientsResponse = await fetch('/api/clients');
      const clientsData = await clientsResponse.json();
      
      let allUsers: User[] = [];
      
      if (usersData.success) {
        allUsers = [...usersData.users];
      }
      
      // Transform clients to User format
      if (clientsData.success && clientsData.clients) {
        const staffUsers: User[] = clientsData.clients.map((client: any) => ({
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone || '',
          password: '', // Don't expose password
          userType: 'staff' as const,
          isAdmin: false,
          role: 'staff' as any, // Map to a staff role
          staffPermissions: {
            // Map allowedDashboards to staffPermissions
            announcer: client.allowedDashboards?.includes('announcer-dashboard') || false,
            backstage: client.allowedDashboards?.includes('backstage-dashboard') || false,
            media: client.allowedDashboards?.includes('media-dashboard') || false,
            runner: false, // Not in dashboard list
            eventViewer: client.allowedDashboards?.includes('event-dashboard') || false,
            scoreApprover: false, // Not in dashboard list
            judgeAccess: client.allowedDashboards?.includes('judge-dashboard') || false
          },
          createdAt: client.createdAt,
          // Store client-specific data
          isClientAccount: true,
          isActive: client.isActive,
          isApproved: client.isApproved,
          lastLoginAt: client.lastLoginAt,
          allowedDashboards: client.allowedDashboards || []
        }));
        
        allUsers = [...allUsers, ...staffUsers];
      }
      
      setUsers(allUsers);
      setFilteredUsers(allUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    let filtered = users;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.phone && u.phone.includes(searchTerm))
      );
    }
    
    // Filter by userType
    if (userTypeFilter !== 'all') {
      filtered = filtered.filter(u => u.userType === userTypeFilter);
    }
    
    setFilteredUsers(filtered);
  }, [searchTerm, userTypeFilter, users]);
  
  const handleCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      userType: 'judge',
      staffPermissions: {
        announcer: false,
        backstage: false,
        media: false,
        runner: false,
        eventViewer: false,
        scoreApprover: false,
        judgeAccess: false
      }
    });
    setShowUserModal(true);
  };
  
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '', // Don't pre-fill password
      userType: user.userType,
      staffPermissions: user.staffPermissions ? {
        announcer: user.staffPermissions.announcer ?? false,
        backstage: user.staffPermissions.backstage ?? false,
        media: user.staffPermissions.media ?? false,
        runner: user.staffPermissions.runner ?? false,
        eventViewer: user.staffPermissions.eventViewer ?? false,
        scoreApprover: user.staffPermissions.scoreApprover ?? false,
        judgeAccess: user.staffPermissions.judgeAccess ?? false
      } : {
        announcer: false,
        backstage: false,
        media: false,
        runner: false,
        eventViewer: false,
        scoreApprover: false,
        judgeAccess: false
      }
    });
    setShowUserModal(true);
  };
  
  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      warning('You cannot delete your own account');
      return;
    }
    
    showConfirm(
      `Are you sure you want to delete user "${user.name}"? This action cannot be undone.`,
      async () => {
        try {
          const session = localStorage.getItem('adminSession');
          if (!session) {
            error('Session expired. Please log in again.');
            return;
          }
          
          const adminData = JSON.parse(session);
          const response = await fetch(`/api/users/${user.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${adminData.id}`
            }
          });
          
          const data = await response.json();
          if (data.success) {
            success(`User "${user.name}" deleted successfully`);
            fetchUsers();
          } else {
            error(data.error || 'Failed to delete user');
          }
        } catch (err) {
          console.error('Error deleting user:', err);
          error('Failed to delete user');
        }
      }
    );
  };
  
  const handleSubmitUser = async () => {
    // Validation
    if (!userForm.name || !userForm.email) {
      showAlert('Name and email are required', 'warning');
      return;
    }
    
    if (!editingUser && !userForm.password) {
      showAlert('Password is required for new users', 'warning');
      return;
    }
    
    if (userForm.password && userForm.password.length < 6) {
      showAlert('Password must be at least 6 characters long', 'warning');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const session = localStorage.getItem('adminSession');
      if (!session) {
        error('Session expired. Please log in again.');
        return;
      }
      
      const adminData = JSON.parse(session);
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const body: any = {
        name: userForm.name,
        email: userForm.email,
        phone: userForm.phone || undefined,
        userType: userForm.userType,
        staffPermissions: userForm.userType === 'staff' ? userForm.staffPermissions : undefined
      };
      
      if (userForm.password) {
        body.password = userForm.password;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminData.id}`
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      if (data.success) {
        success(editingUser ? 'User updated successfully' : 'User created successfully');
        setShowUserModal(false);
        fetchUsers();
        // Refresh current user if editing self
        if (editingUser && editingUser.id === currentUser?.id) {
          fetchCurrentUser(adminData.id);
        }
      } else {
        error(data.error || 'Failed to save user');
      }
    } catch (err) {
      console.error('Error saving user:', err);
      error('Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Check if current user is superadmin (by role or email)
  const canManageAdmins = currentUser?.role === 'superadmin' || 
    (currentUser?.email && ['gabriel@elementscentral.com', 'info@upstreamcreatives.co.za', 'mains@elementscentral.com', 'admin@eodsa.com'].includes(currentUser.email.toLowerCase()));
  
  return (
    <div className={`min-h-screen ${themeClasses.mainBg} ${themeClasses.textPrimary}`}>
      {/* Header */}
      <div className={`${themeClasses.headerBg} border-b ${themeClasses.cardBorder} p-6`}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">👥 User Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create and manage all system users (judges, staff, admins)
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              href="/admin"
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-colors"
            >
              ← Back to Admin
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
      
      {/* Filters and Actions */}
      <div className={`${themeClasses.headerBg} border-b ${themeClasses.cardBorder} p-4`}>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 gap-4 items-center">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`flex-1 px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value as any)}
              className={`px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="all">All Types</option>
              <option value="judge">Judges</option>
              <option value="staff">Staff</option>
              <option value="admin">Admins</option>
              <option value="superadmin">Super Admins</option>
            </select>
          </div>
          <button
            onClick={handleCreateUser}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            + Create User
          </button>
        </div>
      </div>
      
      {/* Users List */}
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={`${themeClasses.headerBg}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                    Name
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                    Email
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                    Phone
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                    Type / Permissions
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                    Status
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                    Last Login
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`${themeClasses.cardBg} divide-y divide-gray-200 dark:divide-gray-700`}>
                {filteredUsers.map((user) => {
                  const isClientAccount = (user as any).isClientAccount;
                  const userStatus = isClientAccount 
                    ? ((user as any).isActive && (user as any).isApproved ? 'Active' : 'Inactive')
                    : 'Active';
                  
                  // Get dashboard permissions for staff accounts
                  const dashboardPermissions = isClientAccount && (user as any).allowedDashboards
                    ? (user as any).allowedDashboards.map((d: string) => d.replace('-dashboard', ''))
                    : [];
                  
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium">{user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{user.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.userType === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            user.userType === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            user.userType === 'staff' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {user.userType}
                          </span>
                          {dashboardPermissions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {dashboardPermissions.map((perm: string) => (
                                <span key={perm} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded capitalize">
                                  {perm}
                                </span>
                              ))}
                            </div>
                          )}
                          {user.userType === 'staff' && !isClientAccount && user.staffPermissions && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(user.staffPermissions).map(([key, value]) => 
                                value && (
                                  <span key={key} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded capitalize">
                                    {key}
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userStatus === 'Active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {userStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {(user as any).lastLoginAt 
                            ? new Date((user as any).lastLoginAt).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          {isClientAccount ? (
                            <>
                              <button
                                onClick={async () => {
                                  const newStatus = !((user as any).isActive && (user as any).isApproved);
                                  try {
                                    const response = await fetch('/api/clients', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        id: user.id,
                                        name: user.name,
                                        email: user.email,
                                        phone: user.phone,
                                        allowedDashboards: (user as any).allowedDashboards || [],
                                        isActive: newStatus,
                                        isApproved: newStatus
                                      })
                                    });
                                    const data = await response.json();
                                    if (data.success) {
                                      success(`Staff ${newStatus ? 'activated' : 'deactivated'}`);
                                      fetchUsers();
                                    } else {
                                      error(data.error || 'Failed to update staff');
                                    }
                                  } catch (err) {
                                    error('Network error');
                                  }
                                }}
                                className={`px-3 py-1 text-xs rounded ${
                                  userStatus === 'Active'
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                                }`}
                              >
                                {userStatus === 'Active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => {
                                  showConfirm(
                                    'Are you sure you want to delete this staff account? This action cannot be undone.',
                                    async () => {
                                      try {
                                        const response = await fetch(`/api/clients?id=${user.id}`, {
                                          method: 'DELETE'
                                        });
                                        const data = await response.json();
                                        if (data.success) {
                                          success('Staff account deleted successfully');
                                          fetchUsers();
                                        } else {
                                          error(data.error || 'Failed to delete staff account');
                                        }
                                      } catch (err) {
                                        error('Network error');
                                      }
                                    }
                                  );
                                }}
                                className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded text-sm font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="px-3 py-1 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded text-sm font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Create/Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${themeClasses.headerBg} rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold">
                {editingUser ? 'Edit User' : 'Create User'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Basic Fields */}
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              
              {/* User Type */}
              <div>
                <label className="block text-sm font-medium mb-1">User Type *</label>
                <select
                  value={userForm.userType}
                  onChange={(e) => {
                    const newType = e.target.value as 'judge' | 'staff' | 'admin' | 'superadmin';
                    setUserForm({ 
                      ...userForm, 
                      userType: newType,
                      staffPermissions: newType === 'staff' 
                        ? (userForm.staffPermissions || {
                            announcer: false,
                            backstage: false,
                            media: false,
                            runner: false,
                            eventViewer: false,
                            scoreApprover: false,
                            judgeAccess: false
                          })
                        : undefined as any
                    });
                  }}
                  disabled={!canManageAdmins && (userForm.userType === 'admin' || userForm.userType === 'superadmin')}
                  className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="judge">Judge</option>
                  <option value="staff">Staff</option>
                  {canManageAdmins && (
                    <>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </>
                  )}
                </select>
                {!canManageAdmins && (userForm.userType === 'admin' || userForm.userType === 'superadmin') && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Only superadmins can create/manage admin accounts
                  </p>
                )}
              </div>
              
              {/* Staff Permissions */}
              {userForm.userType === 'staff' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <label className="block text-sm font-medium mb-3">Staff Permissions</label>
                  <div className="space-y-2">
                    {[
                      { key: 'announcer', label: 'Announcer' },
                      { key: 'backstage', label: 'Backstage' },
                      { key: 'media', label: 'Media' },
                      { key: 'runner', label: 'Runner' },
                      { key: 'eventViewer', label: 'Event Viewer' },
                      { key: 'scoreApprover', label: 'Score Approver' },
                      { key: 'judgeAccess', label: 'Judge Access (only if intentionally checked)' }
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(userForm.staffPermissions && userForm.staffPermissions[key as keyof typeof userForm.staffPermissions]) || false}
                          onChange={(e) => {
                            const currentPermissions = userForm.staffPermissions || {
                              announcer: false,
                              backstage: false,
                              media: false,
                              runner: false,
                              eventViewer: false,
                              scoreApprover: false,
                              judgeAccess: false
                            };
                            setUserForm({
                              ...userForm,
                              staffPermissions: {
                                ...currentPermissions,
                                [key]: e.target.checked
                              }
                            });
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Admin/Superadmin Info */}
              {userForm.userType === 'admin' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Admin access:</strong> Full system access
                  </p>
                </div>
              )}
              
              {userForm.userType === 'superadmin' && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    <strong>Super Admin access:</strong> Can delete admins, promote/demote admins, manage system-wide settings.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitUser}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

