import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail,
  Palette,
  SlidersHorizontal,
  History,
  Plus,
  Send,
  RotateCcw,
  Trash2,
  Eye,
  Monitor,
  Smartphone,
  Check,
  X,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Heading2,
  List,
  Code2,
  PenLine,
  Maximize2,
  Link2,
  AlignLeft,
  AlignCenter,
  Minus,
  LayoutTemplate,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import {
  DEFAULT_EMAIL_SETTINGS_BASE,
  EMAIL_COLOR_FIELDS,
  EMAIL_SAMPLE_VARIABLES,
  EmailColorKey,
  renderBrandedEmailHtml,
  resolveEffectiveEmailSettings,
} from '../../utils/emailRenderer';

export type EmailStudioTab = 'templates' | 'design' | 'triggers' | 'logs';

const MERGE_VARIABLES: Record<string, string[]> = {
  'order.created': ['{{customerName}}', '{{orderNumber}}', '{{totalAmount}}', '{{siteName}}'],
  'order.admin_alert': ['{{customerName}}', '{{email}}', '{{orderNumber}}', '{{totalAmount}}', '{{siteName}}'],
  'order.updated': ['{{customerName}}', '{{orderNumber}}', '{{orderStatus}}', '{{paymentStatus}}', '{{siteName}}'],
  'inquiry.created': ['{{customerName}}', '{{inquiryRef}}', '{{siteName}}'],
  'inquiry.admin_alert': ['{{customerName}}', '{{email}}', '{{inquiryRef}}', '{{siteName}}'],
  'quotation.sent': ['{{customerName}}', '{{quoteRef}}', '{{grandTotal}}', '{{quoteUrl}}', '{{siteName}}'],
  'quotation.responded': ['{{customerName}}', '{{quoteRef}}', '{{status}}', '{{siteName}}'],
};

const DESIGN_PRESETS = [
  {
    name: 'Sculpted Oak',
    headerBgColor: '#734926',
    headerTextColor: '#FFFFFF',
    accentColor: '#734926',
    accentBgColor: '#F8F3EC',
    canvasBgColor: '#F5EFE6',
    cardBgColor: '#FFFFFF',
    cardBorderColor: '#E8DFD3',
    bodyTextColor: '#1F2937',
    footerBgColor: '#FAF6F0',
    footerTextColor: '#6B7280',
    buttonBgColor: '#8B5D36',
    buttonTextColor: '#FFFFFF',
  },
  {
    name: 'Kanso Charcoal',
    headerBgColor: '#171717',
    headerTextColor: '#FFFFFF',
    accentColor: '#15803D',
    accentBgColor: '#CCF3C6',
    canvasBgColor: '#F7F7F8',
    cardBgColor: '#FFFFFF',
    cardBorderColor: '#E5E7EB',
    bodyTextColor: '#1F2937',
    footerBgColor: '#FAFAFB',
    footerTextColor: '#6B7280',
    buttonBgColor: '#171717',
    buttonTextColor: '#FFFFFF',
  },
  {
    name: 'Studio Mint',
    headerBgColor: '#14532D',
    headerTextColor: '#FFFFFF',
    accentColor: '#166534',
    accentBgColor: '#DCFCE7',
    canvasBgColor: '#F3F7F4',
    cardBgColor: '#FFFFFF',
    cardBorderColor: '#D1E7D8',
    bodyTextColor: '#1F2937',
    footerBgColor: '#F8FBF9',
    footerTextColor: '#4B5563',
    buttonBgColor: '#15803D',
    buttonTextColor: '#FFFFFF',
  },
  {
    name: 'Warm Gallery',
    headerBgColor: '#292524',
    headerTextColor: '#FAF7F2',
    accentColor: '#92400E',
    accentBgColor: '#FEF3C7',
    canvasBgColor: '#F5F2ED',
    cardBgColor: '#FFFFFF',
    cardBorderColor: '#E7E0D6',
    bodyTextColor: '#292524',
    footerBgColor: '#FAF8F5',
    footerTextColor: '#78716C',
    buttonBgColor: '#292524',
    buttonTextColor: '#FAF7F2',
  },
  {
    name: 'Crisp Minimal',
    headerBgColor: '#FFFFFF',
    headerTextColor: '#111827',
    accentColor: '#111827',
    accentBgColor: '#F3F4F6',
    canvasBgColor: '#F7F7F8',
    cardBgColor: '#FFFFFF',
    cardBorderColor: '#E5E7EB',
    bodyTextColor: '#111827',
    footerBgColor: '#FAFAFB',
    footerTextColor: '#6B7280',
    buttonBgColor: '#171717',
    buttonTextColor: '#FFFFFF',
  },
];

interface RichVisualEditorProps {
  value: string;
  templateKey: string | number;
  onChange: (html: string) => void;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonRadius: string;
  accentBgColor?: string;
  accentColor?: string;
  cardBorderColor?: string;
  onRequestInsertImage: (insertFn: (url: string) => void) => void;
  registerInsertFn?: (fn: (snippet: string) => void) => void;
}

