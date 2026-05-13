'use client';

import { useRef, useState } from 'react';
import {
  FileSignature,
  Plus,
  Upload,
  ExternalLink,
  Loader2,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@gitroom/frontend/components/shadcn/ui/button';
import { Badge } from '@gitroom/frontend/components/shadcn/ui/badge';
import { Modal } from '@gitroom/frontend/components/shadcn/ui/modal';
import { Input } from '@gitroom/frontend/components/shadcn/ui/input';
import {
  useContracts,
  useInfluencers,
  useManagerMutations,
  type ContractRow,
} from '@gitroom/frontend/hooks/manager';
import { cn } from '@gitroom/frontend/lib/utils';

const statusMeta: Record<
  ContractRow['status'],
  { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  SENT: { label: 'Sent', variant: 'warning' },
  SIGNED: { label: 'Signed', variant: 'success' },
  EXPIRED: { label: 'Expired', variant: 'destructive' },
};

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ContractsPage() {
  const { data, isLoading } = useContracts();
  const { data: influencers } = useInfluencers();
  const { deleteContract, updateContract } = useManagerMutations();
  const [addOpen, setAddOpen] = useState(false);

  const expiringSoon = (data ?? []).filter((c) => c.expiringSoon);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:px-8 lg:py-5">
        <div>
          <div className="text-lg font-semibold text-gray-900">Contracts</div>
          <div className="text-xs text-gray-500">{(data ?? []).length} on file</div>
        </div>
        <Button className="h-11" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> New contract
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-8 lg:py-6">
        {expiringSoon.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="text-sm text-amber-900">
              <div className="font-medium">
                {expiringSoon.length} contract{expiringSoon.length === 1 ? '' : 's'} expiring within 30 days
              </div>
              <div className="text-xs text-amber-800">
                {expiringSoon.map((c) => c.brand).join(', ')}
              </div>
            </div>
          </div>
        )}

        {isLoading && !data ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading contracts…
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <FileSignature className="h-6 w-6" />
            </div>
            <div className="mt-4 text-sm font-semibold text-gray-900">No contracts yet</div>
            <p className="mt-1 text-xs text-gray-500">
              Upload PDFs, track status, get reminded before they expire.
            </p>
            <Button className="mt-4 h-11" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add your first contract
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {(data ?? []).map((c) => (
              <ContractItem
                key={c.id}
                contract={c}
                onDelete={async () => {
                  if (!confirm(`Delete contract for ${c.brand}?`)) return;
                  try {
                    await deleteContract(c.id);
                  } catch (e) {
                    alert((e as Error).message);
                  }
                }}
                onTransition={async (status) => {
                  try {
                    const now = new Date().toISOString();
                    await updateContract(c.id, {
                      status,
                      ...(status === 'SENT' && !c.sentAt ? { sentAt: now } : {}),
                      ...(status === 'SIGNED' && !c.signedAt ? { signedAt: now } : {}),
                    });
                  } catch (e) {
                    alert((e as Error).message);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <AddContractModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        influencers={influencers ?? []}
      />
    </div>
  );
}

function ContractItem({
  contract,
  onDelete,
  onTransition,
}: {
  contract: ContractRow;
  onDelete: () => Promise<void>;
  onTransition: (status: ContractRow['status']) => Promise<void>;
}) {
  const meta = statusMeta[contract.expired ? 'EXPIRED' : contract.status];
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              contract.expired
                ? 'bg-red-50 text-red-700'
                : contract.expiringSoon
                ? 'bg-amber-50 text-amber-700'
                : 'bg-gray-50 text-gray-700'
            )}
          >
            <FileSignature className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">{contract.brand}</div>
            <div className="truncate text-xs text-gray-500">{contract.templateName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
              {contract.expiresAt && (
                <span>
                  Expires {fmtDate(contract.expiresAt)}
                </span>
              )}
              {contract.signedAt && <span>· Signed {fmtDate(contract.signedAt)}</span>}
            </div>
          </div>
        </div>
        <Badge variant={meta.variant} className="shrink-0">{meta.label}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {contract.documentUrl && (
            <a
              href={contract.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open PDF
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {contract.status === 'DRAFT' && (
            <button
              onClick={() => onTransition('SENT')}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
            >
              <Send className="h-3.5 w-3.5" /> Mark sent
            </button>
          )}
          {contract.status === 'SENT' && (
            <button
              onClick={() => onTransition('SIGNED')}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark signed
            </button>
          )}
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

interface AddContractModalProps {
  open: boolean;
  onClose: () => void;
  influencers: { id: string; name: string }[];
}

function AddContractModal({ open, onClose, influencers }: AddContractModalProps) {
  const { createContract, uploadContractPdf } = useManagerMutations();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    brand: '',
    templateName: 'Standard collaboration agreement',
    influencerId: '',
    expiresAt: '',
    documentUrl: '',
  });

  const onPickFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('PDF too large (max 10MB)');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadContractPdf(file);
      setForm((f) => ({ ...f, documentUrl: result.path }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.brand.trim()) return setError('Brand is required');
    if (!form.templateName.trim()) return setError('Template name is required');
    setSubmitting(true);
    setError(null);
    try {
      await createContract({
        brand: form.brand.trim(),
        templateName: form.templateName.trim(),
        influencerId: form.influencerId || undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        documentUrl: form.documentUrl || undefined,
      });
      setForm({
        brand: '',
        templateName: 'Standard collaboration agreement',
        influencerId: '',
        expiresAt: '',
        documentUrl: '',
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New contract"
      description="Track a brand-creator agreement."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-11">
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || uploading} className="h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <FieldGroup label="Brand *">
          <Input
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            placeholder="Bloom & Co."
          />
        </FieldGroup>
        <FieldGroup label="Template / agreement name *">
          <Input
            value={form.templateName}
            onChange={(e) => setForm((f) => ({ ...f, templateName: e.target.value }))}
          />
        </FieldGroup>
        <FieldGroup label="Influencer">
          <select
            value={form.influencerId}
            onChange={(e) => setForm((f) => ({ ...f, influencerId: e.target.value }))}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          >
            <option value="">— None —</option>
            {influencers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </FieldGroup>
        <FieldGroup label="Expires">
          <Input
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          />
        </FieldGroup>
        <FieldGroup label="Contract PDF">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="h-11"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {form.documentUrl ? 'Replace PDF' : 'Upload PDF'}
            </Button>
            {form.documentUrl && (
              <a
                href={form.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 underline"
              >
                <ExternalLink className="h-3 w-3" /> View
              </a>
            )}
          </div>
        </FieldGroup>
      </div>
    </Modal>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
