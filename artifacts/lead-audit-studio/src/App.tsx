import { useEffect, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, useClerk, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  DashboardPage, HomePage, IntakePage, LeadDetailPage, LeadsPage, SettingsPage,
  SignInPage, SignUpPage,
} from '@/pages/lead-app';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#315f52', colorForeground: '#263c35', colorMutedForeground: '#758078',
    colorDanger: '#a94438', colorBackground: '#fffdf8', colorInput: '#fffdf8',
    colorInputForeground: '#263c35', colorNeutral: '#d9d3c7', fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.65rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#ded8cc]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#263c35] font-semibold',
    headerSubtitle: 'text-[#758078]',
    socialButtonsBlockButtonText: 'text-[#263c35]',
    formFieldLabel: 'text-[#384b43]',
    footerActionLink: 'text-[#315f52]',
    footerActionText: 'text-[#758078]',
    dividerText: 'text-[#758078]',
    identityPreviewEditButton: 'text-[#315f52]',
    formFieldSuccessText: 'text-[#315f52]',
    alertText: 'text-[#873d34]',
    logoBox: 'h-12',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#d9d3c7] bg-[#f8f5ed]',
    formButtonPrimary: 'bg-[#315f52] hover:bg-[#244b40]',
    formFieldInput: 'border-[#d9d3c7] bg-[#fffdf8] text-[#263c35]',
    footerAction: 'text-[#758078]',
    dividerLine: 'bg-[#e7e1d7]',
    alert: 'border-[#ead0c8]',
    otpCodeFieldInput: 'border-[#d9d3c7] bg-[#fffdf8]',
    formFieldRow: 'text-[#384b43]',
    main: 'text-[#263c35]',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const priorUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const currentUserId = user?.id ?? null;
      if (priorUserId.current !== undefined && priorUserId.current !== currentUserId) cache.clear();
      priorUserId.current = currentUserId;
    });
    return unsubscribe;
  }, [addListener, cache]);
  return null;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-loading"><div className="auth-loading-mark"/><span>Opening your field desk</span></div>;
  return isSignedIn ? <>{children}</> : <Redirect to="/sign-in"/>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your good work left off.' } },
      signUp: { start: { title: 'Set up your field desk', subtitle: 'A little structure for a lot of good work.' } },
    }}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkQueryClientCacheInvalidator/>
    <RoutedErrorBoundary><Switch>
      <Route path="/" component={HomePage}/>
      <Route path="/sign-in/*?" component={SignInPage}/>
      <Route path="/sign-up/*?" component={SignUpPage}/>
      <Route path="/intake" component={IntakePage}/>
      <Route path="/dashboard">{()=><Protected><DashboardPage/></Protected>}</Route>
      <Route path="/leads">{()=><Protected><LeadsPage/></Protected>}</Route>
      <Route path="/leads/:id">{params=><Protected><LeadDetailPage id={params.id}/></Protected>}</Route>
      <Route path="/settings">{()=><Protected><SettingsPage/></Protected>}</Route>
      <Route component={NotFound}/>
    </Switch></RoutedErrorBoundary>
  </ClerkProvider>;
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
