import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import './lead-app.css';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser, SignIn, SignUp } from '@clerk/react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness,
  Check, CheckCircle2, ChevronDown, ClipboardCheck, Copy, ExternalLink, FileText,
  Filter, Globe2, Leaf, Link2, LoaderCircle, MapPin, Menu, MessageSquareText,
  Plus, Search, Settings2, Sprout, Target, Trash2, TrendingUp,
  UserRound, X,
} from 'lucide-react';
import {
  getGetLeadInsightsQueryKey, getGetLeadQueryKey, getGetLeadSettingsQueryKey, getGetPublicLeadSettingsQueryKey,
  getGetPublicWebsiteProfileQueryKey,
  getListLeadsQueryKey, useCreateLead, useDeleteLead, useGetLead,
  useGetLeadInsights, useGetLeadSettings, useGetPublicLeadSettings, useGetPublicWebsiteProfile,
  useHealthCheck, useListLeads, useSubmitPublicLead, useUpdateLead,
  useUpdateLeadSettings,
} from '@workspace/api-client-react';
import type {
  Lead, LeadInsights, LeadSettingsInput, LeadStage, PublicLeadResult, PublicLeadSettings, ServiceType,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
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
  return <div className={cx('wordmark', inverse && 'wordmark-inverse')} aria-label="Boss Mom Consulting"><span className="mark-icon">BM</span><span className="wordmark-name"><span>Boss Mom</span><i>Consulting</i></span></div>;
}

function PublicNav({ showIntake = false }: { showIntake?: boolean }) {
  return <header className="public-nav"><Link href="/" className="logo-link"><Wordmark/></Link><nav className="public-nav-links" aria-label="Main navigation"><Link href="/about">About</Link><a href="/#services">Services</a>{showIntake && <Link href="/intake" className="public-nav-cta">Start an assessment</Link>}<Link href="/sign-in" className="text-link" data-testid="link-sign-in">Owner sign in <ArrowRight size={15}/></Link></nav></header>;
}

function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
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
        <button className="profile-control" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out">
          <span className="avatar-initial">{user?.firstName?.[0] ?? 'B'}</span><span className="profile-text"><b>{user?.firstName || 'Your account'}</b><small>Sign out</small></span><ArrowDownRight size={15}/>
        </button>
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
function LeadRow({ lead }: { lead: Lead }) {
  return <Link href={`/leads/${lead.id}`} className="lead-row" data-testid={`link-lead-${lead.id}`}>
    <span className="lead-avatar">{lead.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}</span>
    <span className="lead-person"><b>{lead.name}</b><small>{lead.company || lead.email}</small></span>
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
    <section className="hero public-container" id="about">
      <div className="hero-copy rise-in"><span className="eyebrow"><span className="eyebrow-line"/>Boss Mom Consulting</span><h1>Practical support<br/><em>for your business.</em></h1><p className="hero-intro">Thoughtful consulting for local visibility, sustainability, and the next business decision in front of you. Start with what matters most and leave with a clearer next step.</p>
        <div className="hero-actions">{profile && <Link href="/intake" className="btn btn-solid" data-testid="link-public-intake">Tell me about your business <ArrowRight size={16}/></Link>}{profile?.fiverrUrl && <a href={profile.fiverrUrl} className="btn btn-outline" target="_blank" rel="noopener noreferrer">Explore services on Fiverr <ExternalLink size={15}/></a>}</div>
        <div className="trust-note"><span className="trust-rule"/>Flexible support for small businesses</div>
      </div>
      <div className="hero-visual rise-in delay-2" aria-label="Boss Mom Consulting office">
        <div className="hero-photo-frame">
          <img src="/boss-mom-office.jpeg" alt="Boss Mom Consulting office with an orchid, warm wood desk, and client seating"/>
          <div className="hero-photo-caption"><span>Boss Mom Consulting</span><b>Good work starts with the right questions.</b></div>
        </div>
        <div className="photo-seal" aria-hidden="true"><b>BM</b><span>CONSULTING</span></div>
      </div>
    </section>
    <section className="offer-strip" id="services"><div className="public-container offer-strip-inner"><span className="eyebrow">Products &amp; services</span><div className="offer-catalog"><div><MapPin/><b>Local SEO / GEO</b><small>Improve local search visibility, business listings, and your presence in AI-powered search.</small></div><div><Leaf/><b>Zero-waste consulting</b><small>Review waste streams and find realistic opportunities to reduce, reuse, and divert.</small></div><div><Target/><b>Business needs assessment</b><small>Clarify priorities, goals, and the right scope for your next project.</small></div></div></div></section>
    <section className="public-how public-container"><div><span className="eyebrow">A practical approach</span><h2>Clear priorities.<br/><em>Useful next steps.</em></h2></div><div className="how-steps"><article><span>01</span><h3>Start with your goals</h3><p>Share what your business is working toward and what is getting in the way.</p></article><article><span>02</span><h3>Focus on your needs</h3><p>Choose local visibility, zero-waste support, or a broader business assessment.</p></article><article><span>03</span><h3>Choose how to work together</h3><p>Review the suggested next step, then continue through the website or Fiverr.</p></article></div></section>
    <section className="closing-band"><div className="public-container closing-inner"><div><span className="eyebrow">Ready to talk about your business?</span><h2>Start with a clear<br/>first conversation.</h2></div>{profile ? <Link href="/intake" className="btn btn-brass">Start your assessment <ArrowRight size={16}/></Link> : <p className="website-intake-note">The online assessment is being prepared. Please check back soon.</p>}</div></section>
    <footer className="public-footer public-container"><Wordmark/><span>Boss Mom Consulting · practical support for your next step.</span><Link href="/sign-in">Owner sign in <ArrowRight size={14}/></Link></footer>
  </div>;
}

