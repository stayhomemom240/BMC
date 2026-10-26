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
    colorPrimary: '#7f2b41', colorForeground: '#402a30', colorMutedForeground: '#806f71',
    colorDanger: '#a23b44', colorBackground: '#fffdf9', colorInput: '#fffdf9',
    colorInputForeground: '#402a30', colorNeutral: '#e4d7cd', fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.65rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf9] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#e4d7cd]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#402a30] font-semibold',
    headerSubtitle: 'text-[#806f71]',
    socialButtonsBlockButtonText: 'text-[#402a30]',
    formFieldLabel: 'text-[#654a50]',
    footerActionLink: 'text-[#7f2b41]',
    footerActionText: 'text-[#806f71]',
    dividerText: 'text-[#806f71]',
    identityPreviewEditButton: 'text-[#7f2b41]',
    formFieldSuccessText: 'text-[#7f2b41]',
    alertText: 'text-[#87343e]',
    logoBox: 'h-12',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#e4d7cd] bg-[#faf3ed]',
    formButtonPrimary: 'bg-[#7f2b41] hover:bg-[#611f34]',
    formFieldInput: 'border-[#e4d7cd] bg-[#fffdf9] text-[#402a30]',
    footerAction: 'text-[#806f71]',
    dividerLine: 'bg-[#eee1d8]',
    alert: 'border-[#ead0c8]',
    otpCodeFieldInput: 'border-[#e4d7cd] bg-[#fffdf9]',
    formFieldRow: 'text-[#654a50]',
    main: 'text-[#402a30]',
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
  if (!isLoaded) return <div className="auth-loading"><div className="auth-loading-mark"/><span>Opening your consulting workspace</span></div>;
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
      signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your client work left off.' } },
      signUp: { start: { title: 'Set up your Boss Mom workspace', subtitle: 'A thoughtful start for your client work.' } },
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
