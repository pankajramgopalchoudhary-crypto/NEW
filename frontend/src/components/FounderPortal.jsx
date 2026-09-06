/**
 * FounderPortal — full 17-step lifecycle tracker, appointments, vault, compliance,
 * renewals, invoices, profile (with version history).
 *
 * Shown as the main left column on the client Dashboard.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2, Clock, Circle, AlertTriangle, MapPin, Calendar, Phone,
  Download, ChevronRight, FolderOpen, FileText, ShieldCheck, Bell,
  Building2, CreditCard, FileBadge2, Stamp, Lock,
} from 'lucide-react';
import { lifecycleApi } from '../lib/backendApi';
import { Button } from './ui/button';
import DocumentOCRUploader from './DocumentOCRUploader';

const STEP_ICONS = {
  lead_created: FileText, consultation_scheduled: Phone, activity_selected: Stamp,
  freezone_selected: Building2, quotation_approved: FileBadge2, payment_received: CreditCard,
  name_reservation: Stamp, initial_approval: ShieldCheck, license_issued: FileBadge2,
  establishment_card: FileBadge2, visa_application: FileText, medical_test: Calendar,
  biometrics: Calendar, emirates_id_processing: Clock, emirates_id_issued: CheckCircle2,
  bank_account: Building2, completed: CheckCircle2,
};

function StepStatusPill({ status }) {
  const map = {
    completed:   { l: 'Completed', cls: 'bg-emerald-100 text-emerald-800' },
    in_progress: { l: 'In progress', cls: 'bg-amber-100 text-amber-800' },
    blocked:     { l: 'Blocked', cls: 'bg-rose-100 text-rose-800' },
    pending:     { l: 'Pending', cls: 'bg-slate-100 text-slate-600' },
  };
  const v = map[status] || map.pending;
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${v.cls}`}>{v.l}</span>;
}

// ---------------------------- PROGRESS TRACKER ----------------------------
function ProgressTracker({ orderRef, steps, stepsDef }) {
  if (!orderRef) {
    return <EmptyCard title="No active order" desc="Once you place an order, the 17-step setup tracker will appear here." />;
  }
  const completedCount = Object.values(steps || {}).filter(s => s.status === 'completed').length;
  const inProgressIdx = stepsDef.findIndex(s => (steps?.[s.key]?.status || 'pending') === 'in_progress');
  const currentIdx = inProgressIdx >= 0 ? inProgressIdx : Math.min(completedCount, stepsDef.length - 1);
  const pct = Math.round((completedCount / stepsDef.length) * 100);

  return (
    <div className="card-elevated rounded-2xl p-6" data-testid="fp-progress-tracker">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-lg font-semibold text-slate-900">Company Formation Tracker</div>
          <div className="text-[11px] text-slate-500">Order ref: <span className="font-mono">{orderRef}</span> · {completedCount} / {stepsDef.length} steps complete</div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl font-bold brand-emerald">{pct}%</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">complete</div>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-700 to-amber-500 transition-all duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>

      <ol className="mt-5 relative space-y-3">
        <span aria-hidden className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />
        {stepsDef.map((sd, idx) => {
          const s = steps?.[sd.key] || { status: 'pending' };
          const Icon = STEP_ICONS[sd.key] || Circle;
          const isCurrent = idx === currentIdx && s.status !== 'completed';
          const ringCls = s.status === 'completed'
            ? 'bg-emerald-700 text-white'
            : isCurrent ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500';
          return (
            <li key={sd.key} className="relative pl-10" data-testid={`step-${sd.key}`}>
              <div className={`absolute left-0 top-0 h-7 w-7 rounded-full grid place-items-center ring-4 ring-white ${ringCls}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{idx + 1}. {sd.title}</div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
                    {s.assigned_staff_email && <span>👤 {s.assigned_staff_email}</span>}
                    {s.date_started && <span>Started {new Date(s.date_started).toLocaleDateString()}</span>}
                    {s.date_completed && <span className="text-emerald-700">Done {new Date(s.date_completed).toLocaleDateString()}</span>}
                    {s.expected_completion && !s.date_completed && <span className="text-amber-700">ETA {new Date(s.expected_completion).toLocaleDateString()}</span>}
                  </div>
                  {s.notes && <div className="text-[11px] text-slate-600 mt-0.5 italic">{s.notes}</div>}
                </div>
                <StepStatusPill status={s.status} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------- APPOINTMENTS ----------------------------
function Appointments({ appointments }) {
  if (!appointments.length) {
    return <EmptyCard title="No appointments yet" desc="Medical test, biometrics and visa stamping appointments will appear here once scheduled." />;
  }
  const fmt = (s) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const label = {
    medical_test: 'Medical Test', biometrics: 'EID Biometrics',
    visa_stamping: 'Visa Stamping', bank_meeting: 'Bank Meeting', consultation: 'Consultation',
  };
  return (
    <div className="card-elevated rounded-2xl p-6" data-testid="fp-appointments">
      <div className="font-display text-lg font-semibold text-slate-900">Upcoming Appointments</div>
      <div className="mt-4 space-y-3">
        {appointments.map((a) => (
          <div key={a.id} className="p-4 rounded-xl border border-slate-200 bg-white" data-testid={`appt-${a.id}`}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">{label[a.appointment_type] || a.appointment_type}</div>
                <div className="font-semibold text-slate-900 mt-0.5">{a.location_name}</div>
                <div className="text-[12px] text-slate-600 flex items-center gap-1 mt-1"><Calendar className="h-3.5 w-3.5" /> {fmt(a.date)}</div>
                <div className="text-[12px] text-slate-600 flex items-center gap-1 mt-0.5"><MapPin className="h-3.5 w-3.5" /> {a.address}</div>
                {a.contact_number && <div className="text-[12px] text-slate-600 flex items-center gap-1 mt-0.5"><Phone className="h-3.5 w-3.5" /> {a.contact_number}</div>}
                {a.documents_required?.length > 0 && (
                  <div className="mt-2 text-[11px] text-slate-700"><b>Bring:</b> {a.documents_required.join(', ')}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {a.map_url && <a href={a.map_url} target="_blank" rel="noreferrer" className="text-[11px] underline brand-emerald">Open in Maps</a>}
                <button onClick={() => alert('PDF generation coming next session.')} className="text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-300 hover:border-emerald-700/40" data-testid={`appt-pdf-${a.id}`}>
                  <Download className="h-3 w-3" /> PDF
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------- DOCUMENT VAULT ----------------------------
const VAULT_DEF = [
  { key: 'company',   label: 'Company Documents',  desc: 'Trade License · MOA · Share Certificate · Incorporation · EC' },
  { key: 'visa',      label: 'Visa Documents',     desc: 'Visa copy · Medical · EID' },
  { key: 'tax',       label: 'Tax Documents',      desc: 'VAT Certificate · Tax Registration' },
  { key: 'bank',      label: 'Bank Documents',     desc: 'Statements · IBAN Letter' },
  { key: 'contracts', label: 'Contracts',          desc: 'Rental · Service Agreements' },
];

function DocumentVault({ folders, onAdd }) {
  return (
    <div className="card-elevated rounded-2xl p-6" data-testid="fp-vault">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2"><Lock className="h-4 w-4 brand-emerald" /> Document Vault</div>
          <div className="text-[11px] text-slate-500">Everything stored permanently. Download anytime. Never ask support again.</div>
        </div>
      </div>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        {VAULT_DEF.map((f) => {
          const items = folders[f.key] || [];
          return (
            <div key={f.key} className="p-4 rounded-xl border border-slate-200 bg-white" data-testid={`vault-folder-${f.key}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 brand-emerald" />
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{f.label}</div>
                    <div className="text-[10px] text-slate-500">{items.length} file{items.length === 1 ? '' : 's'}</div>
                  </div>
                </div>
                <Button onClick={() => onAdd(f.key)} variant="outline" className="h-7 px-2.5 text-[11px] rounded-full" data-testid={`vault-add-${f.key}`}>+ Upload</Button>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{f.desc}</div>
              <ul className="mt-2 space-y-1">
                {items.slice(0, 4).map((i) => (
                  <li key={i.id} className="text-[11px] text-slate-700 flex items-center justify-between gap-2 truncate">
                    <span className="truncate">📄 {i.label || i.file_name}</span>
                    <a href={`#vault-${i.id}`} className="brand-emerald shrink-0">View</a>
                  </li>
                ))}
                {items.length === 0 && <li className="text-[10px] italic text-slate-400">Empty</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------- COMPLIANCE HUB ----------------------------
function ComplianceHub({ compliance }) {
  const rows = [
    { k: 'vat_status', label: 'VAT', extra: compliance?.vat_number ? `VRN: ${compliance.vat_number}` : null, next: compliance?.vat_next_filing },
    { k: 'ct_status', label: 'Corporate Tax', extra: null, next: compliance?.ct_next_filing },
    { k: 'esr_status', label: 'ESR', extra: null },
    { k: 'ubo_status', label: 'UBO', extra: null },
    { k: 'aml_status', label: 'AML', extra: null },
  ];
  const tone = (s) => ({
    registered: 'bg-emerald-100 text-emerald-800',
    filed: 'bg-emerald-100 text-emerald-800',
    compliant: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    review: 'bg-amber-100 text-amber-800',
    not_registered: 'bg-slate-100 text-slate-600',
    not_applicable: 'bg-slate-100 text-slate-600',
  }[s] || 'bg-slate-100 text-slate-600');

  return (
    <div className="card-elevated rounded-2xl p-6" data-testid="fp-compliance">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 brand-emerald" />
        <div className="font-display text-lg font-semibold text-slate-900">Compliance Center</div>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">Stay ahead of every UAE deadline. Reminders sent 90 / 60 / 30 / 15 / 7 days ahead.</div>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => {
          const val = compliance?.[r.k] || 'not_applicable';
          return (
            <div key={r.k} className="p-3 rounded-xl border border-slate-200 bg-white" data-testid={`compliance-${r.k}`}>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{r.label}</div>
              <span className={`mt-1 inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tone(val)}`}>{val.replace(/_/g, ' ')}</span>
              {r.extra && <div className="text-[11px] text-slate-600 mt-1">{r.extra}</div>}
              {r.next && <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1"><Bell className="h-3 w-3" /> Next: {new Date(r.next).toLocaleDateString()}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------- RENEWALS ----------------------------
function Renewals({ renewals }) {
  const fmt = (s) => new Date(s).toLocaleDateString();
  const daysTo = (s) => Math.ceil((new Date(s) - new Date()) / (1000 * 60 * 60 * 24));
  if (!renewals.length) {
    return <EmptyCard title="No renewals tracked" desc="Once your trade license is issued, license / visa / EID renewals will appear here with 90/60/30/15/7-day reminders." />;
  }
  return (
    <div className="card-elevated rounded-2xl p-6" data-testid="fp-renewals">
      <div className="font-display text-lg font-semibold text-slate-900">Renewal Engine</div>
      <div className="mt-3 space-y-2">
        {renewals.map((r) => {
          const d = daysTo(r.due_date);
          const tone = d < 30 ? 'bg-rose-100 text-rose-800' : d < 90 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-white">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 capitalize">{r.renewal_type.replace(/_/g, ' ')}</div>
                <div className="text-[11px] text-slate-500">Due {fmt(r.due_date)}{r.notes ? ` · ${r.notes}` : ''}</div>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tone}`}>
                {d > 0 ? `${d}d left` : 'Overdue'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------- INVOICES ----------------------------
function Invoices({ invoices }) {
  if (!invoices.length) {
    return <EmptyCard title="No invoices yet" desc="Quotations, invoices and receipts will appear here once issued by your advisor." />;
  }
  return (
    <div className="card-elevated rounded-2xl p-6" data-testid="fp-invoices">
      <div className="font-display text-lg font-semibold text-slate-900">Quotations & Invoices</div>
      <div className="mt-3 space-y-2">
        {invoices.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-white">
            <div className="min-w-0">
              <div className="font-mono text-xs text-slate-500">{i.number}</div>
              <div className="text-sm font-semibold text-slate-900 capitalize">{i.doc_type.replace(/_/g, ' ')}</div>
              <div className="text-[11px] text-slate-500">{new Date(i.created_at).toLocaleDateString()}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-slate-900">{i.currency} {Number(i.total).toLocaleString()}</div>
              <button className="text-[11px] inline-flex items-center gap-1 mt-1 brand-emerald"><Download className="h-3 w-3" /> PDF</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------- EMPTY STATE ----------------------------
function EmptyCard({ title, desc }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center" data-testid="fp-empty">
      <AlertTriangle className="h-5 w-5 text-slate-400 mx-auto" />
      <div className="font-display text-sm font-semibold text-slate-700 mt-2">{title}</div>
      <div className="text-[12px] text-slate-500 mt-1">{desc}</div>
    </div>
  );
}

// ---------------------------- MAIN COMPONENT ----------------------------
const TABS = [
  { key: 'tracker',     label: 'Setup Tracker' },
  { key: 'appointments',label: 'Appointments' },
  { key: 'vault',       label: 'Vault' },
  { key: 'compliance',  label: 'Compliance' },
  { key: 'renewals',    label: 'Renewals' },
  { key: 'invoices',    label: 'Invoices' },
];

export default function FounderPortal({ orderRef }) {
  const [tab, setTab] = useState('tracker');
  const [stepsDef, setStepsDef] = useState([]);
  const [progress, setProgress] = useState({ steps: {} });
  const [appointments, setAppointments] = useState([]);
  const [vault, setVault] = useState({ folders: {} });
  const [compliance, setCompliance] = useState({});
  const [renewals, setRenewals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ocrModalFolder, setOcrModalFolder] = useState('');

  const loadAll = useCallback(async () => {
    setBusy(true);
    try {
      const sd = await lifecycleApi.getProgressSteps().catch(() => ({ steps: [] }));
      setStepsDef(sd.steps || []);
      if (orderRef) {
        const p = await lifecycleApi.getProgress(orderRef).catch(() => ({ steps: {} }));
        setProgress(p);
      }
      const [appts, v, comp, ren, inv] = await Promise.all([
        lifecycleApi.listAppointments().catch(() => ({ appointments: [] })),
        lifecycleApi.listVault().catch(() => ({ folders: {} })),
        lifecycleApi.getCompliance().catch(() => ({})),
        lifecycleApi.listRenewals().catch(() => ({ renewals: [] })),
        lifecycleApi.listInvoices().catch(() => ({ invoices: [] })),
      ]);
      setAppointments(appts.appointments || []);
      setVault(v);
      setCompliance(comp);
      setRenewals(ren.renewals || []);
      setInvoices(inv.invoices || []);
    } finally { setBusy(false); }
  }, [orderRef]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onVaultAdd = (folder) => setOcrModalFolder(folder);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap" data-testid="fp-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 h-9 rounded-full text-[12px] font-semibold transition-colors border ${
              tab === t.key ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-700/40'
            }`}
            data-testid={`fp-tab-${t.key}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'tracker'      && <ProgressTracker orderRef={orderRef} steps={progress.steps} stepsDef={stepsDef} />}
      {tab === 'appointments' && <Appointments appointments={appointments} />}
      {tab === 'vault'        && <DocumentVault folders={vault.folders || {}} onAdd={onVaultAdd} />}
      {tab === 'compliance'   && <ComplianceHub compliance={compliance} />}
      {tab === 'renewals'     && <Renewals renewals={renewals} />}
      {tab === 'invoices'     && <Invoices invoices={invoices} />}

      {ocrModalFolder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOcrModalFolder('')}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-lg font-semibold text-slate-900 capitalize">Upload to {ocrModalFolder}</div>
            <p className="text-xs text-slate-500 mt-1">Optional: use our AI scanner to auto-fill your profile from passport / Emirates ID.</p>
            <div className="mt-4 space-y-2">
              <DocumentOCRUploader docType="passport"   label="Scan passport"     onResult={() => { loadAll(); setOcrModalFolder(''); }} />
              <DocumentOCRUploader docType="emirates_id" label="Scan Emirates ID" onResult={() => { loadAll(); setOcrModalFolder(''); }} />
            </div>
            <Button onClick={() => setOcrModalFolder('')} variant="outline" className="rounded-full w-full mt-5 h-10">Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
