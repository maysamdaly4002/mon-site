/**
 * Snapify
 * © 2026 NOVALABS WEB DESIGN — Tunisie
 * Contact : contact@novalabs.tn · +216 24 734 647
 * Tous droits réservés. Toute reproduction, modification ou diffusion sans autorisation écrite est interdite.
 */
import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Lock } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminShell } from './layout/AdminShell';
import { ALL_NAV } from './layout/nav';
import { ConfirmProvider } from './ui/overlays';
import { EmptyState, PageSkeleton, Spinner } from './ui/primitives';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const AccountSetupPage = lazy(() => import('./pages/AccountSetupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const PagesListPage = lazy(() => import('./pages/PagesListPage'));
const PageEditorPage = lazy(() => import('./pages/PageEditorPage'));
const PostsListPage = lazy(() => import('./pages/PostsListPage'));
const PostEditorPage = lazy(() => import('./pages/PostEditorPage'));
const MediaPage = lazy(() => import('./pages/MediaPage'));
const MenusPage = lazy(() => import('./pages/MenusPage'));
const WidgetsPage = lazy(() => import('./pages/WidgetsPage'));
const FormsPage = lazy(() => import('./pages/FormsPage'));
const NewsletterPage = lazy(() => import('./pages/NewsletterPage'));
const EngagementPage = lazy(() => import('./pages/EngagementPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const ModulesPage = lazy(() => import('./pages/ModulesPage'));
const ModuleDetailPage = lazy(() => import('./pages/ModuleDetailPage'));
const ModuleAdminPage = lazy(() => import('./pages/ModuleAdminPage'));
const ThemesPage = lazy(() => import('./pages/ThemesPage'));
const ThemeCustomizePage = lazy(() => import('./pages/ThemeCustomizePage'));
const SeoPage = lazy(() => import('./pages/SeoPage'));
const BrandingPage = lazy(() => import('./pages/BrandingPage'));
const GeneralPage = lazy(() => import('./pages/GeneralPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword || user.mustSetup2fa) {
    return (
      <Suspense fallback={<FullScreenSpinner />}>
        <AccountSetupPage />
      </Suspense>
    );
  }
  return <AdminShell />;
}

/** Applique les permissions définies dans la navigation. */
function Guard({ path, children }: { path: string; children: React.ReactNode }) {
  const { can } = useAuth();
  const item = ALL_NAV.find((n) => n.to === path);
  if (item?.perms && !can(...item.perms)) {
    return <EmptyState icon={Lock} title="Accès restreint" description="Votre rôle ne donne pas accès à cette section. Contactez un administrateur si vous en avez besoin." />;
  }
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

const g = (path: string, el: React.ReactNode) => <Guard path={path}>{el}</Guard>;

function ModulePageGuard() {
  const { can } = useAuth();
  if (!can('modules.use')) {
    return <EmptyState icon={Lock} title="Accès restreint" description="Votre rôle ne permet pas de gérer les données des modules. Contactez un administrateur si vous en avez besoin." />;
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ModuleAdminPage />
    </Suspense>
  );
}

const router = createBrowserRouter(
  [
    {
      path: '/login',
      element: (
        <Suspense fallback={<FullScreenSpinner />}>
          <LoginPage />
        </Suspense>
      ),
    },
    {
      path: '/reset-password',
      element: (
        <Suspense fallback={<FullScreenSpinner />}>
          <ResetPasswordPage />
        </Suspense>
      ),
    },
    {
      element: <RequireAuth />,
      children: [
        { index: true, element: g('/', <DashboardPage />) },
        { path: 'analytics', element: g('/analytics', <AnalyticsPage />) },
        { path: 'pages', element: g('/pages', <PagesListPage />) },
        { path: 'pages/:id', element: g('/pages', <PageEditorPage />) },
        { path: 'posts', element: g('/posts', <PostsListPage />) },
        { path: 'posts/:id', element: g('/posts', <PostEditorPage />) },
        { path: 'media', element: g('/media', <MediaPage />) },
        { path: 'menus', element: g('/menus', <MenusPage />) },
        { path: 'widgets', element: g('/widgets', <WidgetsPage />) },
        { path: 'forms', element: g('/forms', <FormsPage />) },
        { path: 'newsletter', element: g('/newsletter', <NewsletterPage />) },
        { path: 'engagement', element: g('/engagement', <EngagementPage />) },
        { path: 'marketplace', element: g('/marketplace', <MarketplacePage />) },
        { path: 'modules', element: g('/modules', <ModulesPage />) },
        { path: 'modules/:id', element: g('/modules', <ModuleDetailPage />) },
        { path: 'm/:moduleId/:pageId/*', element: <ModulePageGuard /> },
        { path: 'themes', element: g('/themes', <ThemesPage />) },
        { path: 'themes/customize', element: g('/themes/customize', <ThemeCustomizePage />) },
        { path: 'ai', element: <Navigate to="/modules/novalabs.ai-chat" replace /> },
        { path: 'seo', element: g('/seo', <SeoPage />) },
        { path: 'branding', element: g('/branding', <BrandingPage />) },
        { path: 'general', element: g('/general', <GeneralPage />) },
        { path: 'maintenance', element: g('/maintenance', <MaintenancePage />) },
        { path: 'settings', element: g('/settings', <SettingsPage />) },
        { path: 'users', element: g('/users', <UsersPage />) },
        { path: 'profile', element: g('/profile', <ProfilePage />) },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: '/administrator' }
);

function Root() {
  return (
    <ConfirmProvider>
      <RouterProvider router={router} />
    </ConfirmProvider>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Root />
      <Toaster richColors position="top-right" closeButton toastOptions={{ className: 'font-sans' }} />
    </AuthProvider>
  );
}
