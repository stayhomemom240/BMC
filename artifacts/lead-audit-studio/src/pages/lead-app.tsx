import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import './lead-app.css';
import { Link, useLocation } from 'wouter';
import { authClient } from '@/lib/auth';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, Crown,
  CalendarDays, Check, CheckCircle2, ChevronDown, ClipboardCheck, Copy, ExternalLink, FileText,
  Filter, Globe2, Leaf, Link2, LoaderCircle, MapPin, Menu, MessageSquareText,
  Phone, Plus, Search, Settings2, Sprout, Target, Trash2, TrendingUp, Video,
  UserRound, X,
} from 'lucide-react';
import { getConsultationSlots } from '@workspace/api-zod/consultationAvailability';
import {
  getGetLeadInsightsQueryKey, getGetLeadQueryKey, getGetLeadSettingsQueryKey, getGetPublicLeadSettingsQueryKey,
  getGetPublicWebsiteProfileQueryKey,
  getListLeadsQueryKey, useCreateLead, useDeleteLead, useGetLead,
  useGetLeadInsights, useGetLeadSettings, useGetPublicLeadSettings, useGetPublicWebsiteProfile,
  useHealthCheck, useListLeads, useRequestConsultation, useRespondToConsultation, useSubmitPublicLead, useUpdateLead,
  useUpdateLeadSettings,
} from '@workspace/api-client-react';
import type {
  ConsultationRequestResult, Lead, LeadInsights, LeadSettingsInput, LeadStage, PublicLeadResult, PublicLeadSettings, ServiceType,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const signInHref = `${basePath}/sign-in`;
const offerLabels: Record<ServiceType, string> = {
  'local-seo': 'Local visibility audit',
  'zero-waste': 'Zero-waste audit',
  general: 'Client needs assessment',
};
const stages: LeadStage[] = ['new', 'contacted', 'proposal', 'won', 'lost'];
const stageLabel: Record<LeadStage, string> = {
  new: 'New', contacted: 'Contacted', proposal: 'Proposal', won: 'Won', lost: 'Lost',
};
const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ');
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
const numberedSummary = (summary: string) => summary.split(/\r?\n/).filter(Boolean).map((line, index) =>
  /^\d+\.\s/.test(line) ? line : `${index + 1}. ${line}`,
).join('\n');
const consultationTimeLabel = (value: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(value));

function Button({ children, onClick, variant = 'solid', type = 'button', disabled, className = '', testId }: {
  children: ReactNode; onClick?: () => void; variant?: 'solid' | 'quiet' | 'outline' | 'danger';
  type?: 'button' | 'submit'; disabled?: boolean; className?: string; testId?: string;
}) {
  return <button data-testid={testId} type={type} onClick={onClick} disabled={disabled}
    className={cx('btn', `btn-${variant}`, className, disabled && 'opacity-55 cursor-not-allowed')}>
    {children}
  </button>;
}

function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return <div className={cx('wordmark', inverse && 'wordmark-inverse')} aria-label="Boss Mom Consulting"><span className="mark-icon"><img src="/brand-monogram.webp" alt=""/></span><span className="wordmark-name"><span>Boss Mom</span><i>Consulting</i></span></div>;
}

function PublicNav({ showIntake = false }: { showIntake?: boolean }) {
  return <header className="public-nav"><a href="#home" className="logo-link" aria-label="Boss Mom Consulting home"><Wordmark/></a><nav className="public-nav-links" aria-label="Main navigation"><a href="#home">Home</a><a href="#about">About</a><a href="#services">Services</a>{showIntake && <Link href="/intake" className="public-nav-cta">Start an assessment</Link>}<a href={signInHref} className="text-link" data-testid="link-sign-in">Owner sign in <ArrowRight size={15}/></a></nav></header>;
}

function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  async function handleSignOut() {
    setSignOutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setSignOutError(result.error.message ?? 'Sign out failed.');
        return;
      }
      setLocation('/');
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Sign out failed.');
    }
  }
  const links = [
    { href: '/dashboard', label: 'Overview', icon: Activity },
    { href: '/leads', label: 'Lead book', icon: BriefcaseBusiness },
    { href: '/settings', label: 'Practice settings', icon: Settings2 },
  ];
  return <div className="workspace">
    <aside className={cx('sidebar', mobileOpen && 'sidebar-open')}>
      <Link href="/dashboard" className="side-brand"><Wordmark inverse/></Link>
      <div className="side-caption">BOSS MOM CONSULTING</div>
      <nav className="side-nav">{links.map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cx('side-link', active === item.href && 'side-link-active')} data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><item.icon size={17}/><span>{item.label}</span>{active === item.href && <span className="nav-indicator"/>}</Link>)}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="small-leaf"><Leaf size={15}/></span><p>Good work starts with good questions.</p></div>
        <button className="profile-control" onClick={handleSignOut} data-testid="button-sign-out">
          <span className="avatar-initial">{user?.name?.trim()?.[0] ?? 'B'}</span><span className="profile-text"><b>{user?.name?.trim() || 'Your account'}</b><small>Sign out</small></span><ArrowDownRight size={15}/>
        </button>
        {signOutError && <p className="signout-error" role="alert">{signOutError}</p>}
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileOpen(false)}/>}
    <main className="main-area">
      <div className="mobile-top"><button aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu/></button><Wordmark/></div>
      {children}
    </main>
  </div>;
}

