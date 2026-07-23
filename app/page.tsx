'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { buildPdfBytes, buildReleasePackageBytes, type PdfKind } from './pdf-generator';

type Project = {
  id: string;
  name: string;
  client: string;
  customerId: string;
  contactIds: string[];
  versionDate: string;
  status: string;
  systems: string[];
  revision: string;
  modified: string;
  contract: ContractDetails;
};

type ContractDetails = {
  offering: string;
  engagement: string;
  tier: string;
  contractNumber: string;
  amount: string;
  status: string;
  startDate: string;
  targetDate: string;
  notes: string;
};

type CalendarEntry = {
  id: string;
  date: string;
  title: string;
  type: string;
  projectId: string;
};

type CustomerContact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
};

type Customer = {
  id: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  notes: string;
  contacts: CustomerContact[];
};

type ReleaseSelection = {
  mode: 'download' | 'email';
  kinds: PdfKind[];
  notes: string;
};

type Issue = {
  uid: string;
  id: string;
  system: string;
  customSystem: string;
  title: string;
  status: string;
  concern: string;
  rfiQuestion: string;
  basis: string;
  reason: string;
  reference: string;
  rfi: string;
  resolution: string;
  snippet: string;
  sow: boolean;
  clarification: boolean;
  formalRfi: boolean;
  checklist: boolean;
  checklistItem: string;
  response: string;
  responseReason: string;
};

type Template = { uid: string; name: string; issue: Omit<Issue, 'uid' | 'id' | 'rfi' | 'snippet'> };
type Doc = {
  id: string;
  type: string;
  name: string;
  revision: string;
  date: string;
  current: boolean;
  notes: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
};
type ExportEntry = { id: string; fileName: string; deliverable: string; downloadedAt: string; projectRevision: string };
type View = 'projects' | 'dashboard' | 'setup' | 'internal' | 'documents' | 'notes' | 'sow' | 'clarifications' | 'rfi' | 'checklist' | 'leveling' | 'snippets' | 'customers' | 'exports' | 'email' | 'standards';
type DialogState =
  | { kind: 'message'; title: string; message: string; confirmLabel?: string }
  | { kind: 'confirm'; title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void> }
  | { kind: 'input'; title: string; message: string; initialValue: string; placeholder?: string; confirmLabel?: string; onConfirm: (value: string) => void | Promise<void> };

type PreviewState = { title: string; url: string; mode?: 'pdf' | 'image' } | null;

type EmailSettings = {
  defaultFrom: string;
  additionalFrom: string[];
  replyTo: string;
};

type EmailDraft = {
  filename: string;
  deliverable: string;
  attachmentBase64: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  message: string;
};


const SYSTEM_OPTIONS = ['Structured Cabling', 'Network Electronics', 'CCTV', 'Access Control', 'Intrusion Detection', 'Fire Alarm', 'Video Intercom', 'Audio Visual', 'Paging / Intercom', 'Other'];
const PROJECT_STATUS_OPTIONS = ['Planning', 'Document Review', 'Bidding', 'Under Review', 'Award Support', 'Construction', 'Complete', 'On Hold', 'Archived'];
const ISSUE_STATUS_OPTIONS = ['Open', 'Under Review', 'Answered', 'Closed'];
const DOCUMENT_TYPES = ['Drawings', 'Specifications', 'Addendums', 'Revisions', 'Narratives', 'General Bid Documents', 'Contractor Checklist'];
const RESPONSE_OPTIONS = ['Included', 'Excluded', 'Included as Alternate', 'Clarification Required', 'Not Applicable'];
const CONTRACT_OFFERINGS = [
  'Product 1 — Technology Scope & Risk Assessment',
  'Product 2 — Bid Analysis & Budget Validation',
  'Product 3 — Procurement & Award Support',
  'Product 4 — Technology Project Advisory Services',
  'Custom Engagement',
];
const CONTRACT_STATUS_OPTIONS = ['Draft', 'Proposal Sent', 'Under Review', 'Executed', 'In Progress', 'Complete', 'Cancelled'];
const CALENDAR_EVENT_TYPES = ['Bid / Proposal Due', 'Document Review', 'Client Meeting', 'RFI Deadline', 'Contract Milestone', 'Delivery Date', 'Other'];

const blankContract = (): ContractDetails => ({
  offering: 'Product 1 — Technology Scope & Risk Assessment',
  engagement: 'Standalone',
  tier: 'Range',
  contractNumber: '',
  amount: '',
  status: 'Draft',
  startDate: '',
  targetDate: '',
  notes: '',
});

const blankProject = (id: string): Project => ({ id, name: 'New ScopeLogic Project', client: '', customerId: '', contactIds: [], versionDate: new Date().toISOString().slice(0, 10), status: 'Planning', systems: [], revision: 'Rev 0', modified: 'Now', contract: blankContract() });
const blankCustomer = (): Customer => ({ id: crypto.randomUUID(), name: '', address1: '', address2: '', city: '', state: '', zip: '', website: '', notes: '', contacts: [] });
const blankCustomerContact = (): CustomerContact => ({ id: crypto.randomUUID(), name: '', title: '', email: '', phone: '' });
const blankIssue = (number: number): Issue => ({ uid: crypto.randomUUID(), id: `SLR-${String(number).padStart(3, '0')}`, system: 'Structured Cabling', customSystem: '', title: '', status: 'Open', concern: '', rfiQuestion: '', basis: '', reason: '', reference: '', rfi: '', resolution: '', snippet: '', sow: true, clarification: true, formalRfi: false, checklist: false, checklistItem: '', response: 'Included', responseReason: '' });
const cloneIssue = (issue: Issue): Issue => JSON.parse(JSON.stringify(issue));
const systemName = (issue: Issue) => (issue.system === 'Other' ? issue.customSystem || 'Other' : issue.system);
const normalizeIssues = (items: Issue[]) => {
  let rfiNumber = 0;
  let snippetNumber = 0;
  return items.map((item, index) => ({
    ...item,
    id: `SLR-${String(index + 1).padStart(3, '0')}`,
    rfi: item.formalRfi ? `RFI-${String(++rfiNumber).padStart(3, '0')}` : '',
    snippet: item.snippet ? `SNP-${String(++snippetNumber).padStart(3, '0')}` : '',
  }));
};
const normalizeProject = (project: Partial<Project> & { id: string } & { bidDate?: string }): Project => ({
  ...blankProject(project.id),
  ...project,
  versionDate: project.versionDate || project.bidDate || new Date().toISOString().slice(0, 10),
  systems: Array.isArray(project.systems) ? project.systems : String(project.systems || '').split(',').map((item) => item.trim()).filter(Boolean),
  customerId: project.customerId || '',
  contactIds: Array.isArray(project.contactIds) ? project.contactIds : [],
  revision: project.revision || 'Rev 0',
  contract: { ...blankContract(), ...(project.contract || {}) },
});

const normalizeIssue = (issue: Partial<Issue> & Pick<Issue, 'uid' | 'id'>): Issue => {
  const checklistItem = issue.checklistItem ?? (issue.checklist ? issue.title || '' : '');
  return {
    ...blankIssue(1),
    ...issue,
    rfiQuestion: issue.rfiQuestion ?? (issue.formalRfi ? issue.concern || '' : ''),
    checklistItem,
    checklist: Boolean(checklistItem.trim()),
  };
};

const contractEngagementOptions = (offering: string) => {
  if (offering.startsWith('Product 2')) return ['Standalone', 'Add-On After Product 1'];
  if (offering.startsWith('Product 3')) return ['Standalone', 'Add-On After Prior ScopeLogic Service'];
  if (offering.startsWith('Product 4')) return ['Monthly Retainer'];
  if (offering === 'Custom Engagement') return ['Custom'];
  return ['Standalone'];
};

const contractTierOptions = (offering: string) => {
  if (offering.startsWith('Product 2')) return ['Small', 'Medium', 'Large'];
  if (offering.startsWith('Product 4')) return ['Light', 'Standard', 'Advanced'];
  if (offering === 'Custom Engagement') return ['Custom'];
  return ['Range'];
};

const pricingGuidance = (contract: ContractDetails) => {
  if (contract.offering.startsWith('Product 1')) return '$3,000–$10,000 standalone';
  if (contract.offering.startsWith('Product 2')) {
    const standalone: Record<string, string> = { Small: '$3,500', Medium: '$5,500', Large: '$8,500+' };
    const addon: Record<string, string> = { Small: '$2,000', Medium: '$3,500', Large: '$5,000' };
    return contract.engagement.startsWith('Add-On') ? `${addon[contract.tier] || '$2,000–$5,000'} add-on` : `${standalone[contract.tier] || '$3,500–$8,500+'} standalone`;
  }
  if (contract.offering.startsWith('Product 3')) return contract.engagement.startsWith('Add-On') ? '$2,500–$6,000 add-on' : '$4,000–$9,000 standalone';
  if (contract.offering.startsWith('Product 4')) {
    const retainers: Record<string, string> = { Light: '$2,000–$3,500/month', Standard: '$3,500–$6,500/month', Advanced: '$6,500–$12,000+/month' };
    return `${retainers[contract.tier] || '$2,000–$12,000+/month'}; $3,000–$10,000 onboarding when no prior ScopeLogic service exists`;
  }
  return 'Custom pricing';
};

const dateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const parseAddresses = (value: string) => value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);

const navDeliverables: [View, string][] = [
  ['sow', 'Recommended SOW Matrix'],
  ['clarifications', 'Clarification Matrix'],
  ['rfi', 'Formal RFI'],
  ['checklist', 'Contractor Response Checklist'],
  ['leveling', 'Bid Leveling Summary'],
  ['snippets', 'Snippet Register'],
];

const RELEASE_OPTIONS: { kind: PdfKind; label: string }[] = [
  { kind: 'sow', label: 'Recommended SOW Matrix' },
  { kind: 'clarifications', label: 'Clarification Matrix' },
  { kind: 'rfi', label: 'Formal RFI' },
  { kind: 'checklist', label: 'Contractor Response Checklist' },
  { kind: 'snippets', label: 'Snippet Register' },
];
const ALL_RELEASE_KINDS = RELEASE_OPTIONS.map((item) => item.kind);

function openFileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('scopelogic-project-files', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('files')) database.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeFile(key: string, file: Blob) {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('files', 'readwrite');
    transaction.objectStore('files').put(file, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function readStoredFile(key: string) {
  const database = await openFileDatabase();
  const result = await new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction('files', 'readonly').objectStore('files').get(key);
    request.onsuccess = () => resolve((request.result as Blob) || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result;
}

async function removeStoredFile(key: string) {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('files', 'readwrite');
    transaction.objectStore('files').delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export default function Home() {
  const [view, setView] = useState<View>('projects');
  const [projects, setProjects] = useState<Project[]>([blankProject('p1')]);
  const [projectId, setProjectId] = useState('p1');
  const [issuesByProject, setIssuesByProject] = useState<Record<string, Issue[]>>({ p1: [] });
  const [docsByProject, setDocsByProject] = useState<Record<string, Doc[]>>({ p1: [] });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedUid, setSelectedUid] = useState('');
  const [draft, setDraft] = useState<Issue | null>(null);
  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tab, setTab] = useState<'details' | 'snippets' | 'deliverables' | 'history'>('details');
  const [mobileNav, setMobileNav] = useState(false);
  const [pdfUrls, setPdfUrls] = useState<Partial<Record<PdfKind, string>>>({});
  const [preview, setPreview] = useState<PreviewState>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notesByProject, setNotesByProject] = useState<Record<string, string>>({ p1: '' });
  const [exportsByProject, setExportsByProject] = useState<Record<string, ExportEntry[]>>({ p1: [] });
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({ defaultFrom: '', additionalFrom: [], replyTo: '' });
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [releaseSelection, setReleaseSelection] = useState<ReleaseSelection | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('scopelogic-r14-8') || localStorage.getItem('scopelogic-r14-7') || localStorage.getItem('scopelogic-r14-6') || localStorage.getItem('scopelogic-r14-5') || localStorage.getItem('scopelogic-r14-4') || localStorage.getItem('scopelogic-r14-3') || localStorage.getItem('scopelogic-r14-2');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const restoredProjects = (data.projects || [blankProject('p1')]).map((item: Project) => normalizeProject(item));
      setProjects(restoredProjects);
      setProjectId(data.projectId || restoredProjects[0]?.id || 'p1');
      const restoredIssues = Object.fromEntries(Object.entries(data.issuesByProject || { p1: [] }).map(([id, items]) => [id, normalizeIssues((items as Issue[]).map((item) => normalizeIssue(item)))]));
      setIssuesByProject(restoredIssues);
      setDocsByProject(data.docsByProject || { p1: [] });
      setTemplates(data.templates || []);
      setNotesByProject(data.notesByProject || { p1: '' });
      setExportsByProject(data.exportsByProject || { p1: [] });
      setEmailSettings(data.emailSettings || { defaultFrom: '', additionalFrom: [], replyTo: '' });
      setCalendarEntries(data.calendarEntries || []);
      setCustomers(data.customers || []);
    } catch {
      setDialog({ kind: 'message', title: 'Saved Data Could Not Be Loaded', message: 'ScopeLogic started with a clean local workspace because the saved browser data was unreadable.' });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('scopelogic-r14-8', JSON.stringify({ projects, projectId, issuesByProject, docsByProject, templates, notesByProject, exportsByProject, emailSettings, calendarEntries, customers }));
  }, [projects, projectId, issuesByProject, docsByProject, templates, notesByProject, exportsByProject, emailSettings, calendarEntries, customers]);


  const project = projects.find((item) => item.id === projectId) || projects[0];
  const issues = issuesByProject[projectId] || [];
  const docs = docsByProject[projectId] || [];
  const internalNotes = notesByProject[projectId] || '';
  const exportEntries = exportsByProject[projectId] || [];
  const setIssues = (change: (items: Issue[]) => Issue[]) => setIssuesByProject((current) => ({ ...current, [projectId]: normalizeIssues(change(current[projectId] || [])) }));
  const setDocs = (change: (items: Doc[]) => Doc[]) => setDocsByProject((current) => ({ ...current, [projectId]: change(current[projectId] || []) }));
  const systems = useMemo(() => ['All', ...Array.from(new Set(issues.map(systemName)))], [issues]);
  const filtered = issues.filter((issue) =>
    (systemFilter === 'All' || systemName(issue) === systemFilter) &&
    (statusFilter === 'All' || issue.status === statusFilter) &&
    `${issue.id} ${systemName(issue)} ${issue.title} ${issue.reference} ${issue.rfi}`.toLowerCase().includes(search.toLowerCase()),
  );

  const message = (title: string, body: string) => setDialog({ kind: 'message', title, message: body });
  const confirmAction = (title: string, body: string, onConfirm: () => void | Promise<void>, confirmLabel = 'Confirm', danger = false) => setDialog({ kind: 'confirm', title, message: body, onConfirm, confirmLabel, danger });
  const requestInput = (title: string, body: string, initialValue: string, onConfirm: (value: string) => void | Promise<void>, confirmLabel = 'Save') => setDialog({ kind: 'input', title, message: body, initialValue, onConfirm, confirmLabel });

  const newDraft = (template?: Template) => {
    const issue = blankIssue(issues.length + 1);
    if (template) Object.assign(issue, JSON.parse(JSON.stringify(template.issue)));
    setDraft(issue);
    setSelectedUid('');
    setView('internal');
  };

  const editIssue = (uid: string) => {
    const issue = issues.find((item) => item.uid === uid);
    if (issue) {
      setSelectedUid(uid);
      setDraft(cloneIssue(issue));
    }
  };

  const submit = () => {
    if (!draft) return;
    if (!draft.title.trim()) return message('Scope Item Required', 'Enter a Scope Item / Short Description before submitting this SLR.');
    if (draft.system === 'Other' && !draft.customSystem.trim()) return message('Other System Required', 'Define the custom system before submitting this SLR.');
    if (draft.formalRfi && !draft.rfiQuestion.trim()) return message('RFI Question Required', 'Enter the formal RFI question before submitting an SLR assigned to Formal RFI.');
    if (draft.response !== 'Included' && !draft.responseReason.trim()) return message('Contractor Response Reason Required', 'A reason is required when the Contractor Response is anything other than Included.');
    const isNewEntry = !selectedUid;
    const savedId = draft.id;
    const submittedDraft = { ...draft, checklistItem: draft.checklistItem.trim(), checklist: Boolean(draft.checklistItem.trim()) };
    setIssues((items) => selectedUid ? items.map((item) => item.uid === selectedUid ? { ...submittedDraft, uid: selectedUid } : item) : [...items, submittedDraft]);
    setSelectedUid('');
    setDraft(isNewEntry ? blankIssue(issues.length + 2) : null);
    setPdfUrls({});
    message('Saved', `${savedId} was submitted to the Internal Matrix. The new-entry fields have been cleared.`);
  };

  const deleteEntry = () => {
    if (draft && !selectedUid) {
      return confirmAction('Discard Draft?', 'This unsubmitted draft will be discarded and no SLR number will be consumed.', () => setDraft(null), 'Discard Draft', true);
    }
    if (!selectedUid) return;
    confirmAction('Delete Submitted SLR?', 'The SLR will be deleted and all later SLR, RFI, and snippet numbers will be renumbered automatically.', () => {
      setIssues((items) => items.filter((item) => item.uid !== selectedUid));
      setSelectedUid('');
      setDraft(null);
      setPdfUrls({});
    }, 'Delete SLR', true);
  };

  const saveTemplate = () => {
    if (!draft) return;
    requestInput('Save SLR Template', 'Enter a reusable template name. This template will be available in every project.', draft.title || 'Saved SLR Template', (value) => {
      const name = value.trim();
      if (!name) return message('Template Name Required', 'Enter a name before saving the template.');
      const { uid, id, rfi, snippet, ...issue } = draft;
      setTemplates((items) => [...items, { uid: crypto.randomUUID(), name, issue }]);
      message('Saved', `The global SLR template "${name}" was saved.`);
    }, 'Save Template');
  };

  const requestDeleteTemplate = (template: Template) => {
    confirmAction('Delete SLR Template?', `Delete the global template "${template.name}"? This does not remove SLRs already created from it.`, () => setTemplates((items) => items.filter((item) => item.uid !== template.uid)), 'Delete Template', true);
  };

  const addProject = () => {
    const id = `p${Date.now()}`;
    setProjects((items) => [...items, blankProject(id)]);
    setIssuesByProject((items) => ({ ...items, [id]: [] }));
    setDocsByProject((items) => ({ ...items, [id]: [] }));
    setNotesByProject((items) => ({ ...items, [id]: '' }));
    setExportsByProject((items) => ({ ...items, [id]: [] }));
    setProjectId(id);
    setSelectedUid('');
    setDraft(null);
    setView('setup');
  };

  const updatePdf = async (kind: PdfKind, title: string) => {
    try {
      const bytes = await buildPdfBytes(kind, project, issues);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrls((current) => {
        if (current[kind]) URL.revokeObjectURL(current[kind]!);
        return { ...current, [kind]: url };
      });
      setPreview({ title, url, mode: 'pdf' });
    } catch (error) {
      message('PDF Generation Failed', error instanceof Error ? error.message : 'The PDF could not be generated.');
    }
  };

  const recordDownload = (fileName: string, deliverable: string) => {
    const entry: ExportEntry = { id: crypto.randomUUID(), fileName, deliverable, downloadedAt: new Date().toLocaleString(), projectRevision: project.revision || 'Rev 0' };
    setExportsByProject((current) => ({ ...current, [projectId]: [entry, ...(current[projectId] || [])] }));
  };

  const releaseFileName = () => `${project.name.replace(/[^a-z0-9]+/gi, '_') || 'ScopeLogic'}_${project.revision.replace(/[^a-z0-9]+/gi, '_')}_Official_Release.pdf`;

  const downloadReleasePackage = async (kinds: PdfKind[] = ALL_RELEASE_KINDS, notes = '') => {
    try {
      if (!kinds.length) return message('Select Deliverables', 'Choose at least one deliverable for the official release.');
      const bytes = await buildReleasePackageBytes(project, issues, kinds, notes);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const fileName = releaseFileName();
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      recordDownload(fileName, 'Official GC Release Package');
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      message('Saved', 'The selected official GC release package was generated and downloaded.');
    } catch (error) {
      message('Official Release Failed', error instanceof Error ? error.message : 'The combined PDF package could not be generated.');
    }
  };

  const prepareEmail = async (kind: PdfKind | 'release', deliverable: string, releaseKinds: PdfKind[] = ALL_RELEASE_KINDS, releaseNotes = '') => {
    try {
      const bytes = kind === 'release' ? await buildReleasePackageBytes(project, issues, releaseKinds, releaseNotes) : await buildPdfBytes(kind, project, issues);
      const filename = kind === 'release' ? releaseFileName() : `${deliverable.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
      setEmailDraft({
        filename,
        deliverable,
        attachmentBase64: bytesToBase64(bytes),
        from: emailSettings.defaultFrom,
        to: '',
        cc: '',
        subject: `${project.name} - ${deliverable} - ${project.revision}`,
        message: `Attached is the ${deliverable} for ${project.name}, ${project.revision}, dated ${project.versionDate}.`,
      });
    } catch (error) {
      message('Email Attachment Failed', error instanceof Error ? error.message : 'The PDF attachment could not be prepared.');
    }
  };

  const sendEmail = async (draftToSend: EmailDraft) => {
    setEmailSending(true);
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draftToSend,
          to: parseAddresses(draftToSend.to),
          cc: parseAddresses(draftToSend.cc),
          replyTo: emailSettings.replyTo,
          approvedFrom: Array.from(new Set([emailSettings.defaultFrom, ...emailSettings.additionalFrom].filter(Boolean))),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The email service rejected the message.');
      setEmailDraft(null);
      setEmailSending(false);
      window.setTimeout(() => message('Sent', `${draftToSend.filename} was sent successfully.`), 25);
    } catch (error) {
      message('Email Could Not Be Sent', error instanceof Error ? error.message : 'Check the email-service configuration and try again.');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
        <div className="brand"><div className="brand-mark"><img src="/brand/scopelogic-logo-mark.png" alt="ScopeLogic" /></div><div><div className="brand-name-box"><img className="brand-wordmark" src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /></div><span>Revision 14.8</span></div></div>
        <button className="project-switch" onClick={() => setView('projects')}><span>Current project</span><b>{project.name}</b><small>Switch projects</small></button>
        <Nav label="PROJECT" items={[["projects", "Project Library"], ["dashboard", "Dashboard"], ["setup", "Project Setup"]]} view={view} setView={setView} />
        <Nav label="WORKSPACE" items={[["internal", "ScopeLogic Internal Matrix"], ["documents", "Project Documents"], ["notes", "Internal Notes"]]} view={view} setView={setView} />
        <Nav label="DELIVERABLES" items={navDeliverables} view={view} setView={setView} />
        <Nav label="ADMINISTRATION" items={[["customers", "Customer Database"], ["exports", "Export Log"], ["email", "Email Settings"], ["standards", "ScopeLogic Standards"]]} view={view} setView={setView} />
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}>Menu</button>
          <div><span>{project.client || 'ScopeLogic project'}</span><b>{project.name}</b></div>
          <div className="top-actions"><button className="secondary" onClick={() => setReleaseSelection({ mode: 'download', kinds: [...ALL_RELEASE_KINDS], notes: '' })}>Generate All PDFs</button><button className="secondary" onClick={() => setReleaseSelection({ mode: 'email', kinds: [...ALL_RELEASE_KINDS], notes: '' })}>Email All PDFs</button><button className="secondary" onClick={() => setView('documents')}>Documents</button></div>
        </header>
        <div className="page">
          {view === 'projects' && <ProjectLibrary projects={projects} active={projectId} entries={calendarEntries} open={(id) => { setProjectId(id); setSelectedUid(''); setDraft(null); setView('dashboard'); }} add={addProject} addEntry={(entry) => setCalendarEntries((items) => [...items, entry])} deleteEntry={(id) => setCalendarEntries((items) => items.filter((item) => item.id !== id))} message={message} />}
          {view === 'dashboard' && <Dashboard project={project} issues={issues} docs={docs} customers={customers} go={setView} generateAll={() => setReleaseSelection({ mode: 'download', kinds: [...ALL_RELEASE_KINDS], notes: '' })} emailAll={() => setReleaseSelection({ mode: 'email', kinds: [...ALL_RELEASE_KINDS], notes: '' })} saveContract={(contract) => setProjects((items) => items.map((item) => item.id === projectId ? { ...item, contract, modified: 'Now' } : item))} saveContacts={(contactIds) => setProjects((items) => items.map((item) => item.id === projectId ? { ...item, contactIds, modified: 'Now' } : item))} message={message} />}
          {view === 'setup' && <ProjectSetup project={project} customers={customers} save={(updated) => { setProjects((items) => items.map((item) => item.id === projectId ? { ...updated, modified: 'Now' } : item)); message('Saved', 'Project Setup was saved.'); }} />}
          {view === 'internal' && <InternalMatrix issues={filtered} allCount={issues.length} draft={draft} selectedUid={selectedUid} edit={editIssue} setDraft={setDraft} submit={submit} remove={deleteEntry} newDraft={newDraft} saveTemplate={saveTemplate} templates={templates} deleteTemplate={requestDeleteTemplate} search={search} setSearch={setSearch} systems={systems} systemFilter={systemFilter} setSystemFilter={setSystemFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} tab={tab} setTab={setTab} />}
          {view === 'documents' && <Documents projectId={projectId} docs={docs} setDocs={setDocs} openPreview={setPreview} confirmAction={confirmAction} requestInput={requestInput} message={message} />}
          {view === 'sow' && <Deliverable title="Recommended SOW Matrix" eyebrow="Primary Flagship Deliverable" description="Uses submitted Internal Matrix entries assigned to Recommended SOW." rows={issues.filter((i) => i.sow)} columns={['SLR', 'System', 'Scope Item', 'Scope Concern', 'Recommended Bid Basis', 'Reference']} values={(i) => [i.id, systemName(i), i.title, i.concern, i.basis, i.reference]} update={() => updatePdf('sow', 'Recommended SOW Matrix')} url={pdfUrls.sow} onDownload={() => recordDownload('Recommended_SOW_Matrix.pdf', 'Recommended SOW Matrix')} preview={(url) => setPreview({ title: 'Recommended SOW Matrix', url, mode: 'pdf' })} send={() => prepareEmail('sow', 'Recommended SOW Matrix')} />}
          {view === 'clarifications' && <Deliverable title="Clarification Matrix" eyebrow="GC Working Document" description="When an SLR is also a Formal RFI, its RFI number appears directly below the SLR number." rows={issues.filter((i) => i.clarification)} columns={['SLR / RFI', 'System', 'Question / Issue', 'Recommended Bid Basis', 'Resolution', 'Status', 'Reference']} values={(i) => [[i.id, i.rfi].filter(Boolean).join('\n'), systemName(i), i.concern, i.basis, i.resolution, i.status, i.reference]} update={() => updatePdf('clarifications', 'Clarification Matrix')} url={pdfUrls.clarifications} onDownload={() => recordDownload('Clarification_Matrix.pdf', 'Clarification Matrix')} preview={(url) => setPreview({ title: 'Clarification Matrix', url, mode: 'pdf' })} send={() => prepareEmail('clarifications', 'Clarification Matrix')} />}
          {view === 'rfi' && <Deliverable title="Formal RFI" eyebrow="A/E Deliverable" description="RFI numbers are generated automatically from submitted entries assigned to Formal RFI." rows={issues.filter((i) => i.formalRfi)} columns={['RFI No.', 'System', 'Question', 'Answer']} values={(i) => [i.rfi, systemName(i), i.rfiQuestion || i.concern, i.resolution]} update={() => updatePdf('rfi', 'Formal RFI')} url={pdfUrls.rfi} onDownload={() => recordDownload('Formal_RFI.pdf', 'Formal RFI')} preview={(url) => setPreview({ title: 'Formal RFI', url, mode: 'pdf' })} send={() => prepareEmail('rfi', 'Formal RFI')} />}
          {view === 'checklist' && <Deliverable title="Contractor Response Checklist" eyebrow="Editable PDF" description="Every response other than Included requires a written reason. The generated PDF includes editable dropdown and multiline reason fields." rows={issues.filter((i) => i.checklistItem.trim())} columns={['SLR', 'System', 'Checklist Scope Item', 'Response', 'Reason']} values={(i) => [i.id, systemName(i), i.checklistItem, i.response, i.responseReason]} update={() => updatePdf('checklist', 'Contractor Response Checklist')} url={pdfUrls.checklist} onDownload={() => recordDownload('Contractor_Response_Checklist.pdf', 'Contractor Response Checklist')} preview={(url) => setPreview({ title: 'Contractor Response Checklist', url, mode: 'pdf' })} send={() => prepareEmail('checklist', 'Contractor Response Checklist')} />}
          {view === 'leveling' && <BidLeveling />}
          {view === 'snippets' && <Deliverable title="Snippet Register" eyebrow="Supporting Reference Document" description="Snippet numbers are generated automatically when an SLR is marked as having a snippet." rows={issues.filter((i) => i.snippet)} columns={['Snippet No.', 'SLR', 'System', 'Reference', 'Caption']} values={(i) => [i.snippet, i.id, systemName(i), i.reference, i.title]} update={() => updatePdf('snippets', 'Snippet Register')} url={pdfUrls.snippets} onDownload={() => recordDownload('Snippet_Register.pdf', 'Snippet Register')} preview={(url) => setPreview({ title: 'Snippet Register', url, mode: 'pdf' })} send={() => prepareEmail('snippets', 'Snippet Register')} />}
          {view === 'notes' && <InternalNotes value={internalNotes} save={(value) => { setNotesByProject((current) => ({ ...current, [projectId]: value })); message('Saved', 'Internal notes were saved.'); }} />}
          {view === 'customers' && <CustomerDatabase customers={customers} save={setCustomers} message={message} />}
          {view === 'exports' && <ExportLog entries={exportEntries} />}
          {view === 'email' && <EmailSettingsPage settings={emailSettings} save={setEmailSettings} message={message} />}
          {view === 'standards' && <OfficialLogoStandard />}
        </div>
      </main>
      {preview && <PreviewModal preview={preview} close={() => setPreview(null)} />}
      {dialog && <AppDialog dialog={dialog} close={() => setDialog(null)} />}
      {emailDraft && <EmailComposer draft={emailDraft} settings={emailSettings} customers={customers} sending={emailSending} change={setEmailDraft} close={() => setEmailDraft(null)} send={sendEmail} />}
      {releaseSelection && <ReleaseSelectionDialog selection={releaseSelection} change={setReleaseSelection} close={() => setReleaseSelection(null)} confirm={async (selection) => { setReleaseSelection(null); if (selection.mode === 'download') await downloadReleasePackage(selection.kinds, selection.notes); else await prepareEmail('release', 'Official GC Release Package', selection.kinds, selection.notes); }} />}
    </div>
  );
}

function InternalMatrix(props: any) {
  const draft: Issue | null = props.draft;
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const patch = (key: keyof Issue, value: unknown) => props.setDraft((current: Issue | null) => current ? { ...current, [key]: value } : current);
  const chosenTemplate: Template | undefined = props.templates.find((template: Template) => template.uid === selectedTemplate);
  return <>
    <PageHead eyebrow="Primary Workspace" title="ScopeLogic Internal Matrix" description="Entries remain drafts until Submit Entry is selected. Only submitted entries feed deliverables and PDFs." action={<div className="button-row"><button className="secondary" onClick={props.remove}>{draft && !props.selectedUid ? 'Discard Draft' : 'Delete'}</button><button className="primary" onClick={() => props.newDraft()}>+ New Issue</button></div>} />
    <div className="template-bar template-library">
      <div><b>SLR Template Library</b><span>Global templates remain available across every project.</span></div>
      <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}><option value="">{props.templates.length ? 'Select a saved SLR template...' : 'No saved templates yet'}</option>{props.templates.map((template: Template) => <option key={template.uid} value={template.uid}>{template.name}</option>)}</select>
      <button className="secondary" disabled={!chosenTemplate} onClick={() => chosenTemplate && props.newDraft(chosenTemplate)}>Use Template</button>
      <button className="template-delete-button" disabled={!chosenTemplate} onClick={() => chosenTemplate && props.deleteTemplate(chosenTemplate)}>Delete Template</button>
    </div>
    <div className="matrix-toolbar"><input placeholder="Search submitted SLRs..." value={props.search} onChange={(event) => props.setSearch(event.target.value)} /><select value={props.systemFilter} onChange={(event) => props.setSystemFilter(event.target.value)}>{props.systems.map((system: string) => <option key={system}>{system}</option>)}</select><select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value)}><option>All</option>{ISSUE_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select><span>{props.allCount} submitted</span></div>
    <div className="bluebeam-layout">
      <section className="issue-list"><div className="list-header"><span>SLR / System</span><span>Status</span></div>{!props.issues.length && <div className="empty-list"><b>No submitted entries</b><p>Create an SLR, complete it, and select Submit Entry.</p></div>}{props.issues.map((issue: Issue) => <button key={issue.uid} className={props.selectedUid === issue.uid ? 'selected' : ''} onClick={() => props.edit(issue.uid)}><div><b>{issue.id}{issue.rfi ? ` / ${issue.rfi}` : ''}</b><span>{systemName(issue)}</span><strong>{issue.title}</strong></div><em className={`status-dot ${issue.status.toLowerCase().replaceAll(' ', '-')}`}>{issue.status}</em></button>)}</section>
      <section className="issue-editor">
        {!draft ? <div className="empty-state large"><b>Select a submitted SLR or create a new issue.</b><p>Editing does not affect deliverables until Submit Entry is selected.</p></div> : <>
          <div className="draft-banner"><b>{props.selectedUid ? 'Editing submitted entry' : 'Unsubmitted draft'}</b><span>{draft.id} is provisional until submission.</span></div>
          <div className="issue-title"><div><span>{draft.id}</span><input placeholder="Scope Item / Short Description" value={draft.title} onChange={(event) => patch('title', event.target.value)} /></div><select value={draft.status} onChange={(event) => patch('status', event.target.value)}>{ISSUE_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></div>
          <div className="editor-grid"><SelectField label="System" value={draft.system} options={SYSTEM_OPTIONS} onChange={(value) => patch('system', value)} />{draft.system === 'Other' && <Field label="Define Other System" value={draft.customSystem} onChange={(value) => patch('customSystem', value)} />}</div>
          <TextArea label="Scope Concern" value={draft.concern} onChange={(value) => patch('concern', value)} />
          <TextArea label="Formal RFI Question" value={draft.rfiQuestion} onChange={(value) => patch('rfiQuestion', value)} />
          <p className="help-text rfi-help">The Formal RFI uses this field. The Scope Concern remains the internal/clarification issue statement.</p>
          <TextArea label="Recommended Bid Basis" value={draft.basis} onChange={(value) => patch('basis', value)} />
          <TextArea label="Reason / Basis" value={draft.reason} onChange={(value) => patch('reason', value)} />
          <Field label="Contract Reference or Scope-Gap Basis" value={draft.reference} onChange={(value) => patch('reference', value)} />
          <AutoGrowTextArea label="Contractor Checklist Scope Item" value={draft.checklistItem} onChange={(value) => patch('checklistItem', value)} />
          <p className="help-text checklist-help">This is the exact scope language shown on the Contractor Response Checklist. Leave it blank to omit this SLR from the checklist.</p>
          <div className="detail-tabs"><button className={props.tab === 'details' ? 'active' : ''} onClick={() => props.setTab('details')}>Details</button><button className={props.tab === 'snippets' ? 'active' : ''} onClick={() => props.setTab('snippets')}>Snippets</button><button className={props.tab === 'deliverables' ? 'active' : ''} onClick={() => props.setTab('deliverables')}>Deliverables</button><button className={props.tab === 'history' ? 'active' : ''} onClick={() => props.setTab('history')}>History</button></div>
          {props.tab === 'details' && <div className="tab-panel two"><SelectField label="Contractor Response" value={draft.response} options={RESPONSE_OPTIONS} onChange={(value) => patch('response', value)} />{draft.response !== 'Included' && <AutoGrowTextArea label="Required Reason" value={draft.responseReason} onChange={(value) => patch('responseReason', value)} />}<Field label="RFI Resolution / Official Answer" value={draft.resolution} onChange={(value) => patch('resolution', value)} /></div>}
          {props.tab === 'snippets' && <div className="tab-panel"><Check label="Create an automatically numbered snippet reference for this SLR" value={Boolean(draft.snippet)} change={(value) => patch('snippet', value ? 'pending' : '')} /><p className="help-text">The final SNP number is assigned on submission and renumbered when entries are deleted.</p></div>}
          {props.tab === 'deliverables' && <div className="tab-panel checklist"><Check label="Recommended SOW Matrix" value={draft.sow} change={(value) => patch('sow', value)} /><Check label="Clarification Matrix" value={draft.clarification} change={(value) => patch('clarification', value)} /><Check label="Formal RFI" value={draft.formalRfi} change={(value) => patch('formalRfi', value)} /><div className="deliverable-rule-note"><b>Contractor Response Checklist</b><span>Controlled by the Contractor Checklist Scope Item text box above. Blank means not included.</span></div></div>}
          {props.tab === 'history' && <div className="tab-panel timeline"><p><b>Draft workflow</b><span>Changes remain local until Submit Entry.</span></p></div>}
          <div className="submit-bar"><button className="secondary" onClick={props.saveTemplate}>Save This SLR as Template</button><button className="primary" onClick={props.submit}>Submit Entry</button></div>
        </>}
      </section>
    </div>
  </>;
}

function Documents({ projectId, docs, setDocs, openPreview, confirmAction, requestInput, message }: { projectId: string; docs: Doc[]; setDocs: (change: (items: Doc[]) => Doc[]) => void; openPreview: (preview: PreviewState) => void; confirmAction: (title: string, body: string, onConfirm: () => void | Promise<void>, confirmLabel?: string, danger?: boolean) => void; requestInput: (title: string, body: string, initialValue: string, onConfirm: (value: string) => void | Promise<void>, confirmLabel?: string) => void; message: (title: string, body: string) => void }) {
  const [folder, setFolder] = useState<'current' | 'previous'>('current');
  const [selectedId, setSelectedId] = useState('');
  const [uploadType, setUploadType] = useState(DOCUMENT_TYPES[0]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const uploadRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const selected = docs.find((doc) => doc.id === selectedId);
  const [detailsDraft, setDetailsDraft] = useState<Doc | null>(null);
  const visibleDocs = docs.filter((doc) => folder === 'current' ? doc.current : !doc.current);

  useEffect(() => {
    let active = true;
    const created: string[] = [];
    Promise.all(docs.map(async (doc) => {
      const blob = await readStoredFile(`${projectId}:${doc.id}`);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      created.push(url);
      return [doc.id, url] as const;
    })).then((pairs) => {
      if (!active) return;
      setFileUrls(Object.fromEntries(pairs.filter(Boolean) as [string, string][]));
    }).catch(() => undefined);
    return () => {
      active = false;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [docs, projectId]);

  useEffect(() => {
    if (selected && ((folder === 'current' && !selected.current) || (folder === 'previous' && selected.current))) setSelectedId('');
  }, [folder, selected]);
  useEffect(() => { setDetailsDraft(selected ? { ...selected } : null); }, [selectedId, selected?.id]);

  const fileKey = (id: string) => `${projectId}:${id}`;
  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const additions: Doc[] = [];
    for (const file of files) {
      const id = crypto.randomUUID();
      await storeFile(fileKey(id), file);
      additions.push({ id, type: uploadType, name: file.name.replace(/\.[^.]+$/, ''), revision: 'Revision 0', date: new Date().toISOString().slice(0, 10), current: true, notes: '', fileName: file.name, fileType: file.type || 'application/octet-stream', sizeBytes: file.size });
    }
    setDocs((items) => [...items, ...additions]);
    setFolder('current');
    setSelectedId(additions[additions.length - 1].id);
    message('Saved', `${additions.length} project document${additions.length === 1 ? '' : 's'} uploaded and saved.`);
  };

  const replaceFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selected) return;
    requestInput('Replace Document Revision', 'Enter the revision name for the new current document. The existing file will move to Previous Documents.', nextRevision(selected.revision), async (revision) => {
      const id = crypto.randomUUID();
      await storeFile(fileKey(id), file);
      const replacement: Doc = { ...selected, id, revision: revision.trim() || nextRevision(selected.revision), date: new Date().toISOString().slice(0, 10), current: true, fileName: file.name, fileType: file.type || 'application/octet-stream', sizeBytes: file.size };
      setDocs((items) => [...items.map((doc) => doc.id === selected.id ? { ...doc, current: false } : doc), replacement]);
      setFolder('current');
      setSelectedId(id);
      message('Saved', 'The replacement revision was saved and the prior file was moved to Previous Documents.');
    }, 'Replace Revision');
  };

  const deleteSelected = () => {
    if (!selected) return;
    confirmAction('Delete Project Document?', `Delete "${selected.fileName}" from this project?`, async () => {
      await removeStoredFile(fileKey(selected.id));
      setDocs((items) => items.filter((doc) => doc.id !== selected.id));
      setSelectedId('');
    }, 'Delete Document', true);
  };

  const openDocument = (doc: Doc) => {
    const url = fileUrls[doc.id];
    if (!url) return message('File Not Available', 'The file data could not be found in this browser. Upload the document again.');
    if (doc.fileType === 'application/pdf') return openPreview({ title: doc.fileName, url, mode: 'pdf' });
    if (doc.fileType.startsWith('image/')) return openPreview({ title: doc.fileName, url, mode: 'image' });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openSelected = () => {
    if (selected) openDocument(selected);
  };

  const patch = (key: keyof Doc, value: string | boolean) => setDetailsDraft((current) => current ? { ...current, [key]: value } : current);
  const saveDetails = () => {
    if (!detailsDraft) return;
    setDocs((items) => items.map((doc) => doc.id === detailsDraft.id ? detailsDraft : doc));
    message('Saved', 'The document display name, type, revision, current status, issue date, and notes were saved.');
  };

  return <>
    <PageHead eyebrow="Current Project" title="Project Documents" description="Current documents remain at the project root. Superseded revisions are retained in the Previous Documents folder." action={<div className="document-upload-controls"><SelectField label="Document Type" value={uploadType} options={DOCUMENT_TYPES} onChange={setUploadType} compact /><button className="primary" onClick={() => uploadRef.current?.click()}>Upload Documents</button><input ref={uploadRef} hidden type="file" multiple accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff" onChange={uploadFiles} /></div>} />
    <div className="explorer-shell">
      <aside className="folder-tree"><div className="folder-tree-title">Folders</div><button className={folder === 'current' ? 'active' : ''} onClick={() => setFolder('current')}><span className="folder-icon">P</span><div><b>Project Documents</b><small>{docs.filter((doc) => doc.current).length} current files</small></div></button><button className={folder === 'previous' ? 'active nested' : 'nested'} onClick={() => setFolder('previous')}><span className="folder-icon">F</span><div><b>Previous Documents</b><small>{docs.filter((doc) => !doc.current).length} prior files</small></div></button></aside>
      <section className="file-explorer">
        <div className="explorer-toolbar"><div><b>{folder === 'current' ? 'Project Documents' : 'Previous Documents'}</b><span>{visibleDocs.length} item{visibleDocs.length === 1 ? '' : 's'}</span></div><div className="button-row"><button className="secondary" disabled={!selected} onClick={openSelected}>Open / Preview</button><button className="secondary" disabled={!selected?.current} onClick={() => replaceRef.current?.click()}>Replace Revision</button><input ref={replaceRef} hidden type="file" accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff" onChange={replaceFile} />{selected && fileUrls[selected.id] ? <a className="secondary link-button" href={fileUrls[selected.id]} download={selected.fileName}>Download</a> : <button className="secondary" disabled>Download</button>}<button className="danger-button" disabled={!selected} onClick={deleteSelected}>Delete</button></div></div>
        <div className="file-table"><div className="file-row file-head"><span>Name</span><span>Type</span><span>Revision</span><span>Date</span><span>Size</span></div>{visibleDocs.map((doc) => <button className={`file-row ${selectedId === doc.id ? 'selected' : ''}`} key={doc.id} onClick={() => setSelectedId(doc.id)} onDoubleClick={() => openDocument(doc)}><span className="file-name"><i>{documentIcon(doc)}</i><b>{doc.name || doc.fileName}</b></span><span>{doc.type}</span><span>{doc.revision}</span><span>{doc.date}</span><span>{formatBytes(doc.sizeBytes)}</span></button>)}{!visibleDocs.length && <div className="empty-folder"><b>{folder === 'current' ? 'No current project documents' : 'No previous documents'}</b><p>{folder === 'current' ? 'Choose a document type and upload one or more files.' : 'Previous revisions appear here after Replace Revision is used.'}</p></div>}</div>
        {detailsDraft && <div className="file-properties"><div className="properties-title"><div><span>{detailsDraft.current ? 'Current document' : 'Previous document'}</span><h2>{detailsDraft.fileName}</h2></div><button className="primary" onClick={saveDetails}>Save Details</button></div><div className="editor-grid"><Field label="Display Name" value={detailsDraft.name} onChange={(value) => patch('name', value)} /><SelectField label="Document Type" value={detailsDraft.type} options={DOCUMENT_TYPES} onChange={(value) => patch('type', value)} /><Field label="Revision" value={detailsDraft.revision} onChange={(value) => patch('revision', value)} /><Field label="Issue Date" type="date" value={detailsDraft.date} onChange={(value) => patch('date', value)} /><label className="field checkbox-field"><span>Current Document</span><div><input type="checkbox" checked={detailsDraft.current} onChange={(event) => patch('current', event.target.checked)} /><b>{detailsDraft.current ? 'Current' : 'Previous'}</b></div></label></div><TextArea label="Notes" value={detailsDraft.notes} onChange={(value) => patch('notes', value)} /></div>}
      </section>
    </div>
  </>;
}

function nextRevision(value: string) {
  const match = value.match(/(\d+)\s*$/);
  if (match) return value.replace(/\d+\s*$/, String(Number(match[1]) + 1));
  return value.toLowerCase() === 'current' ? 'Revision 1' : `${value} - Revision 1`;
}
function documentIcon(doc: Doc) {
  if (doc.fileType === 'application/pdf') return 'PDF';
  if (doc.fileType.startsWith('image/')) return 'IMG';
  if (/word|document/.test(doc.fileType) || /\.docx?$/i.test(doc.fileName)) return 'DOC';
  if (/sheet|excel/.test(doc.fileType) || /\.xlsx?$/i.test(doc.fileName)) return 'XLS';
  if (/\.dwg$/i.test(doc.fileName)) return 'DWG';
  return 'FILE';
}
function formatBytes(bytes: number) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Deliverable({ title, eyebrow, description, rows, columns, values, update, url, preview, onDownload, send }: { title: string; eyebrow: string; description: string; rows: Issue[]; columns: string[]; values: (issue: Issue) => string[]; update: () => void; url?: string; preview: (url: string) => void; onDownload: () => void; send: () => void }) {
  return <><PageHead eyebrow={eyebrow} title={title} description={description} action={<div className="button-row"><button className="secondary" onClick={update}>{url ? 'Update PDF' : 'Generate PDF'}</button><button className="secondary" disabled={!url} onClick={() => url && preview(url)}>Preview</button><button className="secondary" onClick={send}>Email PDF</button>{url ? <a className="primary link-button" href={url} download={`${title.replaceAll(' ', '_')}.pdf`} onClick={onDownload}>Download PDF</a> : <button className="primary" disabled>Download PDF</button>}</div>} /><div className="sync-note">PDF status: <b>{url ? 'Generated from current submitted entries' : 'Not generated'}</b>. Select Update PDF after changing deliverable assignments or submitted entries.</div><div className="matrix-export"><div className="matrix-table"><div className="matrix-row head" style={{ gridTemplateColumns: `repeat(${columns.length},minmax(120px,1fr))` }}>{columns.map((column) => <b key={column}>{column}</b>)}</div>{rows.length ? rows.map((issue) => <div className="matrix-row" key={issue.uid} style={{ gridTemplateColumns: `repeat(${columns.length},minmax(120px,1fr))` }}>{values(issue).map((value, index) => <span key={index}>{value || '-'}</span>)}</div>) : <div className="empty-state"><b>No submitted entries assigned</b><p>Assign an SLR to this deliverable and submit it from the Internal Matrix.</p></div>}</div></div></>;
}

function ProjectSetup({ project, customers, save }: { project: Project; customers: Customer[]; save: (project: Project) => void }) {
  const [draft, setDraft] = useState<Project>(project);
  useEffect(() => setDraft(project), [project.id, project]);
  const customer = customers.find((item) => item.id === draft.customerId);
  const chooseCustomer = (customerId: string) => {
    const selected = customers.find((item) => item.id === customerId);
    setDraft((current) => ({ ...current, customerId, client: selected?.name || current.client, contactIds: current.contactIds.filter((id) => selected?.contacts.some((contact) => contact.id === id)) }));
  };
  return <><PageHead eyebrow="Project" title="Project Setup" description="Core project information, customer selection, and project-level system selection." /><div className="form-card project-setup-card"><Field label="Project Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} /><SelectField label="Customer" value={draft.customerId} options={['', ...customers.map((item) => item.id)]} optionLabels={['Select customer...', ...customers.map((item) => item.name || 'Unnamed customer')]} onChange={chooseCustomer} /><Field label="GC / Client Display Name" value={draft.client} onChange={(value) => setDraft((current) => ({ ...current, client: value }))} /><Field label="Version Date" type="date" value={draft.versionDate} onChange={(value) => setDraft((current) => ({ ...current, versionDate: value }))} /><Field label="Revision" value={draft.revision} onChange={(value) => setDraft((current) => ({ ...current, revision: value }))} /><SelectField label="Status" value={draft.status} options={PROJECT_STATUS_OPTIONS} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} /><MultiSelectField label="Systems" values={draft.systems} options={SYSTEM_OPTIONS} onChange={(value) => setDraft((current) => ({ ...current, systems: value }))} />{customer && <div className="selected-customer-note"><b>{customer.name}</b><span>{customer.contacts.length} saved contact{customer.contacts.length === 1 ? '' : 's'} available for the Dashboard Contacts tab.</span></div>}<div className="form-actions"><button className="primary" onClick={() => save(draft)}>Save Project Setup</button></div></div></>;
}

function MultiSelectField({ label, values, options, onChange }: { label: string; values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = (option: string) => onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option]);
  return <label className="field multiselect-field"><span>{label}</span><button type="button" className="multiselect-trigger" onClick={() => setOpen(!open)}>{values.length ? values.join(', ') : 'Select systems'}<b>{open ? 'Close' : 'Open'}</b></button>{open && <div className="multiselect-menu">{options.map((option) => <label key={option}><input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} /><span>{option}</span></label>)}<button type="button" className="secondary" onClick={() => setOpen(false)}>Done</button></div>}</label>;
}

function AppDialog({ dialog, close }: { dialog: DialogState; close: () => void }) {
  const [value, setValue] = useState(dialog.kind === 'input' ? dialog.initialValue : '');
  useEffect(() => setValue(dialog.kind === 'input' ? dialog.initialValue : ''), [dialog]);
  const confirm = async () => {
    if (dialog.kind === 'message') return close();
    const current = dialog;
    close();
    if (current.kind === 'confirm') await current.onConfirm();
    if (current.kind === 'input') await current.onConfirm(value);
  };
  return <div className="dialog-backdrop" role="presentation"><div className="app-dialog" role="dialog" aria-modal="true"><div className="dialog-title"><b>{dialog.title}</b><button onClick={close}>Close</button></div><p>{dialog.message}</p>{dialog.kind === 'input' && <input autoFocus value={value} placeholder={dialog.placeholder} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && confirm()} />}<div className="dialog-actions">{dialog.kind !== 'message' && <button className="secondary" onClick={close}>Cancel</button>}<button className={dialog.kind === 'confirm' && dialog.danger ? 'danger-button' : 'primary'} disabled={dialog.kind === 'input' && !value.trim()} onClick={confirm}>{dialog.confirmLabel || (dialog.kind === 'message' ? 'OK' : 'Confirm')}</button></div></div></div>;
}

function PreviewModal({ preview, close }: { preview: NonNullable<PreviewState>; close: () => void }) {
  return <div className="modal"><div className="modal-card"><div className="modal-head"><b>{preview.title}</b><button onClick={close}>Close</button></div>{preview.mode === 'image' ? <div className="image-preview"><img src={preview.url} alt={preview.title} /></div> : <iframe src={preview.url} title={preview.title} />}</div></div>;
}


function InternalNotes({ value, save }: { value: string; save: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <><PageHead eyebrow="Internal Workspace" title="Internal Notes" description="Private project notes are stored with this project and are not included in client deliverables." action={<button className="primary" onClick={() => save(draft)}>Save Notes</button>} /><div className="notes-page"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Jot down project thoughts, follow-up items, coordination notes, and internal reminders..." /></div></>;
}

function CustomerDatabase({ customers, save, message }: { customers: Customer[]; save: (customers: Customer[]) => void; message: (title: string, body: string) => void }) {
  const [working, setWorking] = useState<Customer[]>(customers);
  const [selectedId, setSelectedId] = useState(customers[0]?.id || '');
  useEffect(() => { setWorking(customers); if (!customers.some((item) => item.id === selectedId)) setSelectedId(customers[0]?.id || ''); }, [customers]);
  const selected = working.find((item) => item.id === selectedId);
  const patchCustomer = (key: keyof Customer, value: string | CustomerContact[]) => setWorking((items) => items.map((item) => item.id === selectedId ? { ...item, [key]: value } : item));
  const patchContact = (contactId: string, key: keyof CustomerContact, value: string) => patchCustomer('contacts', (selected?.contacts || []).map((contact) => contact.id === contactId ? { ...contact, [key]: value } : contact));
  const addCustomer = () => { const customer = blankCustomer(); setWorking((items) => [...items, customer]); setSelectedId(customer.id); };
  const removeCustomer = () => { if (!selected) return; const next = working.filter((item) => item.id !== selected.id); setWorking(next); setSelectedId(next[0]?.id || ''); save(next); message('Saved', 'The customer was removed from the global Customer Database.'); };
  const addContact = () => selected && patchCustomer('contacts', [...selected.contacts, blankCustomerContact()]);
  const removeContact = (contactId: string) => selected && patchCustomer('contacts', selected.contacts.filter((contact) => contact.id !== contactId));
  const saveDatabase = () => { save(working); message('Saved', 'The global Customer Database and email address book were saved.'); };
  return <>
    <PageHead eyebrow="Administration" title="Customer Database" description="Customer and contact records carry across every project and feed Project Setup, Dashboard Contacts, and the email address book." action={<button className="primary" onClick={addCustomer}>+ New Customer</button>} />
    <div className="customer-database">
      <aside className="customer-list"><div className="customer-list-head">Customers</div>{working.map((customer) => <button key={customer.id} className={selectedId === customer.id ? 'selected' : ''} onClick={() => setSelectedId(customer.id)}><b>{customer.name || 'New Customer'}</b><span>{customer.city || 'City not entered'}{customer.state ? `, ${customer.state}` : ''}</span><small>{customer.contacts.length} contact{customer.contacts.length === 1 ? '' : 's'}</small></button>)}{!working.length && <div className="empty-list"><b>No customers saved.</b><p>Create a customer to begin the global address book.</p></div>}</aside>
      <section className="customer-editor">{!selected ? <div className="empty-state large"><b>Select or create a customer.</b></div> : <>
        <div className="customer-editor-head"><div><span>Customer Record</span><h2>{selected.name || 'New Customer'}</h2></div><div className="button-row"><button className="danger-button" onClick={removeCustomer}>Delete Customer</button><button className="primary" onClick={saveDatabase}>Save Customer</button></div></div>
        <div className="customer-form"><Field label="Company / Customer Name" value={selected.name} onChange={(value) => patchCustomer('name', value)} /><Field label="Website" value={selected.website} onChange={(value) => patchCustomer('website', value)} /><Field label="Address 1" value={selected.address1} onChange={(value) => patchCustomer('address1', value)} /><Field label="Address 2" value={selected.address2} onChange={(value) => patchCustomer('address2', value)} /><Field label="City" value={selected.city} onChange={(value) => patchCustomer('city', value)} /><Field label="State" value={selected.state} onChange={(value) => patchCustomer('state', value)} /><Field label="ZIP" value={selected.zip} onChange={(value) => patchCustomer('zip', value)} /><label className="field customer-notes"><span>Customer Notes</span><textarea value={selected.notes} onChange={(event) => patchCustomer('notes', event.target.value)} /></label></div>
        <div className="contacts-editor-head"><div><span>Address Book</span><h3>Contacts</h3></div><button className="secondary" onClick={addContact}>+ Add Contact</button></div>
        <div className="contacts-editor">{selected.contacts.map((contact) => <div className="contact-editor-row" key={contact.id}><Field label="Name" value={contact.name} onChange={(value) => patchContact(contact.id, 'name', value)} /><Field label="Title / Role" value={contact.title} onChange={(value) => patchContact(contact.id, 'title', value)} /><Field label="Email" value={contact.email} onChange={(value) => patchContact(contact.id, 'email', value)} /><Field label="Phone" value={contact.phone} onChange={(value) => patchContact(contact.id, 'phone', value)} /><button className="contact-remove" onClick={() => removeContact(contact.id)}>Remove</button></div>)}{!selected.contacts.length && <div className="empty-panel compact"><b>No contacts saved.</b><p>Add a contact for project assignment and email delivery.</p></div>}</div>
      </>}</section>
    </div>
  </>;
}

function ExportLog({ entries }: { entries: ExportEntry[] }) {
  return <><PageHead eyebrow="Administration" title="Export Log" description="Tracks PDF downloads and official release-package downloads. Generating or updating a PDF does not create a log entry." /><div className="matrix-export"><div className="matrix-table"><div className="matrix-row head" style={{ gridTemplateColumns: '1.4fr 1fr .8fr 1fr' }}><b>Downloaded File</b><b>Deliverable</b><b>Revision</b><b>Downloaded</b></div>{entries.length ? entries.map((entry) => <div className="matrix-row" key={entry.id} style={{ gridTemplateColumns: '1.4fr 1fr .8fr 1fr' }}><span>{entry.fileName}</span><span>{entry.deliverable}</span><span>{entry.projectRevision}</span><span>{entry.downloadedAt}</span></div>) : <div className="empty-state"><b>No downloads recorded</b><p>Entries appear here when a PDF or official release package is downloaded.</p></div>}</div></div></>;
}


function EmailSettingsPage({ settings, save, message }: { settings: EmailSettings; save: (settings: EmailSettings) => void; message: (title: string, body: string) => void }) {
  const [draft, setDraft] = useState(settings);
  const [serviceStatus, setServiceStatus] = useState<{ configured: boolean; keyFormatValid: boolean; defaultFromConfigured: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  const refreshStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await fetch('/api/email/send', { method: 'GET', cache: 'no-store' });
      const result = await response.json();
      setServiceStatus(result);
    } catch {
      setServiceStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };
  useEffect(() => { void refreshStatus(); }, []);
  const statusLabel = !serviceStatus ? 'Status unavailable' : !serviceStatus.configured ? 'API key missing' : !serviceStatus.keyFormatValid ? 'API key format invalid' : 'Server key detected';
  const statusClass = serviceStatus?.configured && serviceStatus.keyFormatValid ? 'ready' : 'error';
  return <>
    <PageHead eyebrow="Administration" title="Email Settings" description="Configure approved sender addresses in the app and verify the server-side email configuration used for PDF delivery." />
    <div className="form-card email-settings-card">
      <div className={`email-service-status ${statusClass}`}><div><span>Email service</span><b>{statusLoading ? 'Checking...' : statusLabel}</b><p>{serviceStatus?.configured && serviceStatus.keyFormatValid ? 'A Resend key is present in Vercel. The provider validates the key and sender domain during delivery.' : 'The secure API key cannot be stored in this browser form. Correct RESEND_API_KEY in Vercel, then redeploy.'}</p></div><button className="secondary" onClick={refreshStatus} disabled={statusLoading}>Refresh Status</button></div>
      <Field label="Default From Address" value={draft.defaultFrom} onChange={(value) => setDraft((current) => ({ ...current, defaultFrom: value }))} />
      <Field label="Default Reply-To Address" value={draft.replyTo} onChange={(value) => setDraft((current) => ({ ...current, replyTo: value }))} />
      <label className="field email-address-list"><span>Approved From Addresses</span><textarea value={draft.additionalFrom.join('\n')} onChange={(event) => setDraft((current) => ({ ...current, additionalFrom: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) }))} placeholder="estimating@scopelogic.com\nprojects@scopelogic.com" /></label>
      <div className="email-settings-note"><b>Two separate controls</b><p>The approved sender list above controls what the app allows you to select. RESEND_API_KEY and domain verification control whether the email provider will actually send the message.</p></div>
      <div className="form-actions"><button className="primary" onClick={() => { save({ ...draft, defaultFrom: draft.defaultFrom.trim(), replyTo: draft.replyTo.trim(), additionalFrom: Array.from(new Set(draft.additionalFrom.map((item) => item.trim()).filter(Boolean))) }); message('Saved', 'The default sender and approved sender list were saved.'); }}>Save Email Settings</button></div>
    </div>
  </>;
}

function EmailComposer({ draft, settings, customers, sending, change, close, send }: { draft: EmailDraft; settings: EmailSettings; customers: Customer[]; sending: boolean; change: (draft: EmailDraft | null) => void; close: () => void; send: (draft: EmailDraft) => void }) {
  const patch = (key: keyof EmailDraft, value: string) => change({ ...draft, [key]: value });
  const senders = Array.from(new Set([settings.defaultFrom, ...settings.additionalFrom].filter(Boolean)));
  const contacts = customers.flatMap((customer) => customer.contacts.filter((contact) => contact.email).map((contact) => ({ ...contact, customer: customer.name })));
  const [addressContactId, setAddressContactId] = useState('');
  const addressContact = contacts.find((contact) => contact.id === addressContactId);
  const addAddress = (field: 'to' | 'cc') => {
    if (!addressContact?.email) return;
    const existing = parseAddresses(draft[field]);
    patch(field, Array.from(new Set([...existing, addressContact.email])).join('; '));
  };
  return <div className="dialog-backdrop email-backdrop" role="presentation">
    <div className="email-composer" role="dialog" aria-modal="true">
      <div className="email-composer-head"><div><img src="/brand/scopelogic-wordmark.png" alt="ScopeLogic" /><span>Email PDF Delivery</span></div><button onClick={close}>Close</button></div>
      <div className="email-composer-body">
        <label className="field"><span>From</span><select value={draft.from} onChange={(event) => patch('from', event.target.value)}><option value="">Use server default sender</option>{senders.map((sender) => <option key={sender} value={sender}>{sender}</option>)}</select><small>Approved sender addresses are managed in Email Settings.</small></label>
        <div className="address-book-picker"><label><span>Address Book</span><select value={addressContactId} onChange={(event) => setAddressContactId(event.target.value)}><option value="">Select a saved contact...</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || contact.email} — {contact.customer}</option>)}</select></label><button className="secondary" disabled={!addressContact} onClick={() => addAddress('to')}>Add to To</button><button className="secondary" disabled={!addressContact} onClick={() => addAddress('cc')}>Add to CC</button></div>
        <label className="field"><span>To</span><input value={draft.to} onChange={(event) => patch('to', event.target.value)} placeholder="recipient@example.com; second@example.com" /></label>
        <label className="field"><span>CC</span><input value={draft.cc} onChange={(event) => patch('cc', event.target.value)} placeholder="Optional" /></label>
        <label className="field"><span>Subject</span><input value={draft.subject} onChange={(event) => patch('subject', event.target.value)} /></label>
        <label className="field textarea"><span>Message</span><textarea value={draft.message} onChange={(event) => patch('message', event.target.value)} /></label>
        <div className="email-attachment"><img src="/brand/scopelogic-logo-mark.png" alt="" /><div><span>PDF Attachment</span><b>{draft.filename}</b><small>{draft.deliverable}</small></div></div>
      </div>
      <div className="email-composer-actions"><button className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={sending || !draft.to.trim() || !draft.subject.trim()} onClick={() => send(draft)}>{sending ? 'Sending...' : 'Send PDF'}</button></div>
    </div>
  </div>;
}

function ReleaseSelectionDialog({ selection, change, close, confirm }: { selection: ReleaseSelection; change: (selection: ReleaseSelection | null) => void; close: () => void; confirm: (selection: ReleaseSelection) => void | Promise<void> }) {
  const toggle = (kind: PdfKind) => change({ ...selection, kinds: selection.kinds.includes(kind) ? selection.kinds.filter((item) => item !== kind) : [...selection.kinds, kind] });
  return <div className="dialog-backdrop release-backdrop" role="presentation"><div className="release-dialog" role="dialog" aria-modal="true"><div className="dialog-title"><b>{selection.mode === 'download' ? 'Generate Official GC Release' : 'Email Official GC Release'}</b><button onClick={close}>Close</button></div><p>Select the deliverables to include in this release. The cover page will list only the selected documents.</p><div className="release-options">{RELEASE_OPTIONS.map((item) => <label key={item.kind}><input type="checkbox" checked={selection.kinds.includes(item.kind)} onChange={() => toggle(item.kind)} /><span>{item.label}</span></label>)}</div><label className="field"><span>Release Notes / Cover Note</span><textarea value={selection.notes} onChange={(event) => change({ ...selection, notes: event.target.value })} placeholder="Optional note for this official release..." /></label><div className="dialog-actions"><button className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={!selection.kinds.length} onClick={() => confirm(selection)}>{selection.mode === 'download' ? 'Generate Release' : 'Prepare Email'}</button></div></div></div>;
}

function OfficialLogoStandard() {
  const mappings = [
    ['Scope Concern', 'Clarification Matrix', 'Internal issue statement or clarification need.'],
    ['Formal RFI Question', 'Formal RFI', 'A/E-facing question. Only completed when an official RFI is required.'],
    ['Recommended Bid Basis', 'Recommended SOW Matrix', 'Interim bid basis or recommended scope standard.'],
    ['Contractor Checklist Scope Item', 'Contractor Response Checklist', 'Exact checklist language. Blank excludes the SLR from the checklist.'],
    ['RFI Resolution / Official Answer', 'Clarification Matrix and RFI tracking', 'Official response received from the A/E or owner.'],
  ];
  return <>
    <PageHead eyebrow="Administration" title="ScopeLogic Operating Standards" description="The active rules that control project records, numbering, deliverables, document releases, templates, and client communications." />
    <div className="standards-page">
      <section className="standard-summary"><img src="/brand/scopelogic-logo-mark.png" alt="ScopeLogic" /><div><span>Current application standard</span><h2>Identify. Clarify. Rectify.</h2><p>These standards describe how the ScopeLogic application is expected to behave. They are intended as an operating reference, not only a brand display.</p></div></section>
      <div className="standards-grid">
        <section className="standard-card"><span>01</span><h3>SLR numbering</h3><p>Every project starts at SLR-001. RFI and snippet numbers are generated only when applicable. Deleting a submitted record closes numbering gaps automatically.</p></section>
        <section className="standard-card"><span>02</span><h3>Submission control</h3><p>Internal Matrix edits remain drafts until Submit Entry is selected. Only submitted records feed deliverables and generated PDFs.</p></section>
        <section className="standard-card"><span>03</span><h3>Global SLR templates</h3><p>Saved templates carry from project to project. Templates store reusable scope logic but never retain the originating project’s SLR, RFI, snippet, or document-reference numbers.</p></section>
        <section className="standard-card"><span>04</span><h3>Checklist inclusion</h3><p>An SLR appears on the Contractor Response Checklist only when Contractor Checklist Scope Item contains text. That text replaces the Internal Matrix Scope Item on the checklist.</p></section>
        <section className="standard-card"><span>05</span><h3>Document control</h3><p>One uploaded document revision may be marked Current. Superseded files belong in Previous Documents. Revision identifies the issue level; Current identifies the active file.</p></section>
        <section className="standard-card"><span>06</span><h3>Official releases</h3><p>An official GC release is one combined PDF with a cover page, project revision, version date, and only the deliverables selected for that release.</p></section>
      </div>
      <section className="standard-section"><div className="standard-section-head"><span>Field-to-deliverable map</span><h2>What each Internal Matrix field controls</h2></div><div className="standards-table"><div className="standards-row head"><b>Internal Matrix field</b><b>Deliverable</b><b>Purpose</b></div>{mappings.map((row) => <div className="standards-row" key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><p>{row[2]}</p></div>)}</div></section>
      <div className="standards-grid two-column">
        <section className="standard-card wide"><span>07</span><h3>Contractor response rules</h3><p>Available responses are Included, Excluded, Included as Alternate, Clarification Required, and Not Applicable. Every response other than Included requires a written reason.</p></section>
        <section className="standard-card wide"><span>08</span><h3>Email delivery requirements</h3><p>The approved sender list is managed in the app, but the secure RESEND_API_KEY remains a Vercel environment variable. The sender domain must also be verified with the email provider.</p></section>
        <section className="standard-card wide"><span>09</span><h3>PDF identity</h3><p>All PDFs use the official ScopeLogic logo, OD green/black/white palette, project name, revision, version date, confidentiality footer, and page numbering.</p></section>
        <section className="standard-card wide"><span>10</span><h3>Official logo</h3><p>The supplied ScopeLogic artwork is the approved source. Full logo: covers and formal releases. Wordmark: headers. Symbol: sidebar, icons, and compact identification.</p></section>
      </div>
    </div>
  </>;
}

function BidLeveling() { return <><PageHead eyebrow="Optional Post-Bid Analysis" title="Bid Leveling Summary" description="Bidder-level executive evaluation remains separate from the Contractor Response Checklist." /><div className="empty-state large"><b>Bid leveling workspace retained.</b><p>This section remains available for bidder strengths, weaknesses, risk, commercial concerns, and recommendation.</p></div></>; }
function ProjectLibrary({ projects, active, entries, open, add, addEntry, deleteEntry, message }: { projects: Project[]; active: string; entries: CalendarEntry[]; open: (id: string) => void; add: () => void; addEntry: (entry: CalendarEntry) => void; deleteEntry: (id: string) => void; message: (title: string, body: string) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState(CALENDAR_EVENT_TYPES[0]);
  const [eventProjectId, setEventProjectId] = useState(active || projects[0]?.id || '');
  useEffect(() => { if (!projects.some((project) => project.id === eventProjectId)) setEventProjectId(active || projects[0]?.id || ''); }, [projects, active, eventProjectId]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const calendarCells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const selectedEntries = entries.filter((entry) => entry.date === selectedDate).sort((a, b) => a.title.localeCompare(b.title));
  const saveEvent = () => {
    if (!selectedDate || !eventTitle.trim()) return;
    addEntry({ id: crypto.randomUUID(), date: selectedDate, title: eventTitle.trim(), type: eventType, projectId: eventProjectId });
    setEventTitle('');
    message('Saved', 'The important date was added to the Project Library calendar.');
  };

  return <>
    <PageHead eyebrow="ScopeLogic" title="Project Library" description="Calendar milestones remain at the top of the library. Projects are listed below for faster scanning and higher information density." action={<button className="primary" onClick={add}>+ New Project</button>} />
    <div className="project-library-stack">
      <section className="calendar-panel library-calendar">
        <div className="calendar-head"><button className="secondary" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>Previous</button><div><span>Important Dates</span><h2>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2></div><button className="secondary" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>Next</button></div>
        <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <b key={day}>{day}</b>)}</div>
        <div className="calendar-grid">{calendarCells.map((day, index) => {
          if (!day) return <div className="calendar-day empty" key={`empty-${index}`} />;
          const key = dateKey(year, monthIndex, day);
          const dayEntries = entries.filter((entry) => entry.date === key);
          const isToday = key === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
          return <button key={key} className={`calendar-day ${selectedDate === key ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => setSelectedDate(key)}><strong>{day}</strong>{dayEntries.slice(0, 2).map((entry) => <span key={entry.id}>{entry.title}</span>)}{dayEntries.length > 2 && <em>+{dayEntries.length - 2} more</em>}</button>;
        })}</div>
        <div className="calendar-editor compact-calendar-editor">
          <div className="selected-date"><span>Selected date</span><b>{selectedDate}</b></div>
          <label><span>Milestone</span><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Important date or milestone" /></label>
          <label><span>Type</span><select value={eventType} onChange={(event) => setEventType(event.target.value)}>{CALENDAR_EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Project</span><select value={eventProjectId} onChange={(event) => setEventProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <button className="primary" disabled={!eventTitle.trim()} onClick={saveEvent}>Add Date</button>
        </div>
        <div className="calendar-event-list">{selectedEntries.length ? selectedEntries.map((entry) => <div key={entry.id}><div><b>{entry.title}</b><span>{entry.type} · {projects.find((project) => project.id === entry.projectId)?.name || 'General'}</span></div><button onClick={() => deleteEntry(entry.id)}>Remove</button></div>) : <p>No important dates marked for this day.</p>}</div>
      </section>
      <section className="project-list-section">
        <div className="project-list-heading"><div><span>Projects</span><h2>ScopeLogic Projects</h2></div><b>{projects.length} project{projects.length === 1 ? '' : 's'}</b></div>
        <div className="project-list-table">
          <div className="project-list-row head"><span>Project</span><span>Customer</span><span>Status</span><span>Contract</span><span>Revision</span><span></span></div>
          {projects.map((project) => <button key={project.id} className={`project-list-row ${project.id === active ? 'selected' : ''}`} onClick={() => open(project.id)}><span><b>{project.name}</b><small>{project.modified}</small></span><span>{project.client || 'Not entered'}</span><span><i>{project.status}</i></span><span>{project.contract.status}</span><span>{project.revision}</span><span className="open-project">Open</span></button>)}
        </div>
      </section>
    </div>
  </>;
}

function Dashboard({ project, issues, docs, customers, go, generateAll, emailAll, saveContract, saveContacts, message }: { project: Project; issues: Issue[]; docs: Doc[]; customers: Customer[]; go: (view: View) => void; generateAll: () => void; emailAll: () => void; saveContract: (contract: ContractDetails) => void; saveContacts: (contactIds: string[]) => void; message: (title: string, body: string) => void }) {
  const [contract, setContract] = useState<ContractDetails>(project.contract || blankContract());
  const [activeTab, setActiveTab] = useState<'contract' | 'contacts'>('contract');
  const [contactIds, setContactIds] = useState<string[]>(project.contactIds || []);
  useEffect(() => setContract(project.contract || blankContract()), [project.id, project.contract]);
  useEffect(() => setContactIds(project.contactIds || []), [project.id, project.contactIds]);
  const currentDrawings = docs.filter((doc) => doc.current && doc.type === 'Drawings');
  const customer = customers.find((item) => item.id === project.customerId);
  const availableContacts = customer?.contacts || [];
  const selectedContacts = availableContacts.filter((contact) => contactIds.includes(contact.id));
  const engagements = contractEngagementOptions(contract.offering);
  const tiers = contractTierOptions(contract.offering);
  const patchOffering = (offering: string) => {
    const engagement = contractEngagementOptions(offering)[0];
    const tier = contractTierOptions(offering)[0];
    setContract((current) => ({ ...current, offering, engagement, tier }));
  };
  const toggleContact = (id: string) => setContactIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <>
    <PageHead eyebrow="Project Dashboard" title={project.name} description="Submitted scope issues, current drawings, project contacts, and contract details." />
    <div className="metrics"><Metric n={issues.length} label="Submitted SLRs" /><Metric n={issues.filter((issue) => issue.status === 'Open' || issue.status === 'Under Review').length} label="Open Issues" /><Metric n={issues.filter((issue) => issue.formalRfi).length} label="Formal RFIs" /><Metric n={currentDrawings.length} label="Current Drawings" /></div>
    <div className="button-row dashboard-actions"><button className="primary" onClick={() => go('internal')}>Open Internal Matrix</button><button className="secondary" onClick={generateAll}>Generate All PDFs for GC</button><button className="secondary" onClick={emailAll}>Email All PDFs</button></div>
    <div className="dashboard-workspace">
      <section className="panel current-drawings-panel compact"><div className="panel-head"><div><span>Document Control</span><h2>Current Drawings</h2></div><button onClick={() => go('documents')}>Documents</button></div>{currentDrawings.length ? currentDrawings.slice(0, 5).map((doc) => <div className="document-line compact" key={doc.id}><div><b>{doc.name}</b><span>{doc.revision || 'No revision'} · {doc.date || 'No issue date'}</span></div></div>) : <div className="empty-panel compact"><b>No current drawings.</b><p>Mark drawings Current in Project Documents.</p></div>}{currentDrawings.length > 5 && <button className="more-link" onClick={() => go('documents')}>+{currentDrawings.length - 5} more drawings</button>}</section>
      <section className="panel dashboard-tab-panel">
        <div className="dashboard-tabs"><button className={activeTab === 'contract' ? 'active' : ''} onClick={() => setActiveTab('contract')}>Contract</button><button className={activeTab === 'contacts' ? 'active' : ''} onClick={() => setActiveTab('contacts')}>Contacts</button></div>
        {activeTab === 'contract' && <div className="dashboard-tab-content"><div className="panel-head"><div><span>Engagement</span><h2>Contract Details</h2></div><span className="contract-status">{contract.status}</span></div>
          <div className="contract-form">
            <SelectField label="Product Offering" value={contract.offering} options={CONTRACT_OFFERINGS} onChange={patchOffering} />
            <SelectField label="Engagement Basis" value={contract.engagement} options={engagements} onChange={(value) => setContract((current) => ({ ...current, engagement: value }))} />
            <SelectField label="Pricing Tier" value={contract.tier} options={tiers} onChange={(value) => setContract((current) => ({ ...current, tier: value }))} />
            <SelectField label="Contract Status" value={contract.status} options={CONTRACT_STATUS_OPTIONS} onChange={(value) => setContract((current) => ({ ...current, status: value }))} />
            <Field label="Contract / Proposal Number" value={contract.contractNumber} onChange={(value) => setContract((current) => ({ ...current, contractNumber: value }))} />
            <Field label="Contract Amount" value={contract.amount} onChange={(value) => setContract((current) => ({ ...current, amount: value }))} />
            <Field label="Start Date" type="date" value={contract.startDate} onChange={(value) => setContract((current) => ({ ...current, startDate: value }))} />
            <Field label="Target Completion" type="date" value={contract.targetDate} onChange={(value) => setContract((current) => ({ ...current, targetDate: value }))} />
            <div className="pricing-guidance"><span>Established pricing guidance</span><b>{pricingGuidance(contract)}</b><p>Products 1–3 include one virtual review meeting per bid cycle. Travel is included within the established 50-mile Atlanta radius; mileage is reimbursable and travel time is excluded from monthly hours.</p></div>
            <label className="field contract-notes"><span>Contract Notes</span><textarea value={contract.notes} onChange={(event) => setContract((current) => ({ ...current, notes: event.target.value }))} placeholder="Scope limits, billing terms, meeting allowances, add-ons, or special conditions..." /></label>
          </div>
          <div className="contract-actions"><button className="primary" onClick={() => { saveContract(contract); message('Saved', 'Contract Details were saved.'); }}>Save Contract Details</button></div>
        </div>}
        {activeTab === 'contacts' && <div className="dashboard-tab-content contacts-tab"><div className="panel-head"><div><span>Project Team</span><h2>Project Contacts</h2></div><button onClick={() => go('customers')}>Customer Database</button></div>
          {!customer ? <div className="empty-panel"><b>No customer selected.</b><p>Select a customer in Project Setup, then choose the contacts assigned to this project.</p></div> : <>
            <div className="customer-summary"><b>{customer.name}</b><span>{[customer.address1, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || 'Address not entered'}</span></div>
            <div className="project-contact-picker">{availableContacts.length ? availableContacts.map((contact) => <label key={contact.id}><input type="checkbox" checked={contactIds.includes(contact.id)} onChange={() => toggleContact(contact.id)} /><div><b>{contact.name || 'Unnamed contact'}</b><span>{contact.title || 'Title not entered'}</span><small>{contact.email || 'Email not entered'}{contact.phone ? ` · ${contact.phone}` : ''}</small></div></label>) : <div className="empty-panel compact"><b>No contacts saved for this customer.</b><p>Add contacts in the Customer Database.</p></div>}</div>
            {selectedContacts.length > 0 && <div className="selected-contact-count">{selectedContacts.length} contact{selectedContacts.length === 1 ? '' : 's'} selected for this project</div>}
            <div className="contract-actions"><button className="primary" onClick={() => { saveContacts(contactIds); message('Saved', 'Project Contacts were saved.'); }}>Save Project Contacts</button></div>
          </>}
        </div>}
      </section>
    </div>
  </>;
}
function Nav({ label, items, view, setView }: { label: string; items: [View, string][]; view: View; setView: (view: View) => void }) { return <div className="nav-group"><span>{label}</span>{items.map(([id, name]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{name}</button>)}</div>; }
function SimplePage({ title, text }: { title: string; text: string }) { return <><PageHead eyebrow="Internal" title={title} description={text} /><div className="empty-state large"><b>{title}</b></div></>; }
function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <div className="page-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function Metric({ n, label }: { n: number; label: string }) { return <div className="metric"><b>{n}</b><span>{label}</span></div>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="field"><span>{label}</span><input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, options, optionLabels, onChange, compact = false }: { label: string; value: string; options: string[]; optionLabels?: string[]; onChange: (value: string) => void; compact?: boolean }) { return <label className={`field select-field ${compact ? 'compact' : ''}`}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option, index) => <option key={`${option}-${index}`} value={option}>{optionLabels?.[index] ?? option}</option>)}</select></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field textarea"><span>{label}</span><textarea value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function AutoGrowTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { const ref = useRef<HTMLTextAreaElement>(null); useEffect(() => { if (!ref.current) return; ref.current.style.height = 'auto'; ref.current.style.height = `${Math.max(38, ref.current.scrollHeight)}px`; }, [value]); return <label className="field textarea auto-grow"><span>{label}</span><textarea ref={ref} rows={1} value={value || ''} onChange={(event) => onChange(event.target.value)} /></label>; }
function Check({ label, value, change }: { label: string; value: boolean; change: (value: boolean) => void }) { return <label><input type="checkbox" checked={value} onChange={(event) => change(event.target.checked)} /><span>{label}</span></label>; }
