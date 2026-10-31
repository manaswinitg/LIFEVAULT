import React, { useEffect, useState } from 'react';
import { HeartHandshake, UserPlus, Clock, AlertTriangle, CheckCircle2, XCircle, ShieldCheck, FileText } from 'lucide-react';
import { EmergencyService, DocumentService } from '../services/api';
import { TrustedContact, EmergencyAccessPolicy, DocumentItem } from '../types';

export const EmergencyAccessPage: React.FC = () => {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [policies, setPolicies] = useState<EmergencyAccessPolicy[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add contact form modal
  const [showAddContact, setShowAddContact] = useState<boolean>(false);
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('');

  // Add policy form modal
  const [showAddPolicy, setShowAddPolicy] = useState<boolean>(false);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [waitingHours, setWaitingHours] = useState<number>(48);
  const [canAccessAll, setCanAccessAll] = useState<boolean>(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cData, pData, dData] = await Promise.all([
        EmergencyService.getContacts(),
        EmergencyService.getPolicies(),
        DocumentService.list(),
      ]);
      setContacts(cData);
      setPolicies(pData);
      setDocuments(dData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await EmergencyService.addContact({
        contact_name: contactName,
        contact_email: contactEmail,
        phone: contactPhone,
        relationship,
      });
      setShowAddContact(false);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setRelationship('');
      fetchData();
    } catch (err: any) {
      alert('Failed to add contact: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) return;
    try {
      await EmergencyService.createPolicy({
        trusted_contact_id: selectedContactId,
        waiting_period_hours: waitingHours,
        can_access_all: canAccessAll,
        document_ids: canAccessAll ? undefined : selectedDocIds,
      });
      setShowAddPolicy(false);
      setSelectedContactId('');
      setSelectedDocIds([]);
      fetchData();
    } catch (err: any) {
      alert('Failed to create policy: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (window.confirm('Remove this trusted contact? Any associated emergency policies will also be deleted.')) {
      await EmergencyService.deleteContact(id);
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Emergency & Break-Glass Protocol</h1>
          <p className="text-xs text-slate-500">
            Designate trusted contacts with mandatory waiting periods, veto timers, and access scoping.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddContact(true)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Trusted Contact</span>
          </button>
          <button
            onClick={() => setShowAddPolicy(true)}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <HeartHandshake className="h-4 w-4" />
            <span>Create Access Policy</span>
          </button>
        </div>
      </div>

      {/* Security Invariant Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 space-y-1">
        <div className="flex items-center space-x-2 font-bold">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <span>Security Invariant: Explicit Waiting Period & Real-Time Veto</span>
        </div>
        <p className="text-blue-800 text-[11px] leading-relaxed">
          Emergency access requires an explicit waiting period (e.g. 48 hours). When triggered, LifeVault immediately notifies your email and dashboard. You can veto and cancel the request at any time before the deadline. Documents are never released automatically without this notice.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Trusted Contacts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Designated Trusted Contacts ({contacts.length})
          </h2>

          {contacts.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No trusted contacts added yet.</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900">{c.contact_name}</span>
                    <span className="ml-2 text-slate-500">({c.relationship || 'Contact'})</span>
                    <p className="text-[11px] text-slate-500">{c.contact_email} {c.phone ? `• ${c.phone}` : ''}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteContact(c.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency Access Policies */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Configured Access Policies ({policies.length})
          </h2>

          {policies.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No emergency policies created yet.</p>
          ) : (
            <div className="space-y-3">
              {policies.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{p.trusted_contact.contact_name}</span>
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                      {p.waiting_period_hours} Hours Waiting Period
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Scope: {p.can_access_all ? 'Entire Vault (All Records)' : `${p.specific_documents?.length || 0} Specified Documents`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add Contact */}
      {showAddContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Add Trusted Contact</h3>
            <form onSubmit={handleAddContact} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="jane.smith@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Relationship</label>
                <input
                  type="text"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="e.g. Spouse / Sibling / Attorney"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Phone (Optional)</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1-555-0199"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  className="rounded-lg border px-3 py-1.5 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Policy */}
      {showAddPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Create Emergency Access Policy</h3>
            <form onSubmit={handleAddPolicy} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Designate Trusted Contact</label>
                <select
                  required
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none"
                >
                  <option value="">Select a contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contact_name} ({c.contact_email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Mandatory Waiting Period</label>
                <select
                  value={waitingHours}
                  onChange={(e) => setWaitingHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none"
                >
                  <option value={24}>24 Hours</option>
                  <option value={48}>48 Hours (Recommended)</option>
                  <option value={72}>72 Hours</option>
                  <option value={168}>7 Days</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={canAccessAll}
                    onChange={(e) => setCanAccessAll(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Permit access to entire vault</span>
                </label>
              </div>

              {!canAccessAll && (
                <div>
                  <label className="block font-semibold text-slate-700">Select Specific Documents</label>
                  <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {documents.map((d) => (
                      <label key={d.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedDocIds.includes(d.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDocIds([...selectedDocIds, d.id]);
                            } else {
                              setSelectedDocIds(selectedDocIds.filter((id) => id !== d.id));
                            }
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="truncate">{d.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPolicy(false)}
                  className="rounded-lg border px-3 py-1.5 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700"
                >
                  Establish Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