function LoadingPanel({ label = 'Gathering your client details' }: { label?: string }) {
  return <div className="loading-card"><div className="skeleton skeleton-heading"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line short"/><span className="loading-label"><LoaderCircle size={15}/>{label}</span></div>;
}
function ErrorPanel({ retry, message = 'We could not load this section.' }: { retry: () => void; message?: string }) {
  return <div className="error-panel"><div className="error-stamp">!</div><div><b>Something interrupted the workspace.</b><p>{message}</p><Button variant="outline" onClick={retry}>Try again</Button></div></div>;
}
function EmptyPanel({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-panel"><span className="empty-icon"><ClipboardCheck size={24}/></span><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
function SectionHeading({ eyebrow, title, detail, children }: { eyebrow: string; title: string; detail?: string; children?: ReactNode }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{detail && <p>{detail}</p>}</div>{children && <div className="heading-action">{children}</div>}</div>;
}
function StagePill({ stage }: { stage: LeadStage }) { return <span className={`stage-pill stage-${stage}`}><i/>{stageLabel[stage]}</span>; }
function OfferMark({ type, compact = false }: { type: ServiceType; compact?: boolean }) {
  const Icon = type === 'local-seo' ? MapPin : type === 'zero-waste' ? Leaf : Target;
  return <span className={cx('offer-mark', `offer-${type}`)}><Icon size={compact ? 14 : 17}/>{!compact && offerLabels[type]}</span>;
}
function getLeadDisplayName(lead: Pick<Lead, 'name' | 'email'>) {
  return typeof lead.name === 'string' && lead.name.trim()
    ? lead.name.trim()
    : typeof lead.email === 'string' && lead.email.trim()
      ? lead.email.trim()
      : 'Name unavailable';
}
function LeadRow({ lead }: { lead: Lead }) {
  const consultation = lead.consultation;
  const callTime = consultation?.status === 'reschedule_proposed' && consultation.responseSlotStart
    ? consultation.responseSlotStart
    : consultation?.slotStart;
  const displayName = getLeadDisplayName(lead);
  const hasName = typeof lead.name === 'string' && !!lead.name.trim();
  return <Link href={`/leads/${lead.id}`} className="lead-row" data-testid={`link-lead-${lead.id}`}>
    <span className="lead-avatar">{displayName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</span>
    <span className="lead-person"><b>{displayName}</b><small>{lead.company || lead.email}</small>{!hasName && <small className="lead-data-warning" role="status">Name missing from this record</small>}{consultation && callTime && <small className="lead-call-state">Call {consultation.status.replaceAll('_', ' ')} · {dateLabel(callTime)}</small>}</span>
    <span className="lead-offer"><OfferMark type={lead.serviceType} compact/><span>{offerLabels[lead.serviceType]}</span></span>
    <StagePill stage={lead.stage}/><span className="lead-date">{dateLabel(lead.createdAt)}</span><ArrowRight size={16} className="row-arrow"/>
  </Link>;
}

export function HomePage() {
  const publicProfileQuery = useGetPublicWebsiteProfile({
    query: { retry: false, staleTime: 30_000 },
  });
  const profile = publicProfileQuery.data;
  return <div className="public-page field-grain">
    <PublicNav showIntake={!!profile}/>
    <section className="hero public-container" id="home">
      <div className="hero-copy rise-in"><span className="eyebrow"><span className="eyebrow-line"/>Strategize. Optimize. Grow.</span><h1>Your vision.<br/><em>Our strategy.</em></h1><p className="hero-intro">Digital marketing, SEO/GEO, practical web solutions, and brand alignment—built around your goals and focused on real growth.</p>
        <div className="hero-actions">{profile && <Link href="/intake" className="btn btn-solid" data-testid="link-public-intake">Tell me about your business <ArrowRight size={16}/></Link>}{profile?.fiverrUrl && <a href={profile.fiverrUrl} className="btn btn-outline" target="_blank" rel="noopener noreferrer">Explore services on Fiverr <ExternalLink size={15}/></a>}</div>
        <div className="trust-note"><span className="trust-rule"/>Be found. Be chosen. Be remembered.</div>
      </div>
      <div className="hero-visual rise-in delay-2" aria-label="Boss Mom Consulting office">
        <div className="hero-photo-frame">
          <img src="/boss-mom-office.jpeg" alt="Boss Mom Consulting office with an orchid, warm wood desk, and client seating"/>
          <div className="hero-photo-caption"><span>Boss Mom Consulting</span><b>Be found. Be chosen. Be remembered.</b></div>
        </div>
        <img className="hero-brand-sticker" src="/brand-services-sticker.webp" alt="Boss Mom Consulting services: SEO and GEO, digital marketing, web development, and brand strategy"/>
      </div>
    </section>
    <section className="public-about public-container" id="about">
      <div className="public-about-copy">
        <span className="eyebrow">About Boss Mom Consulting</span>
        <h2>Strategy that turns your vision into <em>momentum.</em></h2>
        <p>Boss Mom Consulting helps small businesses sharpen their story, strengthen their visibility, and put the right digital tools to work—from SEO/GEO and brand alignment to web solutions and practical business planning.</p>
        <p>Every engagement starts with your goals, budget, and current challenges. We also support local visibility and sustainability priorities, with a clear, realistic path forward—not a one-size-fits-all checklist.</p>
      </div>
      <aside className="about-promise">
        <span className="eyebrow">What to expect</span>
        <b>Listen first.<br/>Focus on what matters.<br/>Leave with next steps.</b>
        <span>Choose the service that fits, or begin with a short assessment if you’re not sure yet.</span>
        {profile && <Link href="/intake" className="text-link">Start with the assessment <ArrowRight size={15}/></Link>}
      </aside>
    </section>
    <section className="offer-strip" id="services"><div className="public-container offer-strip-inner"><span className="eyebrow">Our services</span><div className="offer-catalog"><div><MapPin/><b>SEO &amp; GEO strategy</b><small>Strengthen local search, business listings, and visibility in AI-powered search.</small></div><div><Target/><b>Digital marketing</b><small>Reach the right audience with thoughtful, measurable campaigns.</small></div><div><Globe2/><b>Web app development</b><small>Build practical digital tools and experiences that support your growth.</small></div><div><Crown/><b>Brand strategy</b><small>Clarify your positioning, voice, and visual direction.</small></div></div></div></section>
    <section className="public-how public-container"><div><span className="eyebrow">A clear path to growth</span><h2>Strategize.<br/><em>Optimize. Grow.</em></h2></div><div className="how-steps"><article><span>01</span><h3>Start with your vision</h3><p>Tell us what you want to achieve and what is getting in the way.</p></article><article><span>02</span><h3>Build the right strategy</h3><p>Focus on the audience, brand, and tools that will move your business forward.</p></article><article><span>03</span><h3>Grow with intention</h3><p>Leave with a clear next step, whether you need visibility, sustainability, or a broader business plan.</p></article></div></section>
    <section className="closing-band"><div className="public-container closing-inner"><div><span className="eyebrow">Ready to bring your vision to life?</span><h2>Let’s build your<br/>next chapter.</h2></div>{profile ? <Link href="/intake" className="btn btn-brass">Start your assessment <ArrowRight size={16}/></Link> : <p className="website-intake-note">The online assessment is being prepared. Please check back soon.</p>}</div></section>
    <footer className="public-footer public-container"><Wordmark/><span>Boss Mom Consulting · Strategize. Optimize. Grow.</span><a href={signInHref}>Owner sign in <ArrowRight size={14}/></a></footer>
  </div>;
}

export function DashboardPage() {
  const insights = useGetLeadInsights();
  const leads = useListLeads();
  const health = useHealthCheck();
  const data = insights.data as LeadInsights | undefined;
  const hasUnexpectedLeadResponse = leads.data !== undefined && !Array.isArray(leads.data);
  const recent = [...(Array.isArray(leads.data) ? leads.data : [])].sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0,5);
  return <AppShell active="/dashboard"><div className="page-content">
    <div className="dashboard-topline"><span className="eyebrow"><span className="status-dot"/>BOSS MOM CONSULTING / OVERVIEW</span><span className="health-label"><span className={cx('health-dot', health.isError && 'health-bad')}/>{health.isError ? 'Connection needs attention' : 'Workspace ready'}</span></div>
    <SectionHeading eyebrow="The overview" title="A good day to follow up." detail="A clear read on the conversations in your care.">
      <Link href="/settings" className="btn btn-outline"><Settings2 size={16}/> Practice settings</Link>
    </SectionHeading>
    {insights.isLoading ? <div className="stats-grid">{[1,2,3,4].map(x=><div className="stat-skeleton" key={x}/>)}</div> : insights.isError ? <ErrorPanel retry={() => insights.refetch()} message="Your overview could not be retrieved just now."/> :
      <div className="stats-grid">
      <div className="stat-card stat-primary"><span className="stat-caption">All conversations</span><b>{data?.totalLeads ?? 0}</b><small><BriefcaseBusiness size={14}/> Since your workspace began</small></div>
      <div className="stat-card"><span className="stat-caption">Need a first reply</span><b>{data?.newLeads ?? 0}</b><small><MessageSquareText size={14}/> New in the lead book</small></div>
      <div className="stat-card"><span className="stat-caption">In motion</span><b>{data?.activeLeads ?? 0}</b><small><TrendingUp size={14}/> Contacted or proposal</small></div>
      <div className="stat-card"><span className="stat-caption">Won to date</span><b>{data?.wonLeads ?? 0}</b><small><ArrowUpRight size={14}/> {data?.winRate ?? 0}% conversion</small></div>
    </div>}
    <div className="dashboard-lower">
      <section className="paper-panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">The latest</span><h2>Recent conversations</h2></div><Link className="text-link" href="/leads">Open lead book <ArrowRight size={14}/></Link></div>
        {leads.isLoading ? <div className="list-skeletons">{[1,2,3].map(x=><div className="skeleton skeleton-row" key={x}/>)}</div> : leads.isError ? <ErrorPanel retry={() => leads.refetch()} message="Recent leads could not be loaded."/> : hasUnexpectedLeadResponse ? <ErrorPanel retry={() => leads.refetch()} message="The API returned an unexpected response. Check the Cloudflare Pages API proxy configuration."/> : recent.length === 0 ? <EmptyPanel title="Your next conversation starts here" detail="Share your intake link and your first lead will appear here." action={<Link className="btn btn-outline" href="/settings">Set up your intake link <ArrowRight size={15}/></Link>}/> : <div className="lead-list">{recent.map(lead=><LeadRow key={lead.id} lead={lead}/>)}</div>}
      </section>
      <section className="insight-panel"><span className="eyebrow">A small signal</span><h2>What’s coming<br/>through the door</h2><p>Assessments by service, to help you see what clients are asking for.</p>
        {insights.isLoading ? <div className="skeleton skeleton-chart"/> : insights.isError ? <button className="mini-retry" onClick={() => insights.refetch()}>Retry insights</button> : data?.serviceBreakdown?.length ? <ServiceBreakdown data={data.serviceBreakdown}/> : <div className="chart-empty"><span>No pattern yet</span><small>Your first client assessment will start the picture.</small></div>}
        <div className="month-total"><span>NEW THIS MONTH</span><b>{data?.leadsThisMonth ?? 0}</b><small>conversations</small></div>
      </section>
    </div>
  </div></AppShell>;
}

function ServiceBreakdown({ data }: { data: LeadInsights['serviceBreakdown'] }) {
  const max = Math.max(1, ...data.map(x=>x.count));
  const colors: Record<ServiceType,string> = {'local-seo':'#8f2d43','zero-waste':'#c7768d',general:'#b98d6d'};
  return <div className="service-chart">{data.map(row=><div className="chart-row" key={row.serviceType}><div className="chart-label"><span>{offerLabels[row.serviceType]}</span><b>{row.count}</b></div><div className="chart-track"><i style={{ width: `${Math.max(4,row.count/max*100)}%`, background: colors[row.serviceType] }}/></div></div>)}</div>;
}

export function LeadsPage() {
  const queryClient = useQueryClient();
  const leadsQuery = useListLeads();
  const createLead = useCreateLead();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', serviceType: 'general' as ServiceType });
  const hasUnexpectedLeadResponse = leadsQuery.data !== undefined && !Array.isArray(leadsQuery.data);
  const filtered = useMemo(() => (Array.isArray(leadsQuery.data) ? leadsQuery.data : []).filter(lead => {
    const term = search.toLowerCase();
    const matches = `${getLeadDisplayName(lead)} ${lead.email} ${lead.company || ''}`.toLowerCase().includes(term);
    return matches && (stageFilter === 'all' || lead.stage === stageFilter);
  }).sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt)), [leadsQuery.data, search, stageFilter]);
  function handleCreate(event: FormEvent) {
    event.preventDefault();
    createLead.mutate({ data: { name: draft.name, email: draft.email, serviceType: draft.serviceType, goals: 'To be discussed', challenge: 'To be discussed', timeline: 'Not specified' } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetLeadInsightsQueryKey() }); setShowCreate(false); setDraft({name:'',email:'',serviceType:'general'}); },
    });
  }
  return <AppShell active="/leads"><div className="page-content">
    <SectionHeading eyebrow="Lead book" title="Every conversation, in one place." detail={`${leadsQuery.data?.length ?? 0} conversations recorded`}>
      <Button onClick={() => setShowCreate(!showCreate)}><Plus size={16}/> Add a lead</Button>
    </SectionHeading>
    {showCreate && <form className="create-lead-form" onSubmit={handleCreate}><div><span className="eyebrow">A conversation from elsewhere?</span><b>Add it to your book</b></div><input required placeholder="Name" aria-label="Name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} data-testid="input-new-lead-name"/><input required type="email" placeholder="Email" aria-label="Email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} data-testid="input-new-lead-email"/><select aria-label="Service" value={draft.serviceType} onChange={e=>setDraft({...draft,serviceType:e.target.value as ServiceType})}>{Object.entries(offerLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><Button type="submit" disabled={createLead.isPending}>{createLead.isPending ? 'Saving…' : 'Save lead'}</Button><button type="button" className="icon-button" aria-label="Close add lead form" onClick={()=>setShowCreate(false)}><X size={18}/></button></form>}
    {createLead.isError && <div className="inline-error">The lead could not be saved. Please try again.</div>}
    <div className="lead-tools"><label className="search-box"><Search size={17}/><input placeholder="Search name, company or email" value={search} onChange={e=>setSearch(e.target.value)} data-testid="input-search-leads"/></label><label className="filter-box"><Filter size={15}/><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)} aria-label="Filter leads by stage" data-testid="select-stage-filter"><option value="all">All stages</option>{stages.map(stage=><option key={stage} value={stage}>{stageLabel[stage]}</option>)}</select><ChevronDown size={14}/></label></div>
    <section className="paper-panel lead-book-panel">
      <div className="table-head"><span>NAME / BUSINESS</span><span>ASSESSMENT</span><span>STAGE</span><span>ADDED</span><span/></div>
      {leadsQuery.isLoading ? <div className="list-skeletons">{[1,2,3,4].map(x=><div className="skeleton skeleton-row" key={x}/>)}</div> :
       leadsQuery.isError ? <ErrorPanel retry={()=>leadsQuery.refetch()} message="Your lead book could not be loaded."/> :
       hasUnexpectedLeadResponse ? <ErrorPanel retry={()=>leadsQuery.refetch()} message="The API returned an unexpected response. Check the Cloudflare Pages API proxy configuration."/> :
       filtered.length === 0 ? <EmptyPanel title={search || stageFilter !== 'all' ? 'No matching conversations' : 'Your lead book is ready'} detail={search || stageFilter !== 'all' ? 'Try another name or clear your filters.' : 'As prospects complete an assessment, they will be collected here.'} action={search || stageFilter !== 'all' ? <Button variant="outline" onClick={()=>{setSearch('');setStageFilter('all')}}>Clear filters</Button> : <Button onClick={()=>setShowCreate(true)}><Plus size={15}/> Add your first lead</Button>}/> :
       <div className="lead-list">{filtered.map(lead=><LeadRow key={lead.id} lead={lead}/>)}</div>}
    </section>
    <div className="results-foot"><span><Filter size={13}/>{filtered.length} shown</span><span>Choose a conversation to see the full field report.</span></div>
  </div></AppShell>;
}

