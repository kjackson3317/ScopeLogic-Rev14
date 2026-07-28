import { createClient } from './supabase/client';

type AnyRecord = Record<string, any>;

export type LocalImportSnapshot = {
  projects: AnyRecord[];
  issuesByProject: Record<string, AnyRecord[]>;
  docsByProject: Record<string, AnyRecord[]>;
  templates: AnyRecord[];
  notesByProject: Record<string, string>;
  exportsByProject: Record<string, AnyRecord[]>;
  emailSettings: AnyRecord;
  calendarEntries: AnyRecord[];
  customers: AnyRecord[];
};

export type LocalImportReport = {
  importedAt: string;
  sourceKey: string;
  counts: {
    customers: number;
    contacts: number;
    projects: number;
    projectContacts: number;
    projectSystems: number;
    slrEntries: number;
    templates: number;
    documentMetadata: number;
    documentFilesPending: number;
    calendarEvents: number;
    contracts: number;
    internalNotes: number;
    exportEntries: number;
  };
  note: string;
};

const SOURCE_KEY = 'scopelogic-r14-8-browser-import-v1';

const dateOnly = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  return parsed.toISOString().slice(0, 10);
};

const timestamp = (value: unknown) => {
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const requireResult = <T extends { error: any }>(result: T, label: string) => {
  if (result.error) throw new Error(`${label}: ${result.error.message || String(result.error)}`);
  return result;
};

const chunks = <T,>(items: T[], size = 200) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

async function insertInChunks(supabase: ReturnType<typeof createClient>, table: string, rows: AnyRecord[]) {
  for (const group of chunks(rows)) requireResult(await supabase.from(table).insert(group), `Insert ${table}`);
}

export async function inspectPriorImport() {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Your ScopeLogic session is not available. Sign in again.');
  const result = await supabase.from('import_runs').select('status, counts, imported_at, error_message').eq('source_key', SOURCE_KEY).maybeSingle();
  if (result.error && result.error.code !== 'PGRST116') throw new Error(result.error.message);
  return result.data;
}

export async function importLocalScopeLogicData(snapshot: LocalImportSnapshot): Promise<LocalImportReport> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Your ScopeLogic session expired. Sign in again before importing.');
  const ownerId = user.id;

  const existing = await supabase.from('import_runs').select('status').eq('source_key', SOURCE_KEY).maybeSingle();
  if (existing.data?.status === 'completed') throw new Error('This browser workspace has already been imported. The local browser copy remains available as a fallback.');

  const customers = Array.isArray(snapshot.customers) ? snapshot.customers : [];
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const templates = Array.isArray(snapshot.templates) ? snapshot.templates : [];
  const calendarEntries = Array.isArray(snapshot.calendarEntries) ? snapshot.calendarEntries : [];

  try {
    const customerPayload = customers.map((customer, index) => ({
      owner_id: ownerId,
      legacy_id: String(customer.id || `customer-${index + 1}`),
      company_name: String(customer.name || 'Unnamed Customer'),
      address1: String(customer.address1 || ''),
      address2: String(customer.address2 || ''),
      city: String(customer.city || ''),
      state: String(customer.state || ''),
      postal_code: String(customer.zip || ''),
      website: String(customer.website || ''),
      notes: String(customer.notes || ''),
    }));
    if (customerPayload.length) requireResult(await supabase.from('customers').upsert(customerPayload, { onConflict: 'owner_id,legacy_id' }), 'Import customers');
    const customerLegacyIds = customerPayload.map((row) => row.legacy_id);
    const customerLookupResult = customerLegacyIds.length
      ? requireResult(await supabase.from('customers').select('id,legacy_id').eq('owner_id', ownerId).in('legacy_id', customerLegacyIds), 'Read imported customers')
      : { data: [] as AnyRecord[], error: null };
    const customerMap = new Map((customerLookupResult.data || []).map((row: AnyRecord) => [String(row.legacy_id), row.id]));

    const contacts = customers.flatMap((customer, customerIndex) => (Array.isArray(customer.contacts) ? customer.contacts : []).map((contact: AnyRecord, contactIndex: number) => ({
      owner_id: ownerId,
      customer_id: customerMap.get(String(customer.id || `customer-${customerIndex + 1}`)) || null,
      legacy_id: String(contact.id || `contact-${customerIndex + 1}-${contactIndex + 1}`),
      name: String(contact.name || 'Unnamed Contact'),
      title: String(contact.title || ''),
      email: String(contact.email || ''),
      phone: String(contact.phone || ''),
    })));
    if (contacts.length) requireResult(await supabase.from('contacts').upsert(contacts, { onConflict: 'owner_id,legacy_id' }), 'Import contacts');
    const contactLegacyIds = contacts.map((row) => row.legacy_id);
    const contactLookupResult = contactLegacyIds.length
      ? requireResult(await supabase.from('contacts').select('id,legacy_id').eq('owner_id', ownerId).in('legacy_id', contactLegacyIds), 'Read imported contacts')
      : { data: [] as AnyRecord[], error: null };
    const contactMap = new Map((contactLookupResult.data || []).map((row: AnyRecord) => [String(row.legacy_id), row.id]));

    const projectPayload = projects.map((project, index) => ({
      owner_id: ownerId,
      legacy_id: String(project.id || `project-${index + 1}`),
      name: String(project.name || 'Untitled ScopeLogic Project'),
      client_name: String(project.client || ''),
      customer_id: customerMap.get(String(project.customerId || '')) || null,
      version_date: dateOnly(project.versionDate || project.bidDate),
      status: String(project.status || 'Planning'),
      revision: String(project.revision || 'Rev 0'),
      modified_label: String(project.modified || ''),
    }));
    if (projectPayload.length) requireResult(await supabase.from('projects').upsert(projectPayload, { onConflict: 'owner_id,legacy_id' }), 'Import projects');
    const projectLegacyIds = projectPayload.map((row) => row.legacy_id);
    const projectLookupResult = projectLegacyIds.length
      ? requireResult(await supabase.from('projects').select('id,legacy_id').eq('owner_id', ownerId).in('legacy_id', projectLegacyIds), 'Read imported projects')
      : { data: [] as AnyRecord[], error: null };
    const projectMap = new Map((projectLookupResult.data || []).map((row: AnyRecord) => [String(row.legacy_id), row.id]));
    const importedProjectIds = Array.from(projectMap.values()).filter(Boolean);

    if (importedProjectIds.length) {
      for (const table of ['project_contacts', 'project_systems', 'slr_entries', 'project_documents', 'export_log']) {
        requireResult(await supabase.from(table).delete().in('project_id', importedProjectIds), `Prepare ${table}`);
      }
    }

    const projectContactRows: AnyRecord[] = [];
    const projectSystemRows: AnyRecord[] = [];
    const slrRows: AnyRecord[] = [];
    const documentRows: AnyRecord[] = [];
    const contractRows: AnyRecord[] = [];
    const noteRows: AnyRecord[] = [];
    const exportRows: AnyRecord[] = [];

    projects.forEach((project, projectIndex) => {
      const legacyProjectId = String(project.id || `project-${projectIndex + 1}`);
      const projectId = projectMap.get(legacyProjectId);
      if (!projectId) return;

      (Array.isArray(project.contactIds) ? project.contactIds : []).forEach((legacyContactId: string) => {
        const contactId = contactMap.get(String(legacyContactId));
        if (contactId) projectContactRows.push({ owner_id: ownerId, project_id: projectId, contact_id: contactId });
      });

      (Array.isArray(project.systems) ? project.systems : []).forEach((system: string) => {
        if (String(system).trim()) projectSystemRows.push({ owner_id: ownerId, project_id: projectId, system_name: String(system).trim() });
      });

      (snapshot.issuesByProject?.[legacyProjectId] || []).forEach((issue: AnyRecord, issueIndex: number) => {
        const sequence = issueIndex + 1;
        slrRows.push({
          owner_id: ownerId,
          project_id: projectId,
          legacy_uid: String(issue.uid || `${legacyProjectId}-slr-${sequence}`),
          sequence_number: sequence,
          display_number: `SLR-${String(sequence).padStart(3, '0')}`,
          system_name: String(issue.system || 'Structured Cabling'),
          custom_system: String(issue.customSystem || ''),
          scope_item: String(issue.title || 'Untitled Scope Item'),
          status: String(issue.status || 'Open'),
          scope_concern: String(issue.concern || ''),
          rfi_question: String(issue.rfiQuestion || ''),
          recommended_bid_basis: String(issue.basis || ''),
          reason_basis: String(issue.reason || ''),
          reference: String(issue.reference || ''),
          rfi_number: String(issue.rfi || ''),
          resolution: String(issue.resolution || ''),
          snippet_number: String(issue.snippet || ''),
          include_sow: Boolean(issue.sow),
          include_clarification: Boolean(issue.clarification),
          include_formal_rfi: Boolean(issue.formalRfi),
          checklist_scope_item: String(issue.checklistItem || ''),
          contractor_response: String(issue.response || 'Included'),
          contractor_response_reason: String(issue.responseReason || ''),
        });
      });

      (snapshot.docsByProject?.[legacyProjectId] || []).forEach((doc: AnyRecord, docIndex: number) => {
        documentRows.push({
          owner_id: ownerId,
          project_id: projectId,
          legacy_id: String(doc.id || `${legacyProjectId}-document-${docIndex + 1}`),
          document_type: String(doc.type || 'General Bid Documents'),
          display_name: String(doc.name || doc.fileName || 'Project Document'),
          revision: String(doc.revision || 'Revision 0'),
          issue_date: dateOnly(doc.date),
          is_current: Boolean(doc.current),
          notes: String(doc.notes || ''),
          original_filename: String(doc.fileName || doc.name || 'document'),
          mime_type: String(doc.fileType || 'application/octet-stream'),
          size_bytes: Number(doc.sizeBytes || 0),
          storage_path: null,
        });
      });

      const contract = project.contract || {};
      contractRows.push({
        owner_id: ownerId,
        project_id: projectId,
        offering: String(contract.offering || ''),
        engagement_basis: String(contract.engagement || ''),
        pricing_tier: String(contract.tier || ''),
        contract_number: String(contract.contractNumber || ''),
        amount: String(contract.amount || ''),
        status: String(contract.status || 'Draft'),
        start_date: dateOnly(contract.startDate),
        target_completion: dateOnly(contract.targetDate),
        notes: String(contract.notes || ''),
      });

      noteRows.push({ owner_id: ownerId, project_id: projectId, notes: String(snapshot.notesByProject?.[legacyProjectId] || '') });

      (snapshot.exportsByProject?.[legacyProjectId] || []).forEach((entry: AnyRecord, exportIndex: number) => {
        exportRows.push({
          owner_id: ownerId,
          project_id: projectId,
          legacy_id: String(entry.id || `${legacyProjectId}-export-${exportIndex + 1}`),
          filename: String(entry.fileName || 'ScopeLogic_Deliverable.pdf'),
          deliverable: String(entry.deliverable || ''),
          project_revision: String(entry.projectRevision || project.revision || ''),
          downloaded_at: timestamp(entry.downloadedAt),
        });
      });
    });

    await insertInChunks(supabase, 'project_contacts', projectContactRows);
    await insertInChunks(supabase, 'project_systems', projectSystemRows);
    await insertInChunks(supabase, 'slr_entries', slrRows);
    await insertInChunks(supabase, 'project_documents', documentRows);
    if (contractRows.length) requireResult(await supabase.from('contracts').upsert(contractRows, { onConflict: 'project_id' }), 'Import contracts');
    if (noteRows.length) requireResult(await supabase.from('internal_notes').upsert(noteRows, { onConflict: 'project_id' }), 'Import internal notes');
    await insertInChunks(supabase, 'export_log', exportRows);

    requireResult(await supabase.from('slr_templates').delete().eq('owner_id', ownerId), 'Prepare templates');
    const templateRows = templates.map((template, index) => ({
      owner_id: ownerId,
      legacy_id: String(template.uid || `template-${index + 1}`),
      name: String(template.name || 'Untitled Template'),
      template_data: template.issue || {},
      active: true,
    }));
    await insertInChunks(supabase, 'slr_templates', templateRows);

    requireResult(await supabase.from('calendar_events').delete().eq('owner_id', ownerId), 'Prepare calendar events');
    const calendarRows = calendarEntries.map((entry, index) => ({
      owner_id: ownerId,
      project_id: projectMap.get(String(entry.projectId || '')) || null,
      legacy_id: String(entry.id || `calendar-${index + 1}`),
      event_date: dateOnly(entry.date) || new Date().toISOString().slice(0, 10),
      title: String(entry.title || 'Important Date'),
      event_type: String(entry.type || 'Other'),
    }));
    await insertInChunks(supabase, 'calendar_events', calendarRows);

    requireResult(await supabase.from('user_settings').upsert({
      user_id: ownerId,
      owner_id: ownerId,
      email_settings: snapshot.emailSettings || {},
    }, { onConflict: 'user_id' }), 'Import user settings');

    const report: LocalImportReport = {
      importedAt: new Date().toISOString(),
      sourceKey: SOURCE_KEY,
      counts: {
        customers: customerPayload.length,
        contacts: contacts.length,
        projects: projectPayload.length,
        projectContacts: projectContactRows.length,
        projectSystems: projectSystemRows.length,
        slrEntries: slrRows.length,
        templates: templateRows.length,
        documentMetadata: documentRows.length,
        documentFilesPending: documentRows.length,
        calendarEvents: calendarRows.length,
        contracts: contractRows.length,
        internalNotes: noteRows.length,
        exportEntries: exportRows.length,
      },
      note: 'Database records were imported. Browser-stored document file bytes remain in IndexedDB and will be moved to the private project-files bucket during the document-storage migration phase. The local browser copy was not deleted.',
    };

    requireResult(await supabase.from('import_runs').upsert({
      owner_id: ownerId,
      source_key: SOURCE_KEY,
      status: 'completed',
      counts: report.counts,
      error_message: '',
      imported_at: report.importedAt,
    }, { onConflict: 'owner_id,source_key' }), 'Record import completion');

    requireResult(await supabase.from('activity_log').insert({
      owner_id: ownerId,
      action: 'browser_data_import_completed',
      details: report,
    }), 'Record import activity');

    return report;
  } catch (cause) {
    const errorMessage = cause instanceof Error ? cause.message : 'Unexpected browser-data import error.';
    await supabase.from('import_runs').upsert({
      owner_id: ownerId,
      source_key: SOURCE_KEY,
      status: 'failed',
      counts: {},
      error_message: errorMessage,
      imported_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,source_key' });
    throw new Error(errorMessage);
  }
}