const RichVisualEmailEditor: React.FC<RichVisualEditorProps> = ({
  value,
  templateKey,
  onChange,
  buttonBgColor,
  buttonTextColor,
  buttonRadius,
  accentBgColor = '#F8F3EC',
  accentColor = '#734926',
  cardBorderColor = '#E5D7C6',
  onRequestInsertImage,
  registerInsertFn,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastExternalValueRef = useRef<string>(value);
  const [showButtonForm, setShowButtonForm] = useState(false);
  const [ctaLabel, setCtaLabel] = useState('Review & Respond to Quotation');
  const [ctaUrl, setCtaUrl] = useState('{{quoteUrl}}');
  const [textColor, setTextColor] = useState('#1F2937');
  const [highlightColor, setHighlightColor] = useState('#FEF3C7');

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '<p style="margin:0 0 12px;"></p>';
    }
    lastExternalValueRef.current = value;
  }, [templateKey]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastExternalValueRef.current && document.activeElement !== el) {
      el.innerHTML = value || '<p style="margin:0 0 12px;"></p>';
      lastExternalValueRef.current = value;
    }
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastExternalValueRef.current = html;
    onChange(html);
  };

  const runExec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    emitChange();
  };

  const insertHtmlAtCursor = (snippet: string) => {
    const el = editorRef.current;
    if (!el) {
      onChange(`${value || ''}${snippet}`);
      return;
    }
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = snippet;
      const frag = document.createDocumentFragment();
      let lastNode: Node | null = null;
      while (temp.firstChild) {
        lastNode = frag.appendChild(temp.firstChild);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      el.innerHTML = `${el.innerHTML}${snippet}`;
    }
    emitChange();
  };

  useEffect(() => {
    registerInsertFn?.(insertHtmlAtCursor);
  }, [registerInsertFn]);

  const handleInsertCta = () => {
    const label = ctaLabel.trim() || 'View Details';
    const url = ctaUrl.trim() || '{{quoteUrl}}';
    insertHtmlAtCursor(
      `<p style="margin:16px 0;"><a href="${url}" data-ka-cta="true" style="display:inline-block;padding:12px 24px;border-radius:${buttonRadius};background:${buttonBgColor};color:${buttonTextColor};text-decoration:none;font-weight:700;font-size:14px;">${label}</a></p>`
    );
    setShowButtonForm(false);
  };

  return (
    <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white">
      {/* Visual Formatting Toolbar */}
      <div className="px-3 py-2 bg-[#F7F7F8] border-b border-[#E5E7EB] flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => runExec('bold')}
          title="Bold"
          className="p-2 rounded-lg text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] cursor-pointer"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => runExec('italic')}
          title="Italic"
          className="p-2 rounded-lg text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] cursor-pointer"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => runExec('underline')}
          title="Underline"
          className="p-2 rounded-lg text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] cursor-pointer"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => runExec('formatBlock', 'H2')}
          title="Heading"
          className="p-2 rounded-lg text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] cursor-pointer"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => runExec('insertUnorderedList')}
          title="Bulleted List"
          className="p-2 rounded-lg text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] cursor-pointer"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <span className="h-5 w-px bg-[#E5E7EB] mx-1" aria-hidden="true" />

        {/* Inline Text & Highlight Color Pickers */}
        <label
          title="Selected Text Color"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#8B5D36] cursor-pointer"
        >
          <span className="text-[11px] font-bold text-[#111827]">A</span>
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              const color = e.target.value;
              setTextColor(color);
              runExec('foreColor', color);
            }}
            className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
          />
        </label>
        <label
          title="Text Highlight Color"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#8B5D36] cursor-pointer"
        >
          <span className="text-[11px] font-bold px-1 rounded" style={{ backgroundColor: highlightColor }}>
            Bg
          </span>
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => {
              const color = e.target.value;
              setHighlightColor(color);
              runExec('hiliteColor', color);
            }}
            className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
          />
        </label>

        <span className="h-5 w-px bg-[#E5E7EB] mx-1" aria-hidden="true" />

        <button
          type="button"
          onClick={() =>
            insertHtmlAtCursor(
              `<div style="margin:14px 0;padding:14px 16px;background:${accentBgColor};border-radius:12px;border:1px solid ${cardBorderColor};"><p style="margin:0;font-weight:700;color:${accentColor};">Order &amp; Reference Summary</p><p style="margin:4px 0 0;color:#4B5563;">Reference: {{orderNumber}} · Total: {{totalAmount}}</p></div>`
            )
          }
          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#8B5D36] text-[#111827] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          + Summary Box
        </button>
        <button
          type="button"
          onClick={() => setShowButtonForm((v) => !v)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap ${
            showButtonForm
              ? 'bg-[#8B5D36] text-white border-[#734926]'
              : 'bg-white border-[#E5E7EB] hover:border-[#8B5D36] text-[#111827]'
          }`}
        >
          <Link2 className="w-3 h-3" />
          <span>+ Button</span>
        </button>
        <button
          type="button"
          onClick={() =>
            onRequestInsertImage((url) =>
              insertHtmlAtCursor(
                `<p style="margin:14px 0;"><img src="${url}" alt="Kanso Atelier" style="max-width:100%;height:auto;border-radius:12px;display:block;" /></p>`
              )
            )
          }
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#8B5D36] text-[#111827] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <ImageIcon className="w-3 h-3" />
          <span>+ Image</span>
        </button>
        <button
          type="button"
          onClick={() =>
            insertHtmlAtCursor('<hr style="margin:18px 0;border:none;border-top:1px solid #EAECEF;" />')
          }
          title="Insert Divider"
          className="p-2 rounded-lg text-[#111827] hover:bg-white border border-transparent hover:border-[#E5E7EB] cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline Button Builder Popover */}
      {showButtonForm && (
        <div className="p-3 bg-[#FAF6F0] border-b border-[#E5D7C6] flex flex-wrap items-end gap-2.5">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[11px] font-bold text-[#6E5644] mb-1">Button Label</label>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-[#DECFC0] rounded-lg"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-bold text-[#6E5644] mb-1">Button Link / Token</label>
            <input
              type="text"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-[#DECFC0] rounded-lg font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleInsertCta}
            className="px-3.5 py-1.5 text-xs font-semibold ka-oak-btn rounded-lg cursor-pointer"
          >
            Insert Button
          </button>
        </div>
      )}

      {/* Visual Editable Canvas */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        className="min-h-[260px] max-h-[380px] overflow-y-auto p-4 text-sm leading-relaxed text-[#1F2937] focus:outline-none [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_p]:mb-3 [&_a]:underline"
      />
    </div>
  );
};

export const AdminEmails: React.FC<{
  activeSubTab?: EmailStudioTab;
  onChangeSubTab?: (tab: EmailStudioTab) => void;
}> = ({ activeSubTab, onChangeSubTab }) => {
  const { authFetch, firebaseUser, authLoading, refreshBootstrap } = usePlatform();

  const [internalSubTab, setInternalSubTab] = useState<EmailStudioTab>(activeSubTab || 'templates');
  const subTab = activeSubTab ?? internalSubTab;
  const setSubTab = (tab: EmailStudioTab) => {
    setInternalSubTab(tab);
    onChangeSubTab?.(tab);
  };

  const [templates, setTemplates] = useState<any[]>([]);
  const [defaultTemplates, setDefaultTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [emailSettings, setEmailSettings] = useState<Record<string, any>>(DEFAULT_EMAIL_SETTINGS_BASE);
  const [generalSettings, setGeneralSettings] = useState<Record<string, any>>({});

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [expandedPreviewOpen, setExpandedPreviewOpen] = useState(false);

  const [testEmail, setTestEmail] = useState(firebaseUser?.email || '');
  const [showNewModal, setShowNewModal] = useState(false);
  const visualInsertRef = useRef<((snippet: string) => void) | null>(null);
  const [newForm, setNewForm] = useState({
    name: '',
    triggerEvent: 'custom.notification',
    subject: 'Update from {{siteName}}',
    bodyHtml:
      '<p style="margin:0 0 14px;">Dear <strong>{{customerName}}</strong>,</p><p style="margin:0;">Here is an important update regarding your account.</p>',
  });

  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    null | 'logo' | 'heroBanner' | { kind: 'bodyImage'; insertFn: (url: string) => void }
  >(null);
  const [inspectLog, setInspectLog] = useState<any>(null);
  const [logFilter, setLogFilter] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const loadData = async (keepSelectedId?: number | null) => {
    setLoading(true);
    setError('');
    try {
      const [eRes, mRes] = await Promise.all([
        authFetch('/api/admin/email-templates'),
        authFetch('/api/admin/media'),
      ]);
      if (!eRes.ok) {
        const errPayload = await eRes.json().catch(() => ({}));
        throw new Error(
          errPayload?.error || `Failed to load email templates (HTTP ${eRes.status}).`
        );
      }
      const d = await eRes.json();
      const tList = d.templates || [];
      setTemplates(tList);
      setDefaultTemplates(d.defaultTemplates || []);
      setLogs(d.notifications || []);
      setEmailSettings({ ...DEFAULT_EMAIL_SETTINGS_BASE, ...(d.emailSettings || {}) });
      setGeneralSettings(d.generalSettings || {});

      const targetId = keepSelectedId ?? selectedId;
      const found = tList.find((t: any) => t.id === targetId) || tList[0] || null;
      if (found) {
        setSelectedId(found.id);
        setDraft({ ...found });
      }
      if (mRes.ok) {
        const md = await mRes.json();
        setMediaAssets(md.media || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load email templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      void loadData();
    }
  }, [authLoading, firebaseUser?.uid]);

  useEffect(() => {
    if (!testEmail && firebaseUser?.email) {
      setTestEmail(firebaseUser.email);
    }
  }, [firebaseUser]);

  const handleRestoreDefaultTemplates = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/api/admin/email-templates/restore-defaults', {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Failed to restore default email templates.');
      }
      setToast('Default transactional email templates verified and loaded.');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Could not restore default templates.');
    } finally {
      setBusy(false);
    }
  };

  // Resolved colors for the active template (global emailSettings merged with per-template overrides)
  const effectiveTemplateSettings = useMemo(
    () => resolveEffectiveEmailSettings(emailSettings, draft?.triggerEvent),
    [emailSettings, draft?.triggerEvent]
  );

  const hasCustomTemplateColors = Boolean(
    draft?.triggerEvent &&
      emailSettings.templateColors &&
      emailSettings.templateColors[draft.triggerEvent] &&
      Object.keys(emailSettings.templateColors[draft.triggerEvent]).length > 0
  );

  const updateTemplateColor = (key: EmailColorKey, hex: string) => {
    if (!draft?.triggerEvent) return;
    const prevAll = emailSettings.templateColors || {};
    const prevForTemplate = prevAll[draft.triggerEvent] || {};
    setEmailSettings({
      ...emailSettings,
      templateColors: {
        ...prevAll,
        [draft.triggerEvent]: {
          ...prevForTemplate,
          [key]: hex,
        },
      },
    });
  };

  const applyPresetToTemplate = (preset: Record<string, string>) => {
    if (!draft?.triggerEvent) return;
    const colorPatch: Record<string, string> = {};
    for (const f of EMAIL_COLOR_FIELDS) {
      if (preset[f.key]) colorPatch[f.key] = preset[f.key];
    }
    setEmailSettings({
      ...emailSettings,
      templateColors: {
        ...(emailSettings.templateColors || {}),
        [draft.triggerEvent]: colorPatch,
      },
    });
  };

  const resetTemplateColorsToGlobal = () => {
    if (!draft?.triggerEvent) return;
    const nextTemplateColors = { ...(emailSettings.templateColors || {}) };
    delete nextTemplateColors[draft.triggerEvent];
    setEmailSettings({
      ...emailSettings,
      templateColors: nextTemplateColors,
    });
    setToast(`"${draft.name}" reverted to global email colors (click Save Email Copy to save).`);
  };

  const applyTemplateColorsGlobally = async () => {
    if (!draft?.triggerEvent) return;
    const nextGlobal = { ...emailSettings };
    for (const f of EMAIL_COLOR_FIELDS) {
      nextGlobal[f.key] = effectiveTemplateSettings[f.key];
    }
    const nextOverrides = { ...(nextGlobal.templateColors || {}) };
    delete nextOverrides[draft.triggerEvent];
    nextGlobal.templateColors = nextOverrides;
    setEmailSettings(nextGlobal);
    setBusy(true);
    try {
      const res = await authFetch('/api/admin/settings/email', {
        method: 'PUT',
        body: JSON.stringify({ value: nextGlobal }),
      });
      if (res.ok) {
        setToast('Applied these colors across all email templates.');
        await refreshBootstrap();
      }
    } finally {
      setBusy(false);
    }
  };

  // Instant zero-latency visual preview matching server renderBrandedEmailHtml byte-for-byte
  const livePreview = useMemo(() => {
    const subjectSource =
      draft?.subject || 'Order {{orderNumber}} Confirmed — {{siteName}}';
    const bodySource =
      draft?.bodyHtml ||
      '<p style="margin:0 0 14px;">Dear <strong>{{customerName}}</strong>,</p><p style="margin:0 0 18px;">Thank you for choosing <strong>{{siteName}}</strong>. Your order <strong>{{orderNumber}}</strong> totaling <strong>{{totalAmount}}</strong> has been confirmed.</p><p style="margin:0 0 14px;"><a href="{{quoteUrl}}" data-ka-cta="true" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#8B5D36;color:#ffffff;text-decoration:none;font-weight:700;">View Details</a></p>';

    return renderBrandedEmailHtml({
      subjectTemplate: subjectSource,
      bodyHtmlTemplate: bodySource,
      emailSettings,
      generalSettings,
      variables: EMAIL_SAMPLE_VARIABLES,
      eventLabel: draft?.name || 'Branded Email Design',
      templateKey: draft?.triggerEvent,
    });
  }, [draft?.subject, draft?.bodyHtml, draft?.name, draft?.triggerEvent, emailSettings, generalSettings]);

  const mergeVars = useMemo(() => {
    const ev = draft?.triggerEvent || '';
    return (
      MERGE_VARIABLES[ev] || [
        '{{customerName}}',
        '{{email}}',
        '{{orderNumber}}',
        '{{totalAmount}}',
        '{{inquiryRef}}',
        '{{quoteRef}}',
        '{{quoteUrl}}',
        '{{siteName}}',
      ]
    );
  }, [draft?.triggerEvent]);

  const insertTokenIntoBody = (snippet: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      bodyHtml: `${draft.bodyHtml || ''}${draft.bodyHtml ? '\n' : ''}${snippet}`,
    });
  };

  const insertTokenInline = (token: string, field: 'subject' | 'bodyHtml') => {
    if (!draft) return;
    if (field === 'bodyHtml' && editorMode === 'visual' && visualInsertRef.current) {
      visualInsertRef.current(` ${token}`);
    } else {
      setDraft({ ...draft, [field]: `${draft[field] || ''}${token}` });
    }
  };

  const handleSaveTemplate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draft?.id) return;
    setBusy(true);
    try {
      const customColors = emailSettings.templateColors?.[draft.triggerEvent];
      const res = await authFetch(`/api/admin/email-templates/${draft.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...draft,
          customColors: customColors && Object.keys(customColors).length > 0 ? customColors : undefined,
          resetColors: !customColors || Object.keys(customColors).length === 0,
        }),
      });
      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        if (resData?.emailSettings) {
          setEmailSettings({ ...DEFAULT_EMAIL_SETTINGS_BASE, ...resData.emailSettings });
        }
        setToast(`Saved "${draft.name}" template and colors.`);
        await loadData(draft.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetTemplate = () => {
    if (!draft) return;
    const def = defaultTemplates.find((d) => d.triggerEvent === draft.triggerEvent);
    if (!def) {
      setToast('This is a custom template with no built-in default.');
      return;
    }
    setDraft({
      ...draft,
      name: def.name,
      subject: def.subject,
      bodyHtml: def.bodyHtml,
      isActive: def.isActive,
    });
    setToast('Restored default copy & subject (click Save Email Copy to save).');
  };

  const handleSendTest = async () => {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/email-templates/${draft.id}/test`, {
        method: 'POST',
        body: JSON.stringify({ recipientEmail: testEmail }),
      });
      if (res.ok) {
        setToast(
          `Dispatched test email to ${testEmail || 'admin inbox'} (recorded in Sent Email Log).`
        );
        await loadData(draft.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch('/api/admin/email-templates', {
        method: 'POST',
        body: JSON.stringify(newForm),
      });
      if (res.ok) {
        const d = await res.json();
        setShowNewModal(false);
        setNewForm({
          name: '',
          triggerEvent: 'custom.notification',
          subject: 'Update from {{siteName}}',
          bodyHtml:
            '<p style="margin:0 0 14px;">Dear <strong>{{customerName}}</strong>,</p><p style="margin:0;">Here is an important update regarding your account.</p>',
        });
        setToast(`Created email template "${d.template.name}".`);
        await loadData(d.template.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/email-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast('Template removed.');
        await loadData(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/admin/settings/email', {
        method: 'PUT',
        body: JSON.stringify({ value: emailSettings }),
      });
      if (res.ok) {
        setToast('Saved email design, branding, and trigger settings.');
        await refreshBootstrap();
      }
    } finally {
      setBusy(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    const q = logFilter.toLowerCase();
    if (!q) return true;
    return (
      (l.type || '').toLowerCase().includes(q) ||
      (l.recipientEmail || '').toLowerCase().includes(q) ||
      (l.subject || '').toLowerCase().includes(q)
    );
  });

  const isBuiltInEvent = (ev: string) => defaultTemplates.some((d) => d.triggerEvent === ev);

  const renderPreviewEnvelope = (compact = false) => (
    <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-hidden flex flex-col h-full">
      {/* Preview Toolbar */}
      <div className="px-5 py-3.5 border-b border-[#F0F1F3] flex flex-wrap items-center justify-between gap-2 bg-[#FAFAFB]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
              Visual Email Design Preview
            </span>
            {subTab === 'design' && templates.length > 0 && (
              <select
                value={draft?.id || ''}
                onChange={(e) => {
                  const found = templates.find((t) => t.id === Number(e.target.value));
                  if (found) {
                    setSelectedId(found.id);
                    setDraft({ ...found });
                  }
                }}
                aria-label="Preview email template"
                className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#E5E7EB] rounded-lg text-[#111827] max-w-[210px] truncate cursor-pointer"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="font-bold text-sm text-[#111827] truncate mt-0.5">
            {livePreview.subject}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center p-1 bg-white rounded-xl border border-[#E5E7EB]">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`p-1.5 rounded-lg cursor-pointer ${
                previewDevice === 'desktop' ? 'bg-[#171717] text-white' : 'text-[#6B7280]'
              }`}
              title="Desktop preview"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`p-1.5 rounded-lg cursor-pointer ${
                previewDevice === 'mobile' ? 'bg-[#171717] text-white' : 'text-[#6B7280]'
              }`}
              title="Mobile preview"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setExpandedPreviewOpen(true)}
            title="Expand full-size visual preview"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#111827] text-xs font-semibold text-[#111827] cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Expand</span>
          </button>
        </div>
      </div>

      {/* Realistic Inbox Envelope Meta Strip */}
      <div className="px-5 py-2.5 border-b border-[#F0F1F3] bg-white text-xs text-[#6B7280] space-y-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">
            <strong className="text-[#111827]">From:</strong>{' '}
            {emailSettings.senderName || 'Kanso Atelier Desk'} &lt;
            {emailSettings.senderAddress || 'studio@kansoatelier.com'}&gt;
          </span>
          <span className="shrink-0 font-mono text-[11px] text-[#9CA3AF]">
            To: {EMAIL_SAMPLE_VARIABLES.email}
          </span>
        </div>
      </div>

      {/* Rendered Visual Canvas */}
      <div
        className={`flex-1 bg-[#EAECEF]/70 p-3 flex justify-center overflow-auto ${
          compact ? 'min-h-[500px]' : 'min-h-[560px]'
        }`}
      >
        <iframe
          title="Visual Email Preview"
          srcDoc={livePreview.html}
          className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-sm transition-all duration-200 ${
            previewDevice === 'mobile' ? 'w-[340px]' : 'w-full'
          } ${compact ? 'min-h-[480px]' : 'min-h-[540px]'}`}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5 text-xs">
      {/* Feedback & Error Banners */}
      {toast && (
        <div className="bg-[#171717] text-white px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-[#CCF3C6] shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast('')}
            className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => void loadData()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-red-200 hover:border-red-400 text-red-800 font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleRestoreDefaultTemplates}
              className="px-3.5 py-1.5 rounded-xl bg-[#171717] text-white font-semibold cursor-pointer"
            >
              Restore Defaults
            </button>
          </div>
        </div>
      )}

      {/* Email Studio Toolbar + Sub-View Quick Switch */}
      <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#111827]">
            {subTab === 'templates'
              ? 'Visual Email Editor & Templates'
              : subTab === 'design'
              ? 'Visual Design & Branding Studio'
              : subTab === 'triggers'
              ? 'Sender & Triggers'
              : 'Sent Email Log'}
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {subTab === 'templates'
              ? 'Visually edit any transactional email’s copy, buttons, images, and subject with live design preview.'
              : subTab === 'design'
              ? 'See your live email design and customize theme presets, hero banners, colors, typography, and layout.'
              : subTab === 'triggers'
              ? 'Configure sender identity, admin inbox routing, and automated event triggers.'
              : 'Inspect every rendered transactional and test email dispatched by the store.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick cross-switch between Visual Editor & Visual Design */}
          <div className="inline-flex items-center p-1 bg-[#F7F7F8] border border-[#EAECEF] rounded-2xl">
            <button
              type="button"
              onClick={() => setSubTab('templates')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'templates' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Edit Emails ({templates.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('design')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'design' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Visual Design</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('triggers')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'triggers' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Triggers</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('logs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'logs' ? 'bg-[#171717] text-white shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Logs ({logs.length})</span>
            </button>
          </div>

          {subTab === 'templates' && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#171717] text-white font-semibold rounded-xl hover:bg-[#0A0A0A] shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>New Email Template</span>
            </button>
          )}
          {(subTab === 'design' || subTab === 'triggers') && (
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveEmailSettings}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#171717] text-white font-semibold rounded-xl hover:bg-[#0A0A0A] shadow-xs disabled:opacity-60 transition-all cursor-pointer whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>Save Visual Design</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== TAB 1: VISUAL EMAIL EDITOR & TEMPLATES ==================== */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          {/* Quick Inline Design Preset Bar right above Editor + Visual Preview */}
          <div className="bg-white border border-[#F0F1F3] shadow-[0_6px_22px_rgba(17,24,39,0.03)] rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111827] mr-1">
                <LayoutTemplate className="w-3.5 h-3.5 text-[#8B5D36]" />
                <span>Active Visual Theme:</span>
              </span>
              {DESIGN_PRESETS.map((preset) => {
                const isSelected = emailSettings.headerBgColor === preset.headerBgColor;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setEmailSettings({ ...emailSettings, ...preset })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'border-[#8B5D36] bg-[#FAF6F0] text-[#231912]'
                        : 'border-[#E5E7EB] bg-[#F7F7F8] text-[#4B5563] hover:border-[#9CA3AF]'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/15"
                      style={{ backgroundColor: preset.headerBgColor }}
                    />
                    <span>{preset.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSubTab('design')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-xs font-semibold text-[#111827] cursor-pointer whitespace-nowrap"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Customize Colors &amp; Logo</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveEmailSettings}
                className="px-3 py-1.5 rounded-xl bg-[#171717] hover:bg-[#0A0A0A] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                Save Theme
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left Rail: All Transactional Emails */}
            <div className="xl:col-span-3 bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F1F3] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#111827]">
                    All Relevant Emails ({templates.length})
                  </h3>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void loadData(draft?.id)}
                    title="Refresh email templates"
                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="text-[12px] text-[#6B7280]">Select any email to edit &amp; preview</p>
                {templates.length > 0 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder="Search templates..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#111827]"
                    />
                  </div>
                )}
              </div>
              <div className="p-2.5 space-y-1">
                {loading ? (
                  <div className="space-y-2 p-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="h-14 rounded-2xl bg-[#F3F4F6] animate-pulse" />
                    ))}
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-4 text-center space-y-3">
                    <p className="text-xs text-[#6B7280]">
                      No email templates loaded yet.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleRestoreDefaultTemplates}
                      className="w-full px-3 py-2 rounded-xl ka-oak-btn text-xs font-semibold cursor-pointer"
                    >
                      Load 7 Default Templates
                    </button>
                  </div>
                ) : (
                  templates
                    .filter((t) => {
                      const q = templateSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (t.name || '').toLowerCase().includes(q) ||
                        (t.triggerEvent || '').toLowerCase().includes(q) ||
                        (t.subject || '').toLowerCase().includes(q)
                      );
                    })
                    .map((t) => {
                      const active = draft?.id === t.id;
                      const tmplOverride = emailSettings.templateColors?.[t.triggerEvent];
                      const hasOverride = Boolean(
                        tmplOverride && Object.keys(tmplOverride).length > 0
                      );
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(t.id);
                            setDraft({ ...t });
                          }}
                          className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex items-start justify-between gap-2 ${
                            active
                              ? 'bg-[#171717] text-white shadow-sm'
                              : 'hover:bg-[#F7F7F8] text-[#111827]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{t.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {hasOverride && (
                                <span
                                  className="inline-flex items-center gap-0.5 shrink-0"
                                  title="Custom template colors active"
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-black/15"
                                    style={{
                                      backgroundColor:
                                        tmplOverride.headerBgColor || emailSettings.headerBgColor,
                                    }}
                                  />
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-black/15"
                                    style={{
                                      backgroundColor:
                                        tmplOverride.buttonBgColor || emailSettings.buttonBgColor,
                                    }}
                                  />
                                </span>
                              )}
                              <p
                                className={`text-[12px] font-mono truncate ${
                                  active ? 'text-white/70' : 'text-[#6B7280]'
                                }`}
                              >
                                {t.triggerEvent}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-full text-[12px] font-bold ${
                              t.isActive
                                ? active
                                  ? 'bg-[#CCF3C6] text-[#14532D]'
                                  : 'bg-[#DCFCE7] text-[#15803D]'
                                : active
                                ? 'bg-white/20 text-white'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                            }`}
                          >
                            {t.isActive ? 'On' : 'Paused'}
                          </span>
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            {/* Center: Visual WYSIWYG + HTML Content Editor */}
            <div className="xl:col-span-5 bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-5 sm:p-6">
              {draft ? (
                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0F1F3]">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#CCF3C6] text-[#14532D] text-[12px] font-mono font-bold">
                        {draft.triggerEvent}
                      </span>
                      <h3 className="text-sm font-bold text-[#111827] mt-1">{draft.name}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, isActive: !draft.isActive })}
                        className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer ${
                          draft.isActive
                            ? 'bg-[#DCFCE7] text-[#15803D] hover:bg-[#CCF3C6]'
                            : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                        }`}
                      >
                        {draft.isActive ? 'Email Enabled' : 'Email Paused'}
                      </button>
                      {isBuiltInEvent(draft.triggerEvent) ? (
                        <button
                          type="button"
                          onClick={handleResetTemplate}
                          title="Restore default template copy"
                          className="p-2 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(draft.id)}
                          title="Delete custom template"
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Template Name</label>
                      <input
                        required
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Trigger Event</label>
                      <input
                        value={draft.triggerEvent}
                        readOnly={isBuiltInEvent(draft.triggerEvent)}
                        onChange={(e) => setDraft({ ...draft, triggerEvent: e.target.value })}
                        className={`w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl font-mono ${
                          isBuiltInEvent(draft.triggerEvent)
                            ? 'bg-[#F3F4F6] text-[#6B7280]'
                            : 'bg-[#F7F7F8]'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#111827]">Subject Line</label>
                      <span className="text-[12px] text-[#6B7280]">Click any token to insert</span>
                    </div>
                    <input
                      required
                      value={draft.subject}
                      onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-medium focus:outline-none focus:border-[#111827]"
                    />
                  </div>

                  {/* Clickable Variable Chips */}
                  <div>
                    <p className="font-semibold text-[#111827] mb-1.5">Dynamic Merge Variables</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mergeVars.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertTokenInline(v, 'bodyHtml')}
                          className="px-2.5 py-1 rounded-lg bg-[#F3F4F6] hover:bg-[#171717] hover:text-white text-[#111827] font-mono text-[13px] font-medium transition-colors cursor-pointer"
                        >
                          + {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visual Editor vs HTML Code Mode Switcher */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <label className="font-semibold text-[#111827]">Email Message Body</label>
                      <div className="inline-flex items-center p-1 bg-[#F7F7F8] border border-[#EAECEF] rounded-xl">
                        <button
                          type="button"
                          onClick={() => setEditorMode('visual')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            editorMode === 'visual'
                              ? 'bg-[#171717] text-white shadow-xs'
                              : 'text-[#6B7280] hover:text-[#111827]'
                          }`}
                        >
                          <PenLine className="w-3 h-3" />
                          <span>Visual Editor</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorMode('html')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                            editorMode === 'html'
                              ? 'bg-[#171717] text-white shadow-xs'
                              : 'text-[#6B7280] hover:text-[#111827]'
                          }`}
                        >
                          <Code2 className="w-3 h-3" />
                          <span>HTML Code</span>
                        </button>
                      </div>
                    </div>

                    {editorMode === 'visual' ? (
                      <RichVisualEmailEditor
                        value={draft.bodyHtml || ''}
                        templateKey={draft.id}
                        onChange={(html) => setDraft({ ...draft, bodyHtml: html })}
                        buttonBgColor={effectiveTemplateSettings.buttonBgColor || '#8B5D36'}
                        buttonTextColor={effectiveTemplateSettings.buttonTextColor || '#FFFFFF'}
                        buttonRadius={effectiveTemplateSettings.buttonRadius || '12px'}
                        accentBgColor={effectiveTemplateSettings.accentBgColor || '#F8F3EC'}
                        accentColor={effectiveTemplateSettings.accentColor || '#734926'}
                        cardBorderColor={effectiveTemplateSettings.cardBorderColor || '#E8DFD3'}
                        onRequestInsertImage={(insertFn) =>
                          setMediaPickerTarget({ kind: 'bodyImage', insertFn })
                        }
                        registerInsertFn={(fn) => {
                          visualInsertRef.current = fn;
                        }}
                      />
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              insertTokenIntoBody(
                                '<h2 style="margin:0 0 12px;font-size:18px;font-weight:800;color:#111827;">Headline Text</h2>'
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-[#F7F7F8] border border-[#E5E7EB] hover:bg-[#EAECEF] text-[12px] font-semibold cursor-pointer"
                          >
                            + Heading
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertTokenIntoBody(
                                '<div style="margin:14px 0;padding:14px 16px;background:#F8F3EC;border-radius:12px;border:1px solid #E5D7C6;"><p style="margin:0;font-weight:700;color:#231912;">Summary Highlight</p><p style="margin:4px 0 0;color:#6E5644;">Reference: {{orderNumber}}</p></div>'
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-[#F7F7F8] border border-[#E5E7EB] hover:bg-[#EAECEF] text-[12px] font-semibold cursor-pointer"
                          >
                            + Summary Box
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertTokenIntoBody(
                                `<p style="margin:16px 0;"><a href="{{quoteUrl}}" data-ka-cta="true" style="display:inline-block;padding:12px 24px;border-radius:${
                                  emailSettings.buttonRadius || '12px'
                                };background:${emailSettings.buttonBgColor || '#8B5D36'};color:${
                                  emailSettings.buttonTextColor || '#FFFFFF'
                                };text-decoration:none;font-weight:700;">View Details</a></p>`
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-[#F7F7F8] border border-[#E5E7EB] hover:bg-[#EAECEF] text-[12px] font-semibold cursor-pointer"
                          >
                            + Action Button
                          </button>
                        </div>
                        <textarea
                          rows={11}
                          required
                          value={draft.bodyHtml}
                          onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })}
                          className="w-full px-3.5 py-3 bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl font-mono text-[13px] leading-relaxed focus:outline-none focus:border-[#111827]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Direct Per-Template Color Editor */}
                  <div className="pt-4 border-t border-[#F0F1F3] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#111827] flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5 text-[#8B5D36]" />
                          <span>Template Colors</span>
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          {hasCustomTemplateColors
                            ? 'Custom colors active for this email template'
                            : 'Using global brand colors — pick any swatch below to customize this email'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {hasCustomTemplateColors && (
                          <button
                            type="button"
                            onClick={resetTemplateColorsToGlobal}
                            className="px-2.5 py-1 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Reset to Global
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={applyTemplateColorsGlobally}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#DECFC0] hover:border-[#8B5D36] text-[#231912] text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Apply to All
                        </button>
                      </div>
                    </div>

                    {/* Quick Palette Swatches for This Template */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {DESIGN_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyPresetToTemplate(preset)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F7F8] hover:bg-white border border-[#E5E7EB] hover:border-[#8B5D36] text-[11px] font-semibold text-[#111827] cursor-pointer whitespace-nowrap"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/15"
                            style={{ backgroundColor: preset.headerBgColor }}
                          />
                          <span>{preset.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Interactive Color Pickers for This Template */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {EMAIL_COLOR_FIELDS.map(({ key, label }) => {
                        const val = effectiveTemplateSettings[key] || '#171717';
                        const isOverridden = Boolean(
                          emailSettings.templateColors?.[draft.triggerEvent]?.[key]
                        );
                        return (
                          <div
                            key={key}
                            className={`p-2 rounded-xl border transition-colors ${
                              isOverridden
                                ? 'bg-[#FAF6F0] border-[#DECFC0]'
                                : 'bg-[#F7F7F8] border-[#E5E7EB]'
                            }`}
                          >
                            <label className="block text-[11px] font-semibold text-[#6B7280] mb-1 truncate">
                              {label}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={/^#[0-9A-Fa-f]{6}$/.test(val) ? val : '#171717'}
                                aria-label={`${draft.name} ${label}`}
                                onChange={(e) => updateTemplateColor(key, e.target.value)}
                                className="w-6 h-6 rounded-md cursor-pointer border-0 bg-transparent p-0 shrink-0"
                              />
                              <input
                                value={val}
                                onChange={(e) => updateTemplateColor(key, e.target.value)}
                                className="w-full min-w-0 text-[12px] font-mono bg-white px-1.5 py-0.5 rounded-md border border-[#E5E7EB]"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-5 py-2.5 bg-[#171717] text-white font-semibold rounded-xl hover:bg-[#0A0A0A] shadow-xs transition-all cursor-pointer"
                    >
                      Save Template &amp; Colors
                    </button>

                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        placeholder="Test recipient email..."
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="px-3 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl w-44"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSendTest}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold rounded-xl transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Test</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <p className="py-12 text-center text-[#6B7280]">
                  Select a template on the left to start editing visually.
                </p>
              )}
            </div>

            {/* Right Panel: Instant Live Branded Preview */}
            <div className="xl:col-span-4">{renderPreviewEnvelope(true)}</div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: VISUAL DESIGN & BRANDING STUDIO ==================== */}
      {subTab === 'design' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left Column: Complete Visual Design Controls + Quick Content Edit */}
          <div className="xl:col-span-6 bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 space-y-6">
            {/* Visible Email Template Selector inside Design Studio */}
            <div className="pb-4 border-b border-[#F0F1F3]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-[#111827]">
                  Email Templates ({templates.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setSubTab('templates')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B5D36] hover:underline cursor-pointer"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>Open Full Copy Editor</span>
                </button>
              </div>
              {loading ? (
                <div className="h-10 rounded-xl bg-[#F3F4F6] animate-pulse" />
              ) : templates.length === 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRestoreDefaultTemplates}
                  className="px-3.5 py-2 rounded-xl ka-oak-btn text-xs font-semibold cursor-pointer"
                >
                  Load 7 Default Templates
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {templates.map((t) => {
                    const active = draft?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(t.id);
                          setDraft({ ...t });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                          active
                            ? 'bg-[#171717] text-white border-[#171717]'
                            : 'bg-[#F7F7F8] text-[#111827] border-[#E5E7EB] hover:border-[#8B5D36]'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#111827]">1-Click Visual Design Themes</h3>
              <p className="text-[#6B7280] mt-0.5">
                Pick a curated aesthetic (including Sculpted Oak matching the storefront) or fine-tune every detail below.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
                {DESIGN_PRESETS.map((preset) => {
                  const selected = emailSettings.headerBgColor === preset.headerBgColor;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setEmailSettings({ ...emailSettings, ...preset })}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-[#8B5D36] bg-[#FAF6F0] shadow-xs'
                          : 'border-[#E5E7EB] hover:border-[#171717] bg-[#F7F7F8] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.headerBgColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.buttonBgColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.accentBgColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.canvasBgColor }}
                        />
                      </div>
                      <p className="font-bold text-[#111827] text-[13px]">{preset.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Header, Logo & Editorial Banner Image */}
            <div className="space-y-4 pt-4 border-t border-[#F0F1F3]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[#111827]">Header, Logo &amp; Hero Banner</h3>
                <div className="inline-flex items-center p-1 bg-[#F7F7F8] border border-[#EAECEF] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEmailSettings({ ...emailSettings, headerAlign: 'left' })}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      (emailSettings.headerAlign || 'left') === 'left'
                        ? 'bg-[#171717] text-white'
                        : 'text-[#6B7280]'
                    }`}
                  >
                    <AlignLeft className="w-3 h-3" />
                    <span>Left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailSettings({ ...emailSettings, headerAlign: 'center' })}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      emailSettings.headerAlign === 'center'
                        ? 'bg-[#171717] text-white'
                        : 'text-[#6B7280]'
                    }`}
                  >
                    <AlignCenter className="w-3 h-3" />
                    <span>Center</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#111827] mb-1">Header Brand Title</label>
                  <input
                    value={emailSettings.senderName || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, senderName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#111827] mb-1">Header Tagline</label>
                  <input
                    value={emailSettings.headerTagline || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, headerTagline: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#111827] mb-1">Email Logo URL (Optional)</label>
                <div className="flex gap-2">
                  <input
                    placeholder="https://... or /uploads/..."
                    value={emailSettings.logoUrl || ''}
                    onChange={(e) => setEmailSettings({ ...emailSettings, logoUrl: e.target.value })}
                    className="flex-1 px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget('logo')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Pick Logo</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#111827] mb-1">
                  Editorial Hero Banner Image (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    placeholder="Showroom or product banner URL..."
                    value={emailSettings.heroBannerUrl || ''}
                    onChange={(e) =>
                      setEmailSettings({ ...emailSettings, heroBannerUrl: e.target.value })
                    }
                    className="flex-1 px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget('heroBanner')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Pick Banner</span>
                  </button>
                  {emailSettings.heroBannerUrl && (
                    <button
                      type="button"
                      onClick={() => setEmailSettings({ ...emailSettings, heroBannerUrl: '' })}
                      className="px-3 py-2.5 bg-red-50 text-red-700 rounded-xl font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Colors, Typography & Geometry */}
            <div className="space-y-4 pt-4 border-t border-[#F0F1F3]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#111827]">Colors, Typography &amp; Geometry</h3>
                {hasCustomTemplateColors && (
                  <button
                    type="button"
                    onClick={resetTemplateColorsToGlobal}
                    className="text-[11px] font-semibold text-[#8B5D36] hover:underline cursor-pointer"
                  >
                    Previewed template uses custom colors · Reset to global
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EMAIL_COLOR_FIELDS.map(({ key, label }) => (
                  <div key={key} className="p-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl">
                    <label className="block text-[12px] font-bold text-[#6B7280] mb-1.5">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(emailSettings[key] || '') ? emailSettings[key] : '#171717'}
                        onChange={(e) => setEmailSettings({ ...emailSettings, [key]: e.target.value })}
                        className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0 shrink-0"
                      />
                      <input
                        value={emailSettings[key] || ''}
                        onChange={(e) => setEmailSettings({ ...emailSettings, [key]: e.target.value })}
                        className="w-full text-[13px] font-mono bg-white px-2 py-1 rounded-lg border border-[#E5E7EB]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block font-semibold text-[#111827] mb-1.5">Card Radius</label>
                  <div className="inline-flex p-1 bg-[#F7F7F8] border border-[#EAECEF] rounded-xl gap-1">
                    {[
                      { value: '10px', label: 'Sharp' },
                      { value: '20px', label: 'Modern' },
                      { value: '28px', label: 'Soft' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setEmailSettings({ ...emailSettings, cardBorderRadius: opt.value })
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          emailSettings.cardBorderRadius === opt.value
                            ? 'bg-[#171717] text-white'
                            : 'text-[#6B7280] hover:text-[#111827]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#111827] mb-1.5">Button Radius</label>
                  <div className="inline-flex p-1 bg-[#F7F7F8] border border-[#EAECEF] rounded-xl gap-1">
                    {[
                      { value: '6px', label: 'Square' },
                      { value: '12px', label: 'Rounded' },
                      { value: '999px', label: 'Pill' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEmailSettings({ ...emailSettings, buttonRadius: opt.value })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          (emailSettings.buttonRadius || '12px') === opt.value
                            ? 'bg-[#171717] text-white'
                            : 'text-[#6B7280] hover:text-[#111827]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#111827] mb-1.5">Typography</label>
                  <div className="inline-flex p-1 bg-[#F7F7F8] border border-[#EAECEF] rounded-xl gap-1">
                    {[
                      { value: 'sans', label: 'Proxima Sans' },
                      { value: 'serif', label: 'Editorial Serif' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEmailSettings({ ...emailSettings, fontStyle: opt.value })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                          (emailSettings.fontStyle || 'sans') === opt.value
                            ? 'bg-[#171717] text-white'
                            : 'text-[#6B7280] hover:text-[#111827]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Copy & Direct Content Jump */}
            <div className="space-y-3 pt-4 border-t border-[#F0F1F3]">
              <h3 className="text-sm font-bold text-[#111827]">Footer Copy &amp; Signature</h3>
              <textarea
                rows={3}
                value={emailSettings.footerText || ''}
                onChange={(e) => setEmailSettings({ ...emailSettings, footerText: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-2xl"
              />
              <label className="inline-flex items-center gap-2.5 p-3 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(emailSettings.showStoreAddress)}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, showStoreAddress: e.target.checked })
                  }
                />
                <span className="font-medium text-[#111827]">
                  Include store address &amp; phone ({generalSettings.address || 'configured in General'})
                </span>
              </label>

              {/* Inline quick-edit of currently previewed template copy right from Design Studio */}
              {draft && (
                <div className="mt-4 p-4 rounded-2xl bg-[#FAF6F0] border border-[#E5D7C6] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#231912]">
                        Editing Previewed Email: {draft.name}
                      </p>
                      <p className="text-[11px] text-[#6E5644]">
                        Update the subject right here or open the full Visual Editor
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubTab('templates')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ka-oak-btn text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      <span>Edit Body Visually</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={draft.subject}
                      onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-[#DECFC0] rounded-xl font-medium"
                      placeholder="Email Subject..."
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveTemplate()}
                      className="px-3.5 py-2 bg-[#171717] hover:bg-[#0A0A0A] text-white text-xs font-semibold rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      Save Subject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Interactive Visual Preview */}
          <div className="xl:col-span-6 xl:sticky xl:top-20">{renderPreviewEnvelope(false)}</div>
        </div>
      )}

      {/* ==================== TAB 3: SENDER & TRIGGERS ==================== */}
      {subTab === 'triggers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Sender Identity &amp; Routing</h3>
              <p className="text-[#6B7280] mt-0.5">
                Configure outbound identity and where admin alerts are sent.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#111827] mb-1">Sender Display Name</label>
                <input
                  value={emailSettings.senderName || ''}
                  onChange={(e) => setEmailSettings({ ...emailSettings, senderName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111827] mb-1">From Email Address</label>
                <input
                  type="email"
                  value={emailSettings.senderAddress || ''}
                  onChange={(e) => setEmailSettings({ ...emailSettings, senderAddress: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111827] mb-1">Reply-To Address</label>
                <input
                  type="email"
                  value={emailSettings.replyToAddress || ''}
                  onChange={(e) => setEmailSettings({ ...emailSettings, replyToAddress: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111827] mb-1">Admin Notification Inbox</label>
                <input
                  type="email"
                  value={emailSettings.adminNotificationEmail || ''}
                  onChange={(e) =>
                    setEmailSettings({ ...emailSettings, adminNotificationEmail: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Automated Event Triggers</h3>
              <p className="text-[#6B7280] mt-0.5">
                Enable or pause automated emails across orders, inquiries, and quotes.
              </p>
            </div>
            <div className="space-y-2.5">
              {[
                ['notifyCustomerOnOrder', 'Order Confirmation → Customer', 'order.created'],
                ['notifyAdminOnOrder', 'New Order Alert → Admin', 'order.admin_alert'],
                ['notifyCustomerOnOrderUpdate', 'Order Status / Shipping Update → Customer', 'order.updated'],
                ['notifyCustomerOnInquiry', 'Inquiry Receipt Confirmation → Customer', 'inquiry.created'],
                ['notifyAdminOnInquiry', 'New Catalogue Inquiry Alert → Admin', 'inquiry.admin_alert'],
                ['notifyCustomerOnQuotation', 'Quotation Delivery & Portal Link → Customer', 'quotation.sent'],
                ['notifyAdminOnQuotationResponse', 'Quotation Accepted / Rejected Alert → Admin', 'quotation.responded'],
              ].map(([key, label, eventCode]) => {
                const enabled = emailSettings[key] !== false;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEmailSettings({ ...emailSettings, [key]: !enabled })}
                    className="w-full flex items-center justify-between p-3.5 bg-[#F7F7F8] hover:bg-[#F0F1F3] border border-[#E5E7EB] rounded-2xl text-left transition-all cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold text-[#111827]">{label}</p>
                      <p className="text-[12px] font-mono text-[#6B7280]">{eventCode}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[13px] font-bold ${
                        enabled ? 'bg-[#CCF3C6] text-[#14532D]' : 'bg-[#E5E7EB] text-[#6B7280]'
                      }`}
                    >
                      {enabled ? 'Enabled' : 'Paused'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: SENT EMAIL LOG ==================== */}
      {subTab === 'logs' && (
        <div className="bg-white border border-[#F0F1F3] shadow-[0_8px_30px_rgba(17,24,39,0.04)] rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-[#F0F1F3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Dispatched Email Audit Log</h3>
              <p className="text-[#6B7280] mt-0.5">
                Every rendered email sent by the platform is archived here for inspection.
              </p>
            </div>
            <input
              placeholder="Filter by event, recipient, or subject..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="px-3.5 py-2 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl w-full sm:w-72"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F7F7F8] border-b border-[#F0F1F3] text-[#6B7280]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Trigger Event</th>
                  <th className="py-3 px-4 font-semibold">Recipient</th>
                  <th className="py-3 px-4 font-semibold">Subject</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3]">
                {filteredLogs.map((n) => (
                  <tr key={n.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-3 px-4 text-[#6B7280] tabular-nums whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#111827]">{n.type}</td>
                    <td className="py-3 px-4">{n.recipientEmail}</td>
                    <td className="py-3 px-4 font-medium text-[#111827]">{n.subject}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] font-semibold capitalize">
                        {n.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectLog(n)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#171717] hover:text-white rounded-xl font-semibold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#6B7280]">
                      No matching email notifications found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expanded Full-Width Visual Email Lightbox */}
      {expandedPreviewOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpandedPreviewOpen(false);
          }}
        >
          <div className="bg-white border border-[#F0F1F3] rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F0F1F3] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                  Full-Scale Visual Email Preview
                </p>
                <p className="text-sm font-bold text-[#111827] truncate">{livePreview.subject}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex items-center p-1 bg-[#F7F7F8] rounded-xl border border-[#EAECEF]">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewDevice === 'desktop' ? 'bg-[#171717] text-white' : 'text-[#6B7280]'
                    }`}
                  >
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      previewDevice === 'mobile' ? 'bg-[#171717] text-white' : 'text-[#6B7280]'
                    }`}
                  >
                    Mobile
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedPreviewOpen(false)}
                  className="p-2 rounded-xl hover:bg-[#F3F4F6] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#EAECEF] p-5 flex justify-center overflow-auto">
              <iframe
                title="Expanded Email Visual Preview"
                srcDoc={livePreview.html}
                className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-md transition-all duration-200 ${
                  previewDevice === 'mobile' ? 'w-[375px]' : 'w-full max-w-[720px]'
                } h-full`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Email Template Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTemplate}
            className="bg-white border border-[#F0F1F3] rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#F0F1F3]">
              <h3 className="text-base font-bold text-[#111827]">Create Custom Email Template</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1.5 rounded-xl hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-semibold mb-1">Template Name</label>
              <input
                required
                placeholder="e.g. Shipping Dispatch Notice"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Trigger Event Key</label>
              <input
                required
                placeholder="e.g. shipment.dispatched"
                value={newForm.triggerEvent}
                onChange={(e) => setNewForm({ ...newForm, triggerEvent: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Subject Line</label>
              <input
                required
                value={newForm.subject}
                onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Initial Message Content</label>
              <textarea
                rows={5}
                required
                value={newForm.bodyHtml}
                onChange={(e) => setNewForm({ ...newForm, bodyHtml: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#F7F7F8] border border-[#E5E7EB] rounded-xl font-mono"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 bg-[#171717] hover:bg-[#0A0A0A] text-white font-semibold rounded-xl cursor-pointer"
              >
                Create Template
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Media Picker Modal (Logo, Hero Banner, or Inline Email Body Image) */}
      {mediaPickerTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#F0F1F3] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F0F1F3] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111827]">
                {mediaPickerTarget === 'logo'
                  ? 'Select Logo from Media Library'
                  : mediaPickerTarget === 'heroBanner'
                  ? 'Select Hero Banner Image'
                  : 'Insert Image into Email'}
              </h3>
              <button
                type="button"
                onClick={() => setMediaPickerTarget(null)}
                className="p-1.5 rounded-xl hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
              {mediaAssets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (mediaPickerTarget === 'logo') {
                      setEmailSettings({ ...emailSettings, logoUrl: m.url });
                    } else if (mediaPickerTarget === 'heroBanner') {
                      setEmailSettings({ ...emailSettings, heroBannerUrl: m.url });
                    } else if (typeof mediaPickerTarget === 'object') {
                      mediaPickerTarget.insertFn(m.url);
                    }
                    setMediaPickerTarget(null);
                  }}
                  className="border border-[#E5E7EB] hover:border-[#171717] rounded-2xl overflow-hidden text-left bg-[#F7F7F8] cursor-pointer"
                >
                  <img src={m.url} alt={m.filename} className="w-full h-24 object-cover" />
                  <p className="p-2 text-[13px] font-medium truncate">{m.filename}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inspect Rendered Sent Email Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#F0F1F3] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F0F1F3] flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[#111827]">{inspectLog.subject}</p>
                <p className="text-[13px] text-[#6B7280]">
                  To: {inspectLog.recipientEmail} · {new Date(inspectLog.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="p-1.5 rounded-xl hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 bg-[#EAECEF]/60 overflow-auto">
              <iframe
                title="Sent Email Archive"
                srcDoc={inspectLog.body}
                className="w-full min-h-[460px] bg-white rounded-2xl border border-[#E5E7EB]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