export function LeadDetailPage({ id }: { id?: string }) {
  const leadId = Number(id);
  const queryClient = useQueryClient();
  const leadQuery = useGetLead(leadId, { query: { enabled: Number.isFinite(leadId) && leadId > 0, queryKey: getGetLeadQueryKey(leadId) } });
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const [, setLocation] = useLocation();
  const [notes, setNotes] = useState<string | null>(null);
  const lead = leadQuery.data;
  const notesValue = notes ?? lead?.notes ?? '';
  const update = (data: { stage?: LeadStage; notes?: string | null }) => updateLead.mutate({ leadId, data }, { onSuccess: updated => {
    queryClient.setQueryData(getGetLeadQueryKey(leadId), updated);
    queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetLeadInsightsQueryKey() });
    setNotes(updated.notes ?? '');
  } });
  const remove = () => {
    if (!window.confirm('Delete this lead and its notes? This cannot be undone.')) return;
    deleteLead.mutate({ leadId }, { onSuccess: () => { queryClient.removeQueries({ queryKey: getGetLeadQueryKey(leadId) }); queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetLeadInsightsQueryKey() }); setLocation('/leads'); } });
  };
  if (leadQuery.isLoading) return <AppShell active="/leads"><div className="page-content"><LoadingPanel label="Opening the field report"/></div></AppShell>;
  if (leadQuery.isError || !lead) return <AppShell active="/leads"><div className="page-content"><Link href="/leads" className="back-link"><ArrowLeft size={15}/> Back to lead book</Link><ErrorPanel retry={()=>leadQuery.refetch()} message="This conversation may have moved or could not be opened."/></div></AppShell>;
  const displayName = getLeadDisplayName(lead);
  const hasName = typeof lead.name === 'string' && !!lead.name.trim();
  return <AppShell active="/leads"><div className="page-content detail-page">
    <Link href="/leads" className="back-link"><ArrowLeft size={15}/> Back to lead book</Link>
     <section className="detail-cover"><div className="detail-heading"><span className="lead-avatar lead-avatar-large">{displayName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</span><div><span className="eyebrow">CLIENT BRIEF / {String(lead.id).padStart(4,'0')}</span><h1>{displayName}</h1>{!hasName && <small className="lead-data-warning" role="status">Name missing from this record</small>}<div className="detail-meta"><span>{lead.company || lead.email}</span><span className="meta-divider">/</span><OfferMark type={lead.serviceType}/></div></div><div className="detail-actions"><Button variant="danger" onClick={remove} disabled={deleteLead.isPending}><Trash2 size={15}/>{deleteLead.isPending ? 'Deleting…' : 'Delete lead'}</Button></div></div>
      <div className="detail-bottom"><div><span className="eyebrow">ARRIVED</span><b>{dateLabel(lead.createdAt)}</b></div><div><span className="eyebrow">READINESS</span><b>{lead.readinessScore}<small> / 100</small></b></div><div><span className="eyebrow">TIMELINE</span><b>{lead.timeline}</b></div><div><span className="eyebrow">CURRENT STAGE</span><StagePill stage={lead.stage}/></div></div>
    </section>
    {deleteLead.isError && <div className="inline-error">This lead could not be deleted. Please try again.</div>}
    <div className="detail-columns"><div className="detail-main">
      <section className="paper-panel report-panel"><div className="panel-heading"><div><span className="eyebrow">THE CLIENT’S OWN WORDS</span><h2>What they’re working toward</h2></div><FileText size={19}/></div><div className="report-text">{numberedSummary(lead.reportSummary || 'No report summary was included with this assessment.')}</div>
        <div className="report-prompt"><div><span className="eyebrow">THE GOAL</span><p>{lead.goals}</p></div><div><span className="eyebrow">THE CHALLENGE</span><p>{lead.challenge}</p></div></div>
        <div className="report-contact"><span><UserRound size={15}/>{displayName}</span><a href={`mailto:${lead.email}`}>{lead.email} <ExternalLink size={13}/></a>{lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer"><Globe2 size={14}/>Website</a>}</div>
      </section>
       {lead.consultation && <ConsultationFollowup lead={lead} consultation={lead.consultation}/>}
       <section className="paper-panel notes-panel"><div className="panel-heading"><div><span className="eyebrow">PRIVATE TO YOUR PRACTICE</span><h2>Working notes</h2></div><MessageSquareText size={19}/></div><textarea value={notesValue} onChange={e=>setNotes(e.target.value)} placeholder="Capture context, questions to ask, or a next step…" rows={5} data-testid="textarea-lead-notes"/><div className="notes-bottom"><small>Only visible in your workspace.</small><Button onClick={()=>update({notes:notesValue})} disabled={updateLead.isPending}>{updateLead.isPending ? 'Saving…' : 'Save notes'}</Button></div>{updateLead.isError && <div className="inline-error">Notes could not be saved.</div>}</section>
    </div><aside className="detail-side"><span className="eyebrow">NEXT STEP</span><h3>Keep the conversation moving.</h3><p>Move this lead as you follow up. The right stage makes tomorrow’s list clearer.</p><label className="stage-select-label">Pipeline stage<select value={lead.stage} disabled={updateLead.isPending} onChange={e=>update({stage:e.target.value as LeadStage})} data-testid="select-lead-stage">{stages.map(stage=><option key={stage} value={stage}>{stageLabel[stage]}</option>)}</select></label><div className="pipeline-steps">{stages.slice(0,4).map((stage,index)=><div className={cx('pipeline-step', stages.indexOf(lead.stage)>=index && lead.stage !== 'lost' && 'pipeline-done')} key={stage}><span>{stages.indexOf(lead.stage)>index ? <Check size={12}/> : index+1}</span>{stageLabel[stage]}</div>)}</div><div className="side-tip"><Sprout size={17}/><span>A timely, specific follow-up is usually more useful than a perfect one.</span></div>{updateLead.isError && <div className="inline-error">Stage could not be changed.</div>}</aside></div>
  </div></AppShell>;
}

function ConsultationFollowup({
  lead,
  consultation,
}: {
  lead: Lead;
  consultation: NonNullable<Lead['consultation']>;
}) {
  const queryClient = useQueryClient();
  const respond = useRespondToConsultation();
  const [responseMessage, setResponseMessage] = useState('');
  const [proposedStartsAt, setProposedStartsAt] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  function submitResponse(status: 'confirmed' | 'declined' | 'reschedule_proposed') {
    setEmailNotice(null);
    respond.mutate({
      leadId: lead.id,
      data: {
        status,
        responseMessage: responseMessage.trim() || null,
        proposedStartsAt: status === 'reschedule_proposed'
          ? new Date(proposedStartsAt).toISOString()
          : null,
        meetingUrl: status === 'confirmed' && consultation.meetingType === 'zoom'
          ? meetingUrl.trim()
          : null,
      },
    }, {
      onSuccess: result => {
        queryClient.setQueryData<Lead>(getGetLeadQueryKey(lead.id), current => current
          ? { ...current, consultation: result.consultation }
          : current);
        queryClient.setQueryData<Lead[]>(getListLeadsQueryKey(), current => current?.map(item =>
          item.id === lead.id ? { ...item, consultation: result.consultation } : item));
        setEmailNotice(result.notificationSent
          ? 'Your response was emailed to the prospect.'
          : 'The appointment status was saved, but the email could not be sent.');
      },
    });
  }

  const statusLabel = consultation.status.replaceAll('_', ' ');
  const displayedTime = consultation.status === 'reschedule_proposed' && consultation.responseSlotStart
    ? consultation.responseSlotStart
    : consultation.slotStart;

  return <section className="paper-panel consultation-followup">
    <div className="panel-heading"><div><span className="eyebrow">CONSULTATION REQUEST</span><h2>Follow up on the call</h2></div><CalendarDays size={19}/></div>
    <div className="consultation-details">
      <div><span>STATUS</span><b className={`consultation-status status-${consultation.status}`}>{statusLabel}</b></div>
      <div><span>{consultation.status === 'reschedule_proposed' ? 'PROPOSED TIME' : 'REQUESTED TIME'}</span><b>{consultationTimeLabel(displayedTime)}</b></div>
      <div><span>MEETING</span><b>{consultation.meetingType === 'zoom' ? 'Zoom' : `Phone · ${consultation.phone || 'number not provided'}`}</b></div>
      {consultation.meetingUrl && <a href={consultation.meetingUrl} target="_blank" rel="noreferrer"><span>MEETING LINK</span><b>Open Zoom link <ExternalLink size={13}/></b></a>}
    </div>
    {consultation.responseMessage && <p className="consultation-response-message">{consultation.responseMessage}</p>}
    <a className="consultation-email-link" href={`mailto:${lead.email}?subject=${encodeURIComponent(`Consultation follow-up for ${getLeadDisplayName(lead)}`)}`}>
      Email {getLeadDisplayName(lead)} <ArrowRight size={14}/>
    </a>
    <div className="consultation-response-form">
      <label className="form-field"><span>Your message <small>Optional</small></span><textarea rows={3} maxLength={2000} value={responseMessage} onChange={event => setResponseMessage(event.target.value)} placeholder="Add a personal note for the email…"/></label>
      {consultation.meetingType === 'zoom' && <label className="form-field"><span>Zoom link <small>Required to confirm</small></span><input type="url" maxLength={500} value={meetingUrl} onChange={event => setMeetingUrl(event.target.value)} placeholder="https://zoom.us/j/…"/></label>}
      <label className="form-field"><span>Propose a different time <small>Pacific Time</small></span><input type="datetime-local" value={proposedStartsAt} onChange={event => setProposedStartsAt(event.target.value)}/></label>
      {respond.isError && <div className="inline-error" role="alert">Your consultation response could not be saved.</div>}
      {emailNotice && <div className={respond.data?.notificationSent ? 'consultation-email-success' : 'inline-error'} role="status">{emailNotice}</div>}
      <div className="consultation-response-actions">
        <Button onClick={() => submitResponse('confirmed')} disabled={respond.isPending || (consultation.meetingType === 'zoom' && !meetingUrl.trim())}>Confirm &amp; email</Button>
        <Button variant="outline" onClick={() => submitResponse('reschedule_proposed')} disabled={respond.isPending || !proposedStartsAt}>Propose time</Button>
        <Button variant="danger" onClick={() => submitResponse('declined')} disabled={respond.isPending}>Decline</Button>
      </div>
    </div>
  </section>;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const settingsQuery = useGetLeadSettings();
  const saveSettings = useUpdateLeadSettings();
  const settings = settingsQuery.data;
  const [form, setForm] = useState<LeadSettingsInput | null>(null);
  const value = form ?? (settings ? {
    businessName: settings.businessName, tagline: settings.tagline, enabledServices: settings.enabledServices,
    publishOnWebsite: settings.publishOnWebsite, websiteUrl: settings.websiteUrl || '', fiverrUrl: settings.fiverrUrl || '',
  } : { businessName: 'Boss Mom Consulting', tagline: '', enabledServices: ['local-seo','zero-waste','general'] as ServiceType[], publishOnWebsite: false, websiteUrl: '', fiverrUrl: '' });
  const publicUrl = `${window.location.origin}${basePath}/intake?owner=${encodeURIComponent(user?.id || '')}`;
  const patch = (next: Partial<LeadSettingsInput>) => setForm({...value, ...next});
  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); } catch { setCopyError(true); }
  }
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    saveSettings.mutate({ data: { ...value, websiteUrl: value.websiteUrl || null, fiverrUrl: value.fiverrUrl || null } }, {
      onSuccess: saved => {
        queryClient.setQueryData(getGetLeadSettingsQueryKey(), saved);
        queryClient.invalidateQueries({ queryKey: getGetLeadSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPublicWebsiteProfileQueryKey() });
        setForm(null);
      },
    });
  }
  if (settingsQuery.isLoading) return <AppShell active="/settings"><div className="page-content"><LoadingPanel label="Loading practice details"/></div></AppShell>;
  if (settingsQuery.isError) return <AppShell active="/settings"><div className="page-content"><SectionHeading eyebrow="Practice settings" title="Set the tone."/><ErrorPanel retry={()=>settingsQuery.refetch()} message="Your profile details could not be loaded."/></div></AppShell>;
  return <AppShell active="/settings"><div className="page-content settings-page">
    <SectionHeading eyebrow="Practice settings" title="Set the tone." detail="Your practice details shape the first impression prospects receive."/>
    <form onSubmit={submit} className="settings-form">
     <section className="paper-panel settings-section"><div className="settings-section-title"><span className="section-number">01</span><div><h2>Your business</h2><p>A clear name and a line about the work you do.</p></div></div><div className="form-grid"><label className="form-field full"><span>Business name</span><input required maxLength={160} value={value.businessName} onChange={e=>patch({businessName:e.target.value})} placeholder="Boss Mom Consulting" data-testid="input-business-name"/></label><label className="form-field full"><span>Short introduction <small>Up to 500 characters</small></span><textarea maxLength={500} rows={3} value={value.tagline} onChange={e=>patch({tagline:e.target.value})} placeholder="Local visibility, zero-waste goals, and practical next steps for small businesses." data-testid="input-tagline"/></label></div></section>
      <section className="paper-panel settings-section"><div className="settings-section-title"><span className="section-number">02</span><div><h2>Choose your assessments</h2><p>Keep the intake focused on the kind of work you take on.</p></div></div><div className="service-options">
        {(['local-seo','zero-waste','general'] as ServiceType[]).map((service,index)=><label className={cx('service-option', value.enabledServices.includes(service) && 'service-option-active')} key={service}><input type="checkbox" checked={value.enabledServices.includes(service)} onChange={e=>patch({enabledServices:e.target.checked ? [...value.enabledServices,service] : value.enabledServices.filter(x=>x!==service)})} data-testid={`checkbox-service-${service}`}/><span className="service-option-icon">{index === 0 ? <MapPin/> : index === 1 ? <Leaf/> : <Target/>}</span><span><b>{offerLabels[service]}</b><small>{service==='local-seo' ? 'Google Business Profile, local citations and on-page visibility.' : service==='zero-waste' ? 'Baseline, source reduction, reuse and practical diversion.' : 'Goals, priorities, business context and next steps.'}</small></span><span className="option-check"><Check size={14}/></span></label>)}
      </div>{value.enabledServices.length===0 && <div className="inline-error">Choose at least one assessment to continue.</div>}</section>
      <section className="paper-panel settings-section"><div className="settings-section-title"><span className="section-number">03</span><div><h2>Places to find you</h2><p>Optional links are shown with your public intake page.</p></div></div><div className="form-grid"><label className="form-field"><span><Globe2 size={15}/>Website</span><input type="url" value={value.websiteUrl || ''} onChange={e=>patch({websiteUrl:e.target.value})} placeholder="https://yourstudio.com" data-testid="input-website-url"/></label><label className="form-field"><span><ExternalLink size={15}/>Fiverr profile</span><input type="url" value={value.fiverrUrl || ''} onChange={e=>patch({fiverrUrl:e.target.value})} placeholder="https://www.fiverr.com/…" data-testid="input-fiverr-url"/></label></div></section>
      <section className="intake-link-panel"><div className="link-panel-copy"><span className="eyebrow">PUBLIC INTAKE LINK</span><h2>Ready for your website.</h2><p>Anyone with this link can submit—no invitation or account is needed. Add it to your website, email, or social profile.</p></div><label className="publish-toggle"><input type="checkbox" checked={value.publishOnWebsite} onChange={e=>patch({publishOnWebsite:e.target.checked})}/><span><b>Show assessment on this website</b><small>Add a public intake button to the Boss Mom Consulting home page.</small></span></label><div className="copy-url"><Link2 size={16}/><span>{publicUrl}</span><Button variant="outline" onClick={copyLink}><Copy size={15}/>{copied?'Copied':'Copy public link'}</Button></div>{copyError && <small className="copy-error">Could not copy automatically. Select the link to copy it manually.</small>}</section>
      {saveSettings.isError && <div className="inline-error">Your practice settings could not be saved. Please try again.</div>}
      <div className="settings-submit"><span>Changes take effect on your next shared intake link view.</span><Button type="submit" disabled={saveSettings.isPending || value.enabledServices.length===0}>{saveSettings.isPending?'Saving changes…':'Save practice details'} <ArrowRight size={15}/></Button></div>
    </form>
  </div></AppShell>;
}

