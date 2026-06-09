'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
   FaX as X,
   FaCopy as Copy,
   FaFloppyDisk,
   FaCheck,
   FaTrashCan,
   FaCode,
   FaGlobe,
   FaLock,
   FaUserGroup,
} from 'react-icons/fa6';
import { ShareModalProps } from '@/app/(authenticated)/(dashboard)/types';
import axiosInstance from '@/utils/axiosInstance';
import { useDashboardStore } from '../../store/dashboardStore';
import { PLATFORM_NAME } from "@/constants/branding";
import { cn } from '@/utils/cn';

interface AdminUser {
   id: number;
   email: string;
   first_name: string;
   last_name: string;
   role: 'owner' | 'admin';
}

interface LTIConfig {
   id?: number;
   microapp_id: number;
   issuer: string;
   client_id: string;
   auth_login_url: string;
   auth_token_url: string;
   key_set_url: string;
   deployment_ids: string[];
}

type ActiveTab = 'share' | 'lti';

function formatRetryAfter(seconds: number): string {
   if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
   const minutes = Math.ceil(seconds / 60);
   if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
   const hours = Math.floor(minutes / 60);
   const remainingMinutes = minutes % 60;
   if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
   return `${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
}

const ShareModal: React.FC<ShareModalProps> = ({
   app,
   showModal,
   setShowModal,
   isOwner,
   variant = 'modal',
   onPrivacySaved,
   onPermittedDomainsSaved,
}) => {
   const isInline = variant === 'inline';
   const hashId = app.hashId;
   const { updateAppPrivacy, updateAppPermittedDomains } = useDashboardStore();

   const [showShareMenu, setShowShareMenu] = useState(false);
   const [activeTab, setActiveTab] = useState<ActiveTab>('share');

   // Privacy
   const [currentPrivacy, setCurrentPrivacy] = useState(app.privacy);
   const [privacySaving, setPrivacySaving] = useState(false);
   const [privacySaved, setPrivacySaved] = useState(false);
   const privacySavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   // Permitted domains (for restricted embed)
   const [permittedDomains, setPermittedDomains] = useState<string[]>(
      app.permittedDomains ?? []
   );
   const [domainInput, setDomainInput] = useState('');
   const [domainsSaving, setDomainsSaving] = useState(false);

   // Copy feedback
   const [copiedLink, setCopiedLink] = useState(false);
   const [copiedEmbed, setCopiedEmbed] = useState(false);

   // Admins
   const [admins, setAdmins] = useState<AdminUser[]>([]);
   const [adminsLoading, setAdminsLoading] = useState(false);
   const [emailInput, setEmailInput] = useState('');
   const [addingAdmin, setAddingAdmin] = useState(false);
   const [adminError, setAdminError] = useState<string | null>(null);
   const [removingAdminId, setRemovingAdminId] = useState<number | null>(null);

   // LTI
   const [hasExistingConfig, setHasExistingConfig] = useState(false);
   const [ltiConfig, setLtiConfig] = useState<LTIConfig>({
      microapp_id: app.id,
      issuer: '',
      client_id: '',
      auth_login_url: '',
      auth_token_url: '',
      key_set_url: '',
      deployment_ids: [],
   });
   const [hasChanges, setHasChanges] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
   const initialConfigRef = useRef<LTIConfig | null>(null);

   const shareMenuRef = useRef<HTMLDivElement>(null);

   const getShareUrl = () => `${window.location.origin}/app/${hashId}`;
   const getEmbedUrl = () => `${window.location.origin}/app/embed/${hashId}`;
   const getEmbedSnippet = () =>
      `<iframe src="${getEmbedUrl()}" width="600" height="400" frameBorder="0" referrerpolicy="origin"></iframe>`;

   const normalizedPrivacy = (() => {
      const p = currentPrivacy.toLowerCase();
      if (p === 'public' || p === 'private' || p === 'restricted') return p;
      return 'private';
   })() as 'public' | 'private' | 'restricted';



   // ── Copy handlers ──────────────────────────────────────────────────────────
   const handleCopyLink = () => {
      navigator.clipboard.writeText(getShareUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
   };

   const handleCopyEmbed = () => {
      navigator.clipboard.writeText(getEmbedSnippet());
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
   };

   // ── Privacy ────────────────────────────────────────────────────────────────
   const handlePrivacyChange = async (newPrivacy: string) => {
      if (newPrivacy === currentPrivacy.toLowerCase() || privacySaving) return;
      const previous = currentPrivacy;
      setCurrentPrivacy(newPrivacy);
      setPrivacySaving(true);
      setPrivacySaved(false);
      try {
         const api = axiosInstance();
         const payload: { privacy: string; permitted_domains?: string[] } = {
            privacy: newPrivacy,
         };
         if (newPrivacy === 'restricted') {
            payload.permitted_domains = permittedDomains;
         }
         await api.patch(`/api/microapps/${app.id}`, payload);
         updateAppPrivacy(app.id, newPrivacy);
         onPrivacySaved?.(newPrivacy);
         setPrivacySaved(true);
         if (privacySavedTimerRef.current) clearTimeout(privacySavedTimerRef.current);
         privacySavedTimerRef.current = setTimeout(() => setPrivacySaved(false), 2500);
      } catch {
         setCurrentPrivacy(previous);
      } finally {
         setPrivacySaving(false);
      }
   };

   // ── Permitted domains ──────────────────────────────────────────────────────
   const normalizeDomain = (raw: string): string | null => {
      const host = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      if (!host || host.length < 2) return null;
      return host;
   };

   const handleAddDomain = async () => {
      const host = normalizeDomain(domainInput);
      if (!host || permittedDomains.includes(host)) {
         setDomainInput('');
         return;
      }
      const next = [...permittedDomains, host];
      setPermittedDomains(next);
      setDomainInput('');
      setDomainsSaving(true);
      try {
         const api = axiosInstance();
         await api.patch(`/api/microapps/${app.id}`, {
            permitted_domains: next,
         });
         updateAppPermittedDomains(app.id, next);
         onPermittedDomainsSaved?.(next);
      } catch {
         setPermittedDomains(permittedDomains);
      } finally {
         setDomainsSaving(false);
      }
   };

   const handleRemoveDomain = async (domain: string) => {
      const next = permittedDomains.filter((d) => d !== domain);
      setPermittedDomains(next);
      setDomainsSaving(true);
      try {
         const api = axiosInstance();
         await api.patch(`/api/microapps/${app.id}`, {
            permitted_domains: next,
         });
         updateAppPermittedDomains(app.id, next);
         onPermittedDomainsSaved?.(next);
      } catch {
         setPermittedDomains(permittedDomains);
      } finally {
         setDomainsSaving(false);
      }
   };

   // ── Admins ─────────────────────────────────────────────────────────────────
   const fetchAdmins = async () => {
      setAdminsLoading(true);
      try {
         const api = axiosInstance();
         const response = await api.get(`/api/microapps/${app.id}/admins/`);
         setAdmins(response.data?.data ?? []);
      } catch {
         setAdmins([]);
      } finally {
         setAdminsLoading(false);
      }
   };

   const handleAddAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      const email = emailInput.trim();
      if (!email) return;
      setAddingAdmin(true);
      setAdminError(null);
      try {
         const api = axiosInstance();
         const response = await api.post(`/api/microapps/${app.id}/admins/`, { email });
         setAdmins((prev) => [...prev, response.data.data]);
         setEmailInput('');
      } catch (err: any) {
         const status = err.response?.status;
         if (status === 404) {
            setAdminError('No account found with that email address.');
         } else if (status === 429) {
            const retryAfter = err.response?.headers?.['retry-after'];
            const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
            const waitMsg = seconds ? formatRetryAfter(seconds) : 'a little while';
            setAdminError(`Too many failed attempts. Try again in ${waitMsg}.`);
         } else if (status === 400) {
            setAdminError(err.response?.data?.error ?? 'Could not add this user.');
         } else {
            setAdminError(err.response?.data?.error ?? 'Something went wrong. Please try again.');
         }
      } finally {
         setAddingAdmin(false);
      }
   };

   const handleRemoveAdmin = async (userId: number) => {
      setRemovingAdminId(userId);
      try {
         const api = axiosInstance();
         await api.delete(`/api/microapps/${app.id}/admins/${userId}/`);
         setAdmins((prev) => prev.filter((a) => a.id !== userId));
      } catch {
         // list remains correct on next open
      } finally {
         setRemovingAdminId(null);
      }
   };

   // ── LTI ───────────────────────────────────────────────────────────────────
   const checkForChanges = (cfg: LTIConfig) => {
      if (!initialConfigRef.current) return false;
      return JSON.stringify(cfg) !== JSON.stringify(initialConfigRef.current);
   };

   const handleLtiConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      const newConfig = { ...ltiConfig, [name]: name === 'deployment_ids' ? [value] : value };
      setLtiConfig(newConfig);
      setHasChanges(checkForChanges(newConfig));
   };

   const handleLtiConfigSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
         const api = axiosInstance();
         const response = await api.post('/lti/api/config/', {
            ...ltiConfig,
            microapp_id: app.id,
            id: hasExistingConfig ? ltiConfig.id : undefined,
            deployment_id: ltiConfig.deployment_ids?.[0] || '',
            deployment_ids: undefined,
         });
         if (response.status === 200) {
            const updated = {
               ...response.data,
               deployment_ids:
                  response.data.deployment_ids ||
                  (response.data.deployment_id ? [response.data.deployment_id] : []),
            };
            setLtiConfig(updated);
            setHasExistingConfig(true);
            setHasChanges(false);
            initialConfigRef.current = updated;
         }
      } catch (error) {
         console.error('Error saving LTI config:', error);
      } finally {
         setIsSaving(false);
      }
   };

   // ── Close ──────────────────────────────────────────────────────────────────
   const closeModal = () => {
      setShowShareMenu(false);
      setShowModal(false);
   };

   // ── Effects ───────────────────────────────────────────────────────────────
   useEffect(() => {
      if (activeTab === 'share') fetchAdmins();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [activeTab]);

   useEffect(() => {
      if (activeTab !== 'lti') return;
      (async () => {
         try {
            const api = axiosInstance();
            const res = await api.get(`/lti/api/config/${app.id}/`);
            if (res.status === 200) {
               const normalized = {
                  ...res.data,
                  deployment_ids:
                     res.data.deployment_ids ||
                     (res.data.deployment_id ? [res.data.deployment_id] : []),
               };
               setLtiConfig(normalized);
               setHasExistingConfig(true);
               initialConfigRef.current = normalized;
               setHasChanges(false);
            }
         } catch (err: any) {
            if (err.response?.status === 404) {
               setHasExistingConfig(false);
               const empty: LTIConfig = {
                  microapp_id: app.id,
                  issuer: '',
                  client_id: '',
                  auth_login_url: '',
                  auth_token_url: '',
                  key_set_url: '',
                  deployment_ids: [],
               };
               setLtiConfig(empty);
               initialConfigRef.current = empty;
               setHasChanges(false);
            }
         }
      })();
   }, [activeTab, app.id]);

   useEffect(() => { setShowShareMenu(showModal); }, [showModal]);

   useEffect(() => {
      setCurrentPrivacy(app.privacy);
   }, [app.privacy]);

   useEffect(() => {
      setPermittedDomains(app.permittedDomains ?? []);
   }, [app.permittedDomains]);

   useEffect(() => {
      if (isInline) return;
      const onClickOutside = (e: MouseEvent) => {
         if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) closeModal();
      };
      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
      document.addEventListener('mousedown', onClickOutside);
      document.addEventListener('keydown', onEsc);
      return () => {
         document.removeEventListener('mousedown', onClickOutside);
         document.removeEventListener('keydown', onEsc);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isInline]);

   useEffect(() => () => {
      if (privacySavedTimerRef.current) clearTimeout(privacySavedTimerRef.current);
   }, []);

   if (!showShareMenu) return null;

   const SharePrivacyIcon =
      normalizedPrivacy === 'public'
         ? FaGlobe
         : normalizedPrivacy === 'restricted'
            ? FaUserGroup
            : FaLock;

   // ── Helpers ───────────────────────────────────────────────────────────────
   const tabBtn = (tab: ActiveTab, label: string) => (
      <button
         onClick={() => setActiveTab(tab)}
         className={cn(
            'pb-3 px-1 text-sm font-semibold border-b-2 transition-colors',
            activeTab === tab
               ? 'border-primary text-primary'
               : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
         )}
      >
         {label}
      </button>
   );

   const SectionLabel = ({ children }: { children: React.ReactNode }) => (
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
         {children}
      </p>
   );

   const Divider = () => (
      <div className="border-t border-gray-100 dark:border-gray-800" />
   );

   const shellClassName = isInline
      ? 'w-full max-w-md mx-auto flex flex-col min-h-0 max-h-[min(90vh,calc(100vh-8rem))]'
      : 'bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col';

   const inner = (
         <div
            ref={shareMenuRef}
            className={shellClassName}
         >
            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-4 px-6 pt-5 border-b border-gray-100 dark:border-gray-800">
               <div className="flex gap-5 flex-1">
                  {tabBtn('share', 'Share')}
                  {tabBtn('lti', 'LTI')}
               </div>
               {!isInline && (
                  <button
                     type="button"
                     onClick={closeModal}
                     className="mb-3 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
                  >
                     <X size={13} />
                  </button>
               )}
            </div>

            {/* ── Scrollable body ────────────────────────────────────────── */}
            <div className="overflow-y-auto flex-1">

               {/* ══ SHARE TAB ══════════════════════════════════════════════ */}
               {activeTab === 'share' && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                     

                     {/* Link + embed (top) */}
                     <div className="px-6 py-5 space-y-3">
                     <SectionLabel>Share Links</SectionLabel>
                        <button
                           type="button"
                           onClick={handleCopyLink}
                           className="w-full text-left rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-3 py-3 hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                        >
                           <div className="flex items-start justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                 <SharePrivacyIcon size={13} className="text-gray-400 shrink-0" aria-hidden />
                                 <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Direct link</span>
                              </div>
                              <span className={cn(
                                 'shrink-0 text-xs font-semibold',
                                 copiedLink ? 'text-primary' : 'text-primary',
                              )}>
                                 {copiedLink ? (
                                    <span className="flex items-center gap-1">
                                       <FaCheck size={11} /> Copied!
                                    </span>
                                 ) : (
                                    'Copy direct link'
                                 )}
                              </span>
                           </div>
                           <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed truncate font-mono pl-5">
                              {getShareUrl()}
                           </p>
                        </button>

                        <button
                           type="button"
                           onClick={handleCopyEmbed}
                           className="w-full text-left rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-3 py-3 hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                        >
                           <div className="flex items-start justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                 <FaCode size={13} className="text-gray-400 shrink-0" aria-hidden />
                                 <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Embed</span>
                              </div>
                              <span className={cn(
                                 'shrink-0 text-xs font-semibold',
                                 copiedEmbed ? 'text-primary' : 'text-primary',
                              )}>
                                 {copiedEmbed ? (
                                    <span className="flex items-center gap-1">
                                       <FaCheck size={11} /> Copied iframe code
                                    </span>
                                 ) : (
                                    'Copy iframe code'
                                 )}
                              </span>
                           </div>
                           <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed pl-5">
                              Paste an iframe snippet into any webpage to embed this app.
                           </p>
                        </button>
                     </div>

                     {/* Visibility */}
                        <div className="px-6 py-5">
                           <div className="flex items-center justify-between mb-3">
                              <SectionLabel>Who can access</SectionLabel>
                              <span className={cn(
                                 'text-xs font-medium transition-opacity',
                                 privacySaving ? 'text-gray-400 opacity-100' :
                                 privacySaved  ? 'text-primary opacity-100' : 'opacity-0'
                              )}>
                                 {privacySaving ? 'Saving…' : 'Saved'}
                              </span>
                           </div>

                           <div className="flex flex-col gap-1.5">
                              {([
                                 { value: 'private', label: 'Private', icon: FaLock, description: 'You and admins only' },
                                 { value: 'public',  label: 'Public',  icon: FaGlobe, description: 'Anyone with the link' },
                                 { value: 'restricted', label: 'Restricted', icon: FaUserGroup, description: 'Site-specific Embedding Only' },
                              ] as const).map(({ value, label, icon: Icon, description }) => {
                                 const active = currentPrivacy.toLowerCase() === value;
                                 return (
                                    <button
                                       key={value}
                                       type="button"
                                       onClick={() => handlePrivacyChange(value)}
                                       disabled={privacySaving}
                                       className={cn(
                                          'flex items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-all w-full',
                                          active
                                             ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                             : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                                          privacySaving && 'cursor-not-allowed opacity-60',
                                       )}
                                    >
                                       <Icon
                                          size={13}
                                          className={cn('shrink-0', active ? 'text-primary' : 'text-gray-400')}
                                       />
                                       <span className={cn(
                                          'text-sm font-semibold',
                                          active ? 'text-primary' : 'text-gray-700 dark:text-gray-300',
                                       )}>
                                          {label}
                                       </span>
                                       <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {description}
                                       </span>
                                    </button>
                                 );
                              })}
                           </div>
                        </div>

                     {/* Permitted domains (Restricted only) */}
                     {normalizedPrivacy === 'restricted' && (
                        <div className="px-6 py-5">
                           <SectionLabel>Permitted embed domains</SectionLabel>
                           <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                              Add website hostnames where this app can be embedded (e.g. example.com, blog.mysite.com).
                           </p>
                           <form
                              onSubmit={(e) => {
                                 e.preventDefault();
                                 handleAddDomain();
                              }}
                              className="flex gap-2 mb-3"
                           >
                              <input
                                 type="text"
                                 value={domainInput}
                                 onChange={(e) => setDomainInput(e.target.value)}
                                 placeholder="example.com"
                                 disabled={domainsSaving}
                                 className={cn(
                                    'flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                                    'px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400',
                                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                    'disabled:opacity-50',
                                 )}
                              />
                              <button
                                 type="submit"
                                 disabled={domainsSaving || !domainInput.trim()}
                                 className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold',
                                    'bg-primary text-white shadow-sm transition-colors',
                                    'hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed',
                                 )}
                              >
                                 {domainsSaving ? 'Saving…' : 'Add'}
                              </button>
                           </form>
                           {permittedDomains.length === 0 ? (
                              <p className="text-sm text-gray-400">
                                 No domains added. The app will show &quot;Not authorized&quot; when embedded anywhere until you add at least one domain.
                              </p>
                           ) : (
                              <ul className="space-y-1">
                                 {permittedDomains.map((domain) => (
                                    <li
                                       key={domain}
                                       className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800/60 group"
                                    >
                                       <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">
                                          {domain}
                                       </span>
                                       <button
                                          type="button"
                                          onClick={() => handleRemoveDomain(domain)}
                                          disabled={domainsSaving}
                                          className="p-1 rounded text-gray-400 hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                                          title="Remove domain"
                                       >
                                          <FaTrashCan size={12} />
                                       </button>
                                    </li>
                                 ))}
                              </ul>
                           )}
                        </div>
                     )}

                     {/* People with access — owner only */}
                        <div className="px-6 py-5">
                           <SectionLabel>People with access</SectionLabel>

                           <form onSubmit={handleAddAdmin} className="flex gap-2 mb-3">
                              <input
                                 type="email"
                                 value={emailInput}
                                 onChange={(e) => { setEmailInput(e.target.value); setAdminError(null); }}
                                 placeholder="Add someone by email…"
                                 disabled={addingAdmin}
                                 className={cn(
                                    'flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                                    'px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400',
                                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                                    'disabled:opacity-50',
                                 )}
                              />
                              <button
                                 type="submit"
                                 disabled={addingAdmin || !emailInput.trim()}
                                 className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold',
                                    'bg-primary text-white shadow-sm transition-colors',
                                    'hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed',
                                 )}
                              >
                                 {addingAdmin ? 'Adding…' : 'Add'}
                              </button>
                           </form>

                           {adminError && (
                              <p className="mb-3 text-xs text-destructive">{adminError}</p>
                           )}

                           {adminsLoading ? (
                              <p className="text-sm text-gray-400">Loading…</p>
                           ) : admins.length === 0 ? (
                              <p className="text-sm text-gray-400">No one has access yet.</p>
                           ) : (
                              <ul className="space-y-1">
                                 {admins.map((person) => {
                                    const isPersonOwner = person.role === 'owner';
                                    const initials =
                                       [person.first_name, person.last_name]
                                          .filter(Boolean)
                                          .map((n) => n[0].toUpperCase())
                                          .join('') || person.email[0].toUpperCase();
                                    const displayName =
                                       [person.first_name, person.last_name].filter(Boolean).join(' ') ||
                                       person.email;
                                    return (
                                       <li
                                          key={person.id}
                                          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                                       >
                                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 text-xs font-semibold flex-shrink-0">
                                             {initials}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                             <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {displayName}
                                             </p>
                                             <p className="text-xs text-gray-500 truncate">{person.email}</p>
                                          </div>
                                          <span className="text-xs text-gray-400 mr-1">
                                             {isPersonOwner ? 'Owner' : 'Admin'}
                                          </span>
                                          {isOwner && !isPersonOwner ? (
                                             <button
                                                onClick={() => handleRemoveAdmin(person.id)}
                                                disabled={removingAdminId === person.id}
                                                className="p-1.5 rounded-md text-gray-300 hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
                                                title="Remove admin"
                                             >
                                                <FaTrashCan size={12} />
                                             </button>
                                          ) : (
                                             <div className="w-[30px]" />
                                          )}
                                       </li>
                                    );
                                 })}
                              </ul>
                           )}
                        </div>
                  </div>
               )}

               {/* ══ LTI TAB ════════════════════════════════════════════════ */}
               {activeTab === 'lti' && (
                  <div className="px-6 py-5 space-y-6">
                     {/* Step 1 */}
                     <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                           Step 1 — Configure your LMS
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                           Enter these values in your LMS to register {PLATFORM_NAME} as an LTI 1.3 provider. Your LMS will then generate credentials for Step 2.
                        </p>
                        <div className="space-y-3">
                           <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                 LTI Version
                              </label>
                              <input
                                 type="text"
                                 value="1.3"
                                 readOnly
                                 className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                              />
                           </div>
                           {[
                              { label: 'Tool Launch URL', value: `${window.location.origin}/lti/launch/` },
                              { label: 'Tool Initiate URL', value: `${window.location.origin}/lti/login/` },
                              { label: 'JWKs URL', value: `${window.location.origin}/lti/jwks/` },
                           ].map(({ label, value }) => (
                              <div key={label}>
                                 <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    {label}
                                 </label>
                                 <div className="flex gap-2">
                                    <input
                                       type="text"
                                       value={value}
                                       readOnly
                                       className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                                    />
                                    <button
                                       onClick={() => navigator.clipboard.writeText(value)}
                                       className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                       <Copy size={14} />
                                    </button>
                                 </div>
                              </div>
                           ))}
                           <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                 Deep Linking
                              </label>
                              <input
                                 type="text"
                                 value="False"
                                 readOnly
                                 className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                              />
                           </div>
                        </div>
                     </div>

                     <Divider />

                     {/* Step 2 */}
                     <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                           Step 2 — Save your LMS credentials
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                           Paste the credentials generated by your LMS in Step 1.
                        </p>
                        <form onSubmit={handleLtiConfigSubmit} className="space-y-3">
                           {[
                              { label: 'Issuer', name: 'issuer', value: ltiConfig.issuer },
                              { label: 'Client ID', name: 'client_id', value: ltiConfig.client_id },
                              { label: 'Auth Login URL', name: 'auth_login_url', value: ltiConfig.auth_login_url },
                              { label: 'Auth Token URL', name: 'auth_token_url', value: ltiConfig.auth_token_url },
                              { label: 'Keyset URL', name: 'key_set_url', value: ltiConfig.key_set_url },
                           ].map(({ label, name, value }) => (
                              <div key={name}>
                                 <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    {label}
                                 </label>
                                 <input
                                    type="text"
                                    name={name}
                                    value={value}
                                    onChange={handleLtiConfigChange}
                                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    required
                                 />
                              </div>
                           ))}
                           <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                 Deployment ID
                              </label>
                              <input
                                 type="text"
                                 name="deployment_ids"
                                 value={ltiConfig.deployment_ids?.[0] ?? ''}
                                 onChange={handleLtiConfigChange}
                                 className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                 required
                              />
                           </div>
                           <button
                              type="submit"
                              disabled={!hasChanges || isSaving}
                              className={cn(
                                 'mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors',
                                 hasChanges
                                    ? 'bg-primary text-white hover:bg-primary-600'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed',
                              )}
                           >
                              {hasChanges ? (
                                 <><FaFloppyDisk size={13} /> Save Configuration</>
                              ) : (
                                 <><FaCheck size={13} /> Saved</>
                              )}
                           </button>
                        </form>
                     </div>
                  </div>
               )}
            </div>
         </div>
   );

   if (isInline) {
      return (
         <div className="w-full flex justify-center py-2">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm w-full max-w-md flex flex-col min-h-0">
               {inner}
            </div>
         </div>
      );
   }

   return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
         {inner}
      </div>
   );
};

export default ShareModal;
