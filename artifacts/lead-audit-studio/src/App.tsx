import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { authClient, getAuthToken } from '@/lib/auth';
import {
  DashboardPage, HomePage, IntakePage, LeadDetailPage, LeadsPage, SettingsPage,
  SignInPage,
} from '@/pages/lead-app';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

setAuthTokenGetter(async () => {
  return getAuthToken();
});

function AuthQueryClientCacheInvalidator() {
  const { data: session } = authClient.useSession();
  const cache = useQueryClient();
  const priorUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const currentUserId = session?.user?.id ?? null;
    if (priorUserId.current !== undefined && priorUserId.current !== currentUserId) cache.clear();
    priorUserId.current = currentUserId;
  }, [cache, session?.user?.id]);
  return null;
}

function Protected({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <div className="auth-loading"><div className="auth-loading-mark"/><span>Opening your consulting workspace</span></div>;
  return session?.user ? <>{children}</> : <Redirect to="/sign-in"/>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return <>
    <AuthQueryClientCacheInvalidator/>
    <RoutedErrorBoundary><Switch>
      <Route path="/" component={HomePage}/>
      <Route path="/about" component={HomePage}/>
      <Route path="/sign-in/*?" component={SignInPage}/>
      <Route path="/intake" component={IntakePage}/>
      <Route path="/dashboard">{()=><Protected><DashboardPage/></Protected>}</Route>
      <Route path="/leads">{()=><Protected><LeadsPage/></Protected>}</Route>
      <Route path="/leads/:id">{params=><Protected><LeadDetailPage id={params.id}/></Protected>}</Route>
      <Route path="/settings">{()=><Protected><SettingsPage/></Protected>}</Route>
      <Route component={NotFound}/>
    </Switch></RoutedErrorBoundary>
  </>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter base={basePath}><AppRoutes/></WouterRouter>
      <Toaster/>
    </TooltipProvider>
  </QueryClientProvider>;
}
export default App;