const questionThemes: Record<ServiceType, { title: string; topics: string[]; goal: string; challenge: string }> = {
  'local-seo': { title: 'Local SEO / GEO audit', topics: ['Google Business Profile and reviews','Local listings and consistent details','On-page and technical visibility','Appearing in local and AI-powered search'], goal: 'What would better local visibility help your business do?', challenge: 'What feels hardest about being found by the right people?' },
  'zero-waste': { title: 'Zero-waste sustainability audit', topics: ['Current waste streams and baseline','Reducing waste at the source','Reuse, recycling and diversion','Practical goals for your team or site'], goal: 'What would a more sustainable operation look like for you?', challenge: 'Where do you see the biggest waste or sustainability challenge today?' },
  general: { title: 'Client needs assessment', topics: ['Your business and current priorities','Goals and measures of progress','What is getting in the way','Timing and readiness for change'], goal: 'What would you most like to accomplish?', challenge: 'What is the main obstacle or uncertainty right now?' },
};

export function IntakePage() {
  const params = new URLSearchParams(window.location.search);
  const directOwnerId = params.get('owner') || '';
  const websiteProfileQuery = useGetPublicWebsiteProfile({
    query: { enabled: !directOwnerId, retry: false },
  });
  const ownerId = directOwnerId || websiteProfileQuery.data?.ownerId || '';
  const profileQuery = useGetPublicLeadSettings(ownerId, { query: { enabled: !!ownerId, queryKey: getGetPublicLeadSettingsQueryKey(ownerId) } });
  const submit = useSubmitPublicLead();
  const [service, setService] = useState<ServiceType | ''>('');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<PublicLeadResult | null>(null);
  const [form, setForm] = useState({name:'', email:'', company:'', website:'', industry:'', goals:'', challenge:'', timeline:'Within the next month'});
  const profile = profileQuery.data;
  const available = profile?.enabledServices || [];
  const content = service ? questionThemes[service] : questionThemes.general;
  const canContinue = step === 0
    ? !!service && !!form.name.trim() && /^\S+@\S+\.\S+$/.test(form.email)
    : step === 1 ? !!form.goals.trim() && !!form.challenge.trim() : true;
  const update = (key: keyof typeof form, value: string) => setForm(current=>({...current,[key]:value}));
  const next = () => setStep(value=>Math.min(2,value+1));
  const previous = () => setStep(value=>Math.max(0,value-1));
  function submitIntake(event: FormEvent) {
    event.preventDefault();
    if (!ownerId || !service) return;
    submit.mutate({ data: { ownerId, name:form.name, email:form.email, company:form.company || null, website:form.website || null, serviceType:service, industry:form.industry || null, goals:form.goals, challenge:form.challenge, timeline:form.timeline } }, { onSuccess: data=>setResult(data) });
  }
  const lookupLoading = directOwnerId
    ? profileQuery.isLoading
    : websiteProfileQuery.isLoading || (!!ownerId && profileQuery.isLoading);
  return <div className="intake-page field-grain">
    <header className="intake-top"><Link href="/" className="logo-link"><Wordmark/></Link><span className="intake-kicker">A THOUGHTFUL FIRST STEP</span></header>
    {lookupLoading ? <div className="intake-centered"><LoadingPanel label="Opening your assessment"/></div> :
       profileQuery.isError || !ownerId || !profile ? <div className="intake-centered"><div className="intake-error"><span className="empty-icon"><FileText/></span><span className="eyebrow">ASSESSMENT NOT FOUND</span><h1>We couldn’t find this assessment link.</h1><p>Check the link you received, or ask Boss Mom Consulting to share a fresh one.</p><Link href="/" className="btn btn-outline"><ArrowLeft size={15}/> Return to Boss Mom Consulting</Link></div></div> :
      result ? <AssessmentResult result={result} profile={profile}/> :
      <main className="intake-content rise-in"><div className="intake-intro"><span className="eyebrow"><span className="eyebrow-line"/>A client assessment by {profile.businessName}</span><h1>Good work starts<br/>with <em>good questions.</em></h1><p>{profile.tagline || 'A few details help us understand your business and make our first conversation useful.'}</p><div className="intake-links">{profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noreferrer"><Globe2 size={14}/>Website</a>}{profile.fiverrUrl && <a href={profile.fiverrUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Fiverr</a>}</div></div>
        <div className="assessment-card"><div className="assessment-progress"><div className="progress-label"><span>ASSESSMENT</span><span>{step+1} <i>/</i> 3</span></div><div className="progress-track"><i style={{width:`${(step+1)/3*100}%`}}/></div></div>
          <form onSubmit={submitIntake}>
            {step===0 && <div className="assessment-step"><span className="eyebrow">01 / YOUR BUSINESS</span><h2>Tell us a little about you.</h2><p className="step-description">Just enough context to make the conversation relevant.</p><div className="form-grid"><label className="form-field"><span>Your name</span><input required maxLength={120} value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Name" data-testid="input-intake-name"/></label><label className="form-field"><span>Email address</span><input type="email" required value={form.email} onChange={e=>update('email',e.target.value)} placeholder="you@business.com" data-testid="input-intake-email"/></label><label className="form-field"><span>Business name <small>Optional</small></span><input value={form.company} onChange={e=>update('company',e.target.value)} placeholder="Your business" data-testid="input-intake-company"/></label><label className="form-field"><span>Website <small>Optional</small></span><input value={form.website} onChange={e=>update('website',e.target.value)} placeholder="yourwebsite.com" data-testid="input-intake-website"/></label><label className="form-field full"><span>Industry <small>Optional</small></span><input value={form.industry} onChange={e=>update('industry',e.target.value)} placeholder="e.g. Hospitality, home services, retail" data-testid="input-intake-industry"/></label></div>
              <div className="service-picker"><span className="field-label">What would you like help with?</span>{available.map(type=><button type="button" className={cx('service-choice',service===type&&'service-choice-active')} key={type} onClick={()=>setService(type)} data-testid={`button-intake-service-${type}`}><OfferMark type={type}/><span className="choice-check">{service===type&&<Check size={13}/>}</span></button>)}</div>
            </div>}
            {step===1 && <div className="assessment-step"><span className="eyebrow">02 / YOUR PRIORITIES</span><h2>{content.title}</h2><p className="step-description">A few prompts help us focus where it matters most.</p><div className="topic-note"><span className="topic-note-icon">{service==='local-seo'?<MapPin size={17}/>:service==='zero-waste'?<Leaf size={17}/>:<Target size={17}/>}</span><div><b>We’ll consider</b><span>{content.topics.join(' · ')}</span></div></div><label className="form-field full question-field"><span>{content.goal}</span><textarea required maxLength={3000} rows={4} value={form.goals} onChange={e=>update('goals',e.target.value)} placeholder="Share a little about the outcome you have in mind…" data-testid="textarea-intake-goals"/></label><label className="form-field full question-field"><span>{content.challenge}</span><textarea required maxLength={3000} rows={4} value={form.challenge} onChange={e=>update('challenge',e.target.value)} placeholder="What’s happening today?" data-testid="textarea-intake-challenge"/></label></div>}
            {step===2 && <div className="assessment-step"><span className="eyebrow">03 / TIMING & REVIEW</span><h2>When are you hoping to begin?</h2><p className="step-description">There’s no wrong answer. This helps us suggest a realistic next step.</p><div className="timeline-options">{['As soon as possible','Within the next month','In 1–3 months','Just exploring for now'].map(option=><button type="button" key={option} onClick={()=>update('timeline',option)} className={cx('timeline-option',form.timeline===option&&'timeline-option-active')}><span className="timeline-radio">{form.timeline===option&&<i/>}</span>{option}</button>)}</div><div className="privacy-note"><span><CheckCircle2 size={17}/></span><p>Your details are shared only with <b>{profile.businessName}</b>, so they can prepare for a useful first conversation.</p></div></div>}
            {submit.isError && <div className="inline-error intake-submit-error">We couldn’t send your assessment. Please try again.</div>}
            <div className="assessment-actions">{step>0 ? <Button variant="quiet" onClick={previous}><ArrowLeft size={15}/> Back</Button> : <span className="assessment-time">ABOUT 2 MINUTES</span>}{step<2 ? <Button onClick={next} disabled={!canContinue}>Continue <ArrowRight size={15}/></Button> : <Button type="submit" disabled={submit.isPending}>{submit.isPending?'Sending assessment…':'Send assessment'} <ArrowRight size={15}/></Button>}</div>
         </form>
         </div><div className="intake-foot"><span>BOSS MOM CONSULTING / CLIENT INTAKE</span><span>Made for useful beginnings <Sprout size={13}/></span></div>
      </main>}
  </div>;
}

function AssessmentResult({ result, profile }: { result: PublicLeadResult; profile: PublicLeadSettings }) {
  return <main className="result-card rise-in">
    <div className="result-seal"><Check size={27}/></div>
    <span className="eyebrow">ASSESSMENT RECEIVED</span>
    <h1>{result.reportTitle || 'A useful first step.'}</h1>
    <p className="result-lead">Thank you for sharing what matters to your business. {result.businessName} now has a clearer picture of where to begin.</p>
    <div className="result-summary"><span className="eyebrow">YOUR CONSULTING BRIEF</span><p>{numberedSummary(result.reportSummary)}</p></div>
    <div className="readiness-row"><span>BRIEF READINESS</span><div className="readiness-meter"><i style={{width:`${result.readinessScore}%`}}/></div><b>{result.readinessScore}<small>/100</small></b></div>
    <p className="score-caption">Based on the detail in your answers—not a technical audit score.</p>
    <div className="result-next"><Sprout size={19}/><span>Your assessment has been submitted and saved for {result.businessName} to review. You can also request a 15-minute consultation below.</span></div>
    <ConsultationRequestForm bookingToken={result.bookingToken} businessName={result.businessName} websiteUrl={profile.websiteUrl}/>
    <div className="result-links">
      {profile.websiteUrl && <a className="btn btn-outline" href={profile.websiteUrl} target="_blank" rel="noreferrer">Visit website <ExternalLink size={14}/></a>}
      {profile.fiverrUrl && <a className="btn btn-solid" href={profile.fiverrUrl} target="_blank" rel="noopener noreferrer">Choose a service on Fiverr <ExternalLink size={14}/></a>}
      <Button className="result-print" variant="outline" onClick={() => window.print()}>Print / save as PDF</Button>
    </div>
    {!profile.fiverrUrl && <p className="fiverr-followup">Boss Mom Consulting will follow up with you about service options.</p>}
    <Link href="/" className="result-back">More about Boss Mom Consulting <ArrowRight size={14}/></Link>
  </main>;
}

function ConsultationRequestForm({
  bookingToken,
  businessName,
  websiteUrl,
}: {
  bookingToken: string;
  businessName: string;
  websiteUrl: string | null | undefined;
}) {
  const request = useRequestConsultation();
  const slots = useMemo(() => getConsultationSlots(), []);
  const availableDates = [...new Map(slots.map((slot) => [slot.date, slot.dateLabel]))];
  const [selectedDate, setSelectedDate] = useState(availableDates[0]?.[0] ?? '');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [meetingType, setMeetingType] = useState<'zoom' | 'phone'>('zoom');
  const [phone, setPhone] = useState('');
  const [requestResult, setRequestResult] = useState<ConsultationRequestResult | null>(null);
  const daySlots = slots.filter((slot) => slot.date === selectedDate);

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) return;
    request.mutate({
      data: {
        bookingToken,
        startsAt: selectedSlot,
        meetingType,
        phone: meetingType === 'phone' ? phone.trim() : null,
      },
    }, { onSuccess: data => setRequestResult(data) });
  }

  return <section className="consultation-offer" aria-labelledby="consultation-heading">
    <span className="eyebrow">OPTIONAL NEXT STEP</span>
    <h2 id="consultation-heading">Request a 15-minute consultation</h2>
    <p className="consultation-intro">Choose a preferred time and how you’d like to meet. This is a request, not a confirmed appointment; the owner must reply before it is booked.</p>
    {requestResult ? <div className="consultation-confirmation" role="status">
      <div className="consultation-confirmation-icon"><CheckCircle2 size={19}/></div>
      <div>
        <b>Your consultation request is saved.</b>
        {requestResult.notificationSent
          ? <p>{businessName} has been notified and will reply to your email to confirm the time. If you chose Zoom, the link will be included in the confirmation.</p>
          : <p>The request is saved, but we couldn’t notify {businessName}. {websiteUrl ? <a href={websiteUrl} target="_blank" rel="noreferrer">Contact the business through its website.</a> : 'Please contact the business directly to confirm.'}</p>}
      </div>
    </div> : slots.length === 0 ? <div className="consultation-confirmation" role="status">
      <div className="consultation-confirmation-icon"><CalendarDays size={19}/></div>
      <div><b>No request times are available right now.</b><p>{websiteUrl ? <a href={websiteUrl} target="_blank" rel="noreferrer">Contact {businessName} through the website.</a> : 'Please check back with the business for a suitable time.'}</p></div>
    </div> : <form className="consultation-form" onSubmit={submitRequest}>
      <div className="consultation-field-row">
        <label className="form-field"><span>Preferred day</span><select required value={selectedDate} onChange={event => { setSelectedDate(event.target.value); setSelectedSlot(''); }}>
          {availableDates.map(([date, label]) => <option key={date} value={date}>{label}</option>)}
        </select></label>
        <label className="form-field"><span>Preferred time <small>Pacific Time</small></span><select required value={selectedSlot} onChange={event => setSelectedSlot(event.target.value)}>
          <option value="" disabled>Select a time</option>
          {daySlots.map(slot => <option key={slot.startsAt} value={slot.startsAt}>{slot.timeLabel}</option>)}
        </select></label>
      </div>
      <span className="field-label">How would you like to meet?</span>
      <div className="consultation-methods">
        <button type="button" className={cx('consultation-method', meetingType === 'zoom' && 'consultation-method-active')} aria-pressed={meetingType === 'zoom'} onClick={() => setMeetingType('zoom')}><Video size={16}/> Zoom</button>
        <button type="button" className={cx('consultation-method', meetingType === 'phone' && 'consultation-method-active')} aria-pressed={meetingType === 'phone'} onClick={() => setMeetingType('phone')}><Phone size={16}/> Phone</button>
      </div>
      {meetingType === 'phone' && <label className="form-field consultation-phone"><span>Phone number</span><input type="tel" autoComplete="tel" required minLength={7} maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} placeholder="Your best callback number"/></label>}
      {request.isError && <p className="inline-error consultation-error" role="alert">We couldn’t save your consultation request. Please try again.</p>}
      <button className="btn btn-solid consultation-submit" type="submit" disabled={request.isPending || !selectedSlot}>{request.isPending ? 'Sending request…' : 'Request this time'} <ArrowRight size={14}/></button>
    </form>}
  </section>;
}

