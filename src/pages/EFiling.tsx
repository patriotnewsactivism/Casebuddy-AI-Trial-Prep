import React, { useState } from 'react';
import { Gavel, Search, FileText, ExternalLink, Building2, Filter, Clock, ArrowRight, BookOpen, Globe } from 'lucide-react';
import AgentHeader from '../components/AgentHeader';
import { AGENTS } from '../agents/personas';

const max = AGENTS.max;

interface CourtRecord {
  id: string; caseNumber: string; caption: string; court: string;
  filed: string; type: string; status: string;
}

interface DocketEntry {
  date: string; number: string; description: string; filer: string; pages: number;
}

const COURTS = [
  { name: 'N.D. Mississippi — Oxford Division', code: 'msnd', type: 'federal', pacerUrl: 'https://ecf.msnd.uscourts.gov' },
  { name: 'S.D. Mississippi — Jackson Division', code: 'mssd', type: 'federal', pacerUrl: 'https://ecf.mssd.uscourts.gov' },
  { name: '5th Circuit Court of Appeals', code: 'ca5', type: 'federal', pacerUrl: 'https://ecf.ca5.uscourts.gov' },
  { name: 'N.D. Texas', code: 'txnd', type: 'federal', pacerUrl: 'https://ecf.txnd.uscourts.gov' },
  { name: 'S.D. Texas', code: 'txsd', type: 'federal', pacerUrl: 'https://ecf.txsd.uscourts.gov' },
  { name: 'N.D. Alabama', code: 'alnd', type: 'federal', pacerUrl: 'https://ecf.alnd.uscourts.gov' },
  { name: 'N.D. Georgia', code: 'gand', type: 'federal', pacerUrl: 'https://ecf.gand.uscourts.gov' },
  { name: 'E.D. New York', code: 'nyed', type: 'federal', pacerUrl: 'https://ecf.nyed.uscourts.gov' },
  { name: 'C.D. California', code: 'cacd', type: 'federal', pacerUrl: 'https://ecf.cacd.uscourts.gov' },
  { name: 'S.D. Florida', code: 'flsd', type: 'federal', pacerUrl: 'https://ecf.flsd.uscourts.gov' },
  { name: 'Mississippi Chancery Court', code: 'ms-chancery', type: 'state', pacerUrl: '' },
  { name: 'Mississippi Circuit Court', code: 'ms-circuit', type: 'state', pacerUrl: '' },
  { name: 'Mississippi Supreme Court', code: 'ms-supreme', type: 'state', pacerUrl: 'https://courts.ms.gov' },
];

const DOC_TYPES = [
  { type: 'Complaint', reqs: 'Civil cover sheet, filing fee ($405 federal), summons for each defendant, certificate of service', format: 'PDF, double-spaced, 1-inch margins, footer with case number' },
  { type: 'Motion to Dismiss', reqs: 'Memorandum in support, proposed order, certificate of service, meet-and-confer certification', format: 'PDF, 25-page limit (or 6,250 words), table of contents if over 10 pages' },
  { type: 'Motion for Summary Judgment', reqs: 'Statement of undisputed facts, memorandum in support, evidence exhibits, proposed order', format: 'PDF, 25-page brief limit, separate statement of facts' },
  { type: 'Discovery Requests', reqs: 'Certificate of service, comply with interrogatory/request limits', format: 'PDF, numbered paragraphs, definitions section' },
  { type: 'Answer', reqs: 'Numbered responses to each paragraph, affirmative defenses, counterclaims if any', format: 'PDF, paragraph-by-paragraph format' },
  { type: 'Motion in Limine', reqs: 'Memorandum in support, proposed order, relevant evidence citations', format: 'PDF, per local rules' },
  { type: 'Brief / Memorandum', reqs: 'Table of contents, table of authorities, certificate of compliance (word count)', format: 'PDF, 14-point font body, per local rules' },
  { type: 'Subpoena', reqs: 'Completed form (AO 88/89), certificate of service, witness/doc fees if applicable', format: 'PDF, use court-approved form' },
];

const SAMPLE_DOCKET: DocketEntry[] = [
  { date: '2026-01-15', number: '1', description: 'COMPLAINT filed by Plaintiff. Filing fee $405 paid. (Attachments: #1 Civil Cover Sheet, #2 Summons)', filer: 'Plaintiff', pages: 28 },
  { date: '2026-01-15', number: '2', description: 'SUMMONS Issued as to Defendant City of Oxford, Officer John Doe', filer: 'Clerk', pages: 2 },
  { date: '2026-02-10', number: '3', description: 'WAIVER OF SERVICE returned executed by Defendant City of Oxford', filer: 'Defendant', pages: 1 },
  { date: '2026-03-01', number: '4', description: 'ANSWER to Complaint by Defendant City of Oxford with Affirmative Defenses', filer: 'Defendant', pages: 15 },
  { date: '2026-03-15', number: '5', description: 'RULE 26(f) REPORT of the parties (Joint Discovery Plan)', filer: 'Joint', pages: 8 },
  { date: '2026-03-20', number: '6', description: 'SCHEDULING ORDER: Discovery deadline 10/1/2026, Dispositive motions 11/15/2026, Trial 2/2027', filer: 'Court', pages: 3 },
  { date: '2026-04-01', number: '7', description: "PLAINTIFF'S FIRST SET OF INTERROGATORIES to Defendant (25 interrogatories)", filer: 'Plaintiff', pages: 12 },
  { date: '2026-04-01', number: '8', description: "PLAINTIFF'S FIRST REQUEST FOR PRODUCTION to Defendant (body cam footage, policies, training records)", filer: 'Plaintiff', pages: 8 },
];