export function DashboardPage() {
  const insights = useGetLeadInsights();
  const leads = useListLeads();
  const health = useHealthCheck();
  const data = insights.data as LeadInsights | undefined;
  const recent = [...(leads.data || [])].sort((a,b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0,5);
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
        {leads.isLoading ? <div className="list-skeletons">{[1,2,3].map(x=><div className="skeleton skeleton-row" key={x}/>)}</div> : leads.isError ? <ErrorPanel retry={() => leads.refetch()} message="Recent leads could not be loaded."/> : recent.length === 0 ? <EmptyPanel title="Your next conversation starts here" detail="Share your intake link and your first lead will appear here." action={<Link className="btn btn-outline" href="/settings">Set up your intake link <ArrowRight size={15}/></Link>}/> : <div className="lead-list">{recent.map(lead=><LeadRow key={lead.id} lead={lead}/>)}</div>}
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
  const filtered = useMemo(() => (leadsQuery.data || []).filter(lead => {
    const term = search.toLowerCase();
    const matches = `${lead.name} ${lead.email} ${lead.company || ''}`.toLowerCase().includes(term);
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
  return <AppShell active="/leads"><div className="page-content detail-page">
    <Link href="/leads" className="back-link"><ArrowLeft size={15}/> Back to lead book</Link>
     <section className="detail-cover"><div className="detail-heading"><span className="lead-avatar lead-avatar-large">{lead.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</span><div><span className="eyebrow">CLIENT BRIEF / {String(lead.id).padStart(4,'0')}</span><h1>{lead.name}</h1><div className="detail-meta"><span>{lead.company || lead.email}</span><span className="meta-divider">/</span><OfferMark type={lead.serviceType}/></div></div><div className="detail-actions"><Button variant="danger" onClick={remove} disabled={deleteLead.isPending}><Trash2 size={15}/>{deleteLead.isPending ? 'Deleting…' : 'Delete lead'}</Button></div></div>
      <div className="detail-bottom"><div><span className="eyebrow">ARRIVED</span><b>{dateLabel(lead.createdAt)}</b></div><div><span className="eyebrow">READINESS</span><b>{lead.readinessScore}<small> / 100</small></b></div><div><span className="eyebrow">TIMELINE</span><b>{lead.timeline}</b></div><div><span className="eyebrow">CURRENT STAGE</span><StagePill stage={lead.stage}/></div></div>
    </section>
    {deleteLead.isError && <div className="inline-error">This lead could not be deleted. Please try again.</div>}
    <div className="detail-columns"><div className="detail-main">
      <section className="paper-panel report-panel"><div className="panel-heading"><div><span className="eyebrow">THE CLIENT’S OWN WORDS</span><h2>What they’re working toward</h2></div><FileText size={19}/></div><div className="report-text">{lead.reportSummary || 'No report summary was included with this assessment.'}</div>
        <div className="report-prompt"><div><span className="eyebrow">THE GOAL</span><p>{lead.goals}</p></div><div><span className="eyebrow">THE CHALLENGE</span><p>{lead.challenge}</p></div></div>
        <div className="report-contact"><span><UserRound size={15}/>{lead.name}</span><a href={`mailto:${lead.email}`}>{lead.email} <ExternalLink size={13}/></a>{lead.website && <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer"><Globe2 size={14}/>Website</a>}</div>
      </section>
       <section className="paper-panel notes-panel"><div className="panel-heading"><div><span className="eyebrow">PRIVATE TO YOUR PRACTICE</span><h2>Working notes</h2></div><MessageSquareText size={19}/></div><textarea value={notesValue} onChange={e=>setNotes(e.target.value)} placeholder="Capture context, questions to ask, or a next step…" rows={5} data-testid="textarea-lead-notes"/><div className="notes-bottom"><small>Only visible in your workspace.</small><Button onClick={()=>update({notes:notesValue})} disabled={updateLead.isPending}>{updateLead.isPending ? 'Saving…' : 'Save notes'}</Button></div>{updateLead.isError && <div className="inline-error">Notes could not be saved.</div>}</section>
    </div><aside className="detail-side"><span className="eyebrow">NEXT STEP</span><h3>Keep the conversation moving.</h3><p>Move this lead as you follow up. The right stage makes tomorrow’s list clearer.</p><label className="stage-select-label">Pipeline stage<select value={lead.stage} disabled={updateLead.isPending} onChange={e=>update({stage:e.target.value as LeadStage})} data-testid="select-lead-stage">{stages.map(stage=><option key={stage} value={stage}>{stageLabel[stage]}</option>)}</select></label><div className="pipeline-steps">{stages.slice(0,4).map((stage,index)=><div className={cx('pipeline-step', stages.indexOf(lead.stage)>=index && lead.stage !== 'lost' && 'pipeline-done')} key={stage}><span>{stages.indexOf(lead.stage)>index ? <Check size={12}/> : index+1}</span>{stageLabel[stage]}</div>)}</div><div className="side-tip"><Sprout size={17}/><span>A timely, specific follow-up is usually more useful than a perfect one.</span></div>{updateLead.isError && <div className="inline-error">Stage could not be changed.</div>}</aside></div>
  </div></AppShell>;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useUser();
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
    <div className="result-summary"><span className="eyebrow">YOUR CONSULTING BRIEF</span><p>{result.reportSummary}</p></div>
    <div className="readiness-row"><span>BRIEF READINESS</span><div className="readiness-meter"><i style={{width:`${result.readinessScore}%`}}/></div><b>{result.readinessScore}<small>/100</small></b></div>
    <p className="score-caption">Based on the detail in your answers—not a technical audit score.</p>
    <div className="result-next"><Sprout size={19}/><span>Your assessment has been saved for {result.businessName} to review. For service options, continue to Fiverr.</span></div>
    <div className="result-links">
      {profile.websiteUrl && <a className="btn btn-outline" href={profile.websiteUrl} target="_blank" rel="noreferrer">Visit website <ExternalLink size={14}/></a>}
      {profile.fiverrUrl && <a className="btn btn-solid" href={profile.fiverrUrl} target="_blank" rel="noopener noreferrer">Choose a service on Fiverr <ExternalLink size={14}/></a>}
      <Button className="result-print" variant="outline" onClick={() => window.print()}>Print / save as PDF</Button>
    </div>
    {!profile.fiverrUrl && <p className="fiverr-followup">Boss Mom Consulting will follow up with you about service options.</p>}
    <Link href="/" className="result-back">More about Boss Mom Consulting <ArrowRight size={14}/></Link>
  </main>;
}

export function SignInPage() {
  return <div className="auth-page field-grain"><div className="auth-aside"><Link href="/" className="logo-link"><Wordmark inverse/></Link><div className="auth-quote"><span className="eyebrow">YOUR PRACTICE, IN VIEW</span><h1>Keep the good<br/>work moving.</h1><p>A thoughtful place for every prospect, every detail, and every next step.</p></div><span className="auth-aside-footer">BOSS MOM CONSULTING / WORKSPACE</span></div><div className="auth-main"><Link href="/" className="auth-home"><ArrowLeft size={15}/> Back to Boss Mom Consulting</Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></div>;
}
export function SignUpPage() {
  return <div className="auth-page field-grain"><div className="auth-aside"><Link href="/" className="logo-link"><Wordmark inverse/></Link><div className="auth-quote"><span className="eyebrow">A BETTER FIRST CONVERSATION</span><h1>Make space for<br/>better client work.</h1><p>Set up your practice profile and build an intake that asks the right things.</p></div><span className="auth-aside-footer">BOSS MOM CONSULTING / WORKSPACE</span></div><div className="auth-main"><Link href="/" className="auth-home"><ArrowLeft size={15}/> Back to Boss Mom Consulting</Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></div>;
}