function NeonAuthForm() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed.');
      } else {
        const sessionResult = await authClient.getSession();
        if (sessionResult.error) {
          setError(sessionResult.error.message ?? 'Could not load your account session.');
        } else if (!sessionResult.data?.session) {
          setError('Your session is not ready. Please sign in again.');
        } else {
          setLocation('/dashboard');
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setIsPending(false);
    }
  }

  return <div className="neon-auth-card">
    <div className="neon-auth-heading">
      <h2>Welcome back</h2>
      <p>Pick up where your client work left off.</p>
    </div>
    {error && <div className="neon-auth-error" role="alert">{error}</div>}
    <form className="neon-auth-form" onSubmit={submit}>
      <label className="neon-auth-field">
        <span>Email address</span>
        <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <label className="neon-auth-field">
        <span>Password</span>
        <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <button className="neon-auth-submit" type="submit" disabled={isPending}>{isPending ? 'Please wait…' : 'Sign in'}</button>
    </form>
    <p className="neon-auth-switch"><Link href="/forgot-password">Forgot your password?</Link></p>
  </div>;
}

function AuthPageFrame({ children }: { children: ReactNode }) {
  return <div className="auth-page field-grain"><div className="auth-aside"><Link href="/" className="logo-link"><Wordmark inverse/></Link><div className="auth-quote"><span className="eyebrow">YOUR PRACTICE, IN VIEW</span><h1>Keep the good<br/>work moving.</h1><p>A thoughtful place for every prospect, every detail, and every next step.</p></div><span className="auth-aside-footer">BOSS MOM CONSULTING / WORKSPACE</span></div><div className="auth-main"><Link href="/" className="auth-home"><ArrowLeft size={15}/> Back to Boss Mom Consulting</Link>{children}</div></div>;
}