export default function EFiling() {
  const [activeTab, setActiveTab] = useState<'search' | 'docket' | 'requirements' | 'directory'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0].code);
  const [searchResults, setSearchResults] = useState<CourtRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0]);

  const handleSearch = () => {
    setSearched(true);
    // Demo results
    if (searchQuery.trim()) {
      setSearchResults([
        { id: '1', caseNumber: '3:26-cv-00142-MPM', caption: `${searchQuery} v. City of Oxford et al.`, court: 'N.D. Mississippi', filed: '2026-01-15', type: 'Civil Rights', status: 'Open' },
        { id: '2', caseNumber: '3:25-cv-00891-NBB', caption: `${searchQuery} — Related Matter`, court: 'N.D. Mississippi', filed: '2025-09-20', type: 'Section 1983', status: 'Open' },
      ]);
    } else {
      setSearchResults([]);
    }
  };

  const tabs = [
    { key: 'search' as const, label: 'Case Search', icon: Search },
    { key: 'docket' as const, label: 'Docket Viewer', icon: FileText },
    { key: 'requirements' as const, label: 'E-Filing Requirements', icon: BookOpen },
    { key: 'directory' as const, label: 'Court Directory', icon: Building2 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">E-Filing & Court Records</h1>
        <p className="text-slate-400 text-sm">Max manages e-filing, court records, formatting requirements, and service of process</p>
      </div>

      <AgentHeader agent={max} subtitle="Every filing must be perfect. I know every court's rules, formats, and deadlines cold. Nothing gets rejected on my watch." />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Case Search */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-slate-400 block mb-1">Party Name or Case Number</label>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g., Smith v. City of Oxford or 3:26-cv-00142"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Court</label>
                <select value={selectedCourt} onChange={e => setSelectedCourt(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  {COURTS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleSearch}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                  <Search size={16} /> Search
                </button>
              </div>
            </div>
          </div>

          {searched && (
            <div className="space-y-3">
              {searchResults.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
                  No results found. Try a different search or court.
                </div>
              ) : searchResults.map(r => (
                <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-indigo-500/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-indigo-400 font-mono text-sm font-bold">{r.caseNumber}</div>
                      <div className="text-white font-medium mt-1">{r.caption}</div>
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span><Building2 size={12} className="inline mr-1" />{r.court}</span>
                        <span><Clock size={12} className="inline mr-1" />Filed {r.filed}</span>
                        <span className="text-indigo-400">{r.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.status === 'Open' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        {r.status}
                      </span>
                      <button onClick={() => setActiveTab('docket')}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded flex items-center gap-1">
                        View Docket <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-400 text-xs flex items-center gap-2">
                <Globe size={14} />
                For live PACER results, access <a href="https://pcl.uscourts.gov" target="_blank" rel="noopener noreferrer" className="underline">pcl.uscourts.gov</a> directly ($0.10/page, cap $3/document)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Docket Viewer */}
      {activeTab === 'docket' && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-indigo-400 font-mono text-sm font-bold">3:26-cv-00142-MPM</div>
                <div className="text-white font-medium">Sample v. City of Oxford et al.</div>
                <div className="text-slate-500 text-xs mt-1">N.D. Mississippi — Oxford Division | Filed 01/15/2026</div>
              </div>
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full font-medium">Open</span>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-white font-medium text-sm">Docket Entries ({SAMPLE_DOCKET.length})</span>
              <Filter size={14} className="text-slate-500" />
            </div>
            <div className="divide-y divide-slate-700/50">
              {SAMPLE_DOCKET.map((entry, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="text-center shrink-0 w-10">
                      <div className="text-indigo-400 font-bold text-sm">#{entry.number}</div>
                      <div className="text-slate-600 text-xs">{entry.pages}p</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-300 text-sm">{entry.description}</div>
                      <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
                        <span>{entry.date}</span>
                        <span className="text-slate-600">|</span>
                        <span>{entry.filer}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* E-Filing Requirements */}
      {activeTab === 'requirements' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h3 className="text-white font-medium text-sm mb-3">Document Type</h3>
            {DOC_TYPES.map(dt => (
              <button key={dt.type} onClick={() => setSelectedDocType(dt)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedDocType.type === dt.type ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}>
                {dt.type}
              </button>
            ))}
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-xl font-bold text-white mb-4">{selectedDocType.type}</h3>
              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-indigo-400 font-semibold text-sm mb-2">📋 Required Documents</div>
                  <div className="text-slate-300 text-sm">{selectedDocType.reqs}</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-emerald-400 font-semibold text-sm mb-2">📄 Format Requirements</div>
                  <div className="text-slate-300 text-sm">{selectedDocType.format}</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-yellow-400 font-semibold text-sm mb-2">⚠️ Common Mistakes</div>
                  <ul className="text-slate-300 text-sm space-y-1">
                    <li>• Missing certificate of service</li>
                    <li>• Incorrect filing fee or fee waiver not attached</li>
                    <li>• Non-PDF format or unsearchable PDF</li>
                    <li>• Exceeding page/word limits without leave of court</li>
                    <li>• Failing to redact personal identifiers (SSN, DOB per Fed. R. Civ. P. 5.2)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Court Directory */}
      {activeTab === 'directory' && (
        <div className="grid md:grid-cols-2 gap-4">
          {COURTS.map(c => (
            <div key={c.code} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-indigo-500/30 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white font-medium text-sm">{c.name}</div>
                  <span className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                    c.type === 'federal' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>{c.type}</span>
                </div>
                {c.pacerUrl && (
                  <a href={c.pacerUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded flex items-center gap-1">
                    <ExternalLink size={12} /> ECF/PACER
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