export function SignInPage() {
  return <AuthPageFrame><NeonAuthForm/></AuthPageFrame>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const redirectTo = `${window.location.origin}${basePath}/reset-password`;
      const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo });
      if (result.error) {
        setError(result.error.message ?? 'Could not send the password reset email. Please try again.');
      } else {
        setIsSent(true);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not send the password reset email. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return <AuthPageFrame><div className="neon-auth-card">
    <div className="neon-auth-heading">
      <h2>Reset your password</h2>
      <p>Enter your account email and we’ll send you a reset link.</p>
    </div>
    {error && <div className="neon-auth-error" role="alert">{error}</div>}
    {isSent ? <div className="neon-auth-notice" role="status">If an account exists for that email, a password reset link is on its way. The link expires after 15 minutes.</div> : <form className="neon-auth-form" onSubmit={submit}>
      <label className="neon-auth-field">
        <span>Email address</span>
        <input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <button className="neon-auth-submit" type="submit" disabled={isPending}>{isPending ? 'Sending link…' : 'Send reset link'}</button>
    </form>}
    <p className="neon-auth-switch"><Link href="/sign-in">Return to sign in</Link></p>
  </div></AuthPageFrame>;
}

export function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const token = new URLSearchParams(window.location.search).get('token');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError('This reset link is invalid or has expired. Request a new one to continue.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setIsPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message ?? 'Could not reset your password. Request a new reset link and try again.');
      } else {
        setIsComplete(true);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not reset your password. Request a new reset link and try again.');
    } finally {
      setIsPending(false);
    }
  }

  return <AuthPageFrame><div className="neon-auth-card">
    <div className="neon-auth-heading">
      <h2>Choose a new password</h2>
      <p>Use at least 8 characters for your new password.</p>
    </div>
    {error && <div className="neon-auth-error" role="alert">{error}</div>}
    {isComplete ? <div className="neon-auth-notice" role="status">Your password has been updated. You can now sign in with your new password.</div> : token ? <form className="neon-auth-form" onSubmit={submit}>
      <label className="neon-auth-field">
        <span>New password</span>
        <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      <label className="neon-auth-field">
        <span>Confirm new password</span>
        <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
      </label>
      <button className="neon-auth-submit" type="submit" disabled={isPending}>{isPending ? 'Updating password…' : 'Update password'}</button>
    </form> : <div className="neon-auth-notice" role="status">This reset link is invalid or has expired. Request a new one to continue.</div>}
    <p className="neon-auth-switch">{isComplete ? <button className="neon-auth-link" type="button" onClick={() => setLocation('/sign-in')}>Return to sign in</button> : <Link href="/forgot-password">Request another reset link</Link>}</p>
  </div></AuthPageFrame>;
}
