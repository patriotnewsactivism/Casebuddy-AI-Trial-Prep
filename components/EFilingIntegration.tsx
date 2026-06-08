import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import {
  Send, Search, FileText, Download, Upload, ExternalLink, Clock,
  AlertTriangle, CheckCircle, Loader2, Globe, Building2, DollarSign,
  Eye, Filter, RefreshCw, Scale, Gavel, BookOpen, Copy
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';

interface PacerCase {
  caseNumber: string;
  caseName: string;
  court: string;
  dateFiled: string;
  dateTerminated?: string;
  natureOfSuit: string;
  cause: string;
  jurisdiction: string;
  assignedJudge: string;
  referredJudge?: string;
  parties: { name: string; role: string; attorneys: string[] }[];
}

interface DocketEntry {
  entryNumber: number;
  date: string;
  description: string;
  filedBy: string;
  documentType: string;
  pages?: number;
}

interface FilingTemplate {
  id: string;
  name: string;
  courtSystem: string;
  requirements: string[];
  format: string;
  maxFileSize: string;
  acceptedTypes: string[];
  fees: string;
}

const EFilingIntegration = () => {
  const { activeCase } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'search' | 'docket' | 'filing' | 'guide'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'case_number' | 'party'>('name');
  const [selectedCourt, setSelectedCourt] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PacerCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<PacerCase | null>(null);
  const [docketEntries, setDocketEntries] = useState<DocketEntry[]>([]);
  const [isLoadingDocket, setIsLoadingDocket] = useState(false);

  const COURTS = [
    'All Federal Courts', 'N.D. Mississippi', 'S.D. Mississippi', 'N.D. Alabama', 'M.D. Alabama',
    'S.D. Alabama', 'W.D. Tennessee', 'E.D. Tennessee', 'N.D. Georgia', 'M.D. Georgia',
    'S.D. Georgia', 'E.D. Louisiana', 'W.D. Louisiana', 'E.D. Arkansas', 'W.D. Arkansas',
    'D. South Carolina', 'W.D. North Carolina', 'E.D. North Carolina', 'M.D. North Carolina',
    'N.D. Florida', 'M.D. Florida', 'S.D. Florida', 'E.D. Virginia', 'W.D. Virginia',
    '5th Circuit Court of Appeals', '11th Circuit Court of Appeals',
  ];

  const FILING_TEMPLATES: FilingTemplate[] = [
    { id: '1', name: 'Civil Complaint', courtSystem: 'CM/ECF', requirements: ['PDF/A format', 'Separate civil cover sheet (JS-44)', 'Filing fee or IFP motion', 'Summons for each defendant'], format: 'PDF/A', maxFileSize: '35 MB', acceptedTypes: ['.pdf'], fees: '$405 (civil)' },
    { id: '2', name: 'Motion', courtSystem: 'CM/ECF', requirements: ['PDF format', 'Proposed order as separate document', 'Certificate of service', 'Brief/memorandum in support'], format: 'PDF', maxFileSize: '35 MB', acceptedTypes: ['.pdf'], fees: 'No fee' },
    { id: '3', name: 'Discovery Documents', courtSystem: 'CM/ECF', requirements: ['PDF format', 'Certificate of service', 'NOT filed unless dispute arises', 'Served directly on parties'], format: 'PDF', maxFileSize: '35 MB', acceptedTypes: ['.pdf'], fees: 'No fee' },
    { id: '4', name: 'Appeal Notice', courtSystem: 'CM/ECF', requirements: ['PDF format', 'Within 30 days of final judgment (civil)', 'Docketing statement', 'Filing fee or IFP motion'], format: 'PDF', maxFileSize: '35 MB', acceptedTypes: ['.pdf'], fees: '$505 (appeal)' },
    { id: '5', name: 'Pro Se Filing', courtSystem: 'Varies', requirements: ['May file on paper in many courts', 'Some courts offer limited e-filing for pro se', 'Check local rules for pro se e-filing access', 'IFP application if unable to pay fees'], format: 'PDF or Paper', maxFileSize: '35 MB', acceptedTypes: ['.pdf', '.doc', '.docx'], fees: 'Varies / IFP waiver available' },
  ];

  const searchPACER = async () => {
    if (!searchQuery.trim()) {
      toast.error('Enter a search query');
      return;
    }
    setIsSearching(true);

    try {
      const prompt = `Simulate a PACER/CM-ECF case search. Generate realistic but fictional federal court case results for the query: "${searchQuery}" (search type: ${searchType}, court: ${selectedCourt}).

Return JSON array of 5-8 realistic cases:
[{
  "caseNumber": "realistic case number format like 3:24-cv-00123",
  "caseName": "Party v. Party",
  "court": "actual federal court name",
  "dateFiled": "YYYY-MM-DD",
  "dateTerminated": "YYYY-MM-DD or null if active",
  "natureOfSuit": "NOS code and description",
  "cause": "statutory cause",
  "jurisdiction": "Federal Question / Diversity",
  "assignedJudge": "realistic judge name",
  "referredJudge": "magistrate judge name or null",
  "parties": [{"name": "party name", "role": "Plaintiff/Defendant", "attorneys": ["attorney names"]}]
}]

Make them realistic for ${selectedCourt !== 'all' ? selectedCourt : 'various federal courts'} and relevant to the search query.`;

      const result = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.5, maxOutputTokens: 4096, responseMimeType: 'application/json' },
      });

      setSearchResults(JSON.parse(result.text));
      toast.success(`Found ${JSON.parse(result.text).length} cases`);
    } catch (error) {
      console.error('PACER search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const loadDocket = async (pacerCase: PacerCase) => {
    setSelectedCase(pacerCase);
    setIsLoadingDocket(true);

    try {
      const prompt = `Generate a realistic federal court docket sheet for the case: ${pacerCase.caseName} (${pacerCase.caseNumber}), filed ${pacerCase.dateFiled} in ${pacerCase.court}. Nature of suit: ${pacerCase.natureOfSuit}.

Return JSON array of 15-25 docket entries in chronological order:
[{
  "entryNumber": 1,
  "date": "YYYY-MM-DD",
  "description": "realistic docket entry text with actual legal document names and procedures",
  "filedBy": "party or court",
  "documentType": "Complaint/Motion/Order/Notice/etc",
  "pages": number or null
}]

Include realistic entries: complaint, summons, answers, motions, discovery disputes, scheduling orders, etc.`;

      const result = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.4, maxOutputTokens: 6144, responseMimeType: 'application/json' },
      });

      setDocketEntries(JSON.parse(result.text));
    } catch (error) {
      console.error('Docket load error:', error);
      toast.error('Failed to load docket');
    } finally {
      setIsLoadingDocket(false);
    }
  };

  const tabs = [
    { id: 'search', label: 'Case Search', icon: Search },
    { id: 'docket', label: 'Docket Viewer', icon: FileText },
    { id: 'filing', label: 'E-Filing Guide', icon: Upload },
    { id: 'guide', label: 'Court Directory', icon: Building2 },
  ] as const;

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
            <Send size={24} className="text-indigo-400" />
          </div>
          E-Filing & Court Records
        </h1>
        <p className="text-slate-400 mt-1">Search federal court records, view dockets, and get e-filing guidance for CM/ECF</p>
      </div>

      {/* PACER Notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="text-amber-400 font-medium">PACER Integration Note</p>
          <p className="text-slate-400 mt-1">
            CaseBuddy provides AI-powered case research and e-filing guidance. For actual PACER document access, you'll need a{' '}
            <a href="https://pacer.uscourts.gov" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
              PACER account
            </a>{' '}
            ($0.10/page, capped at $3.00/document). We help you find the right cases and prepare filings before you go to CM/ECF.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search cases by name, number, or party..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                  onKeyDown={e => e.key === 'Enter' && searchPACER()}
                />
              </div>
              <select
                value={selectedCourt}
                onChange={e => setSelectedCourt(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="all">All Federal Courts</option>
                {COURTS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={searchPACER}
                disabled={isSearching}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search
              </button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-400">{searchResults.length} cases found</h3>
              {searchResults.map((c, i) => (
                <div key={i} className="glass-card rounded-xl p-4 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => { loadDocket(c); setActiveTab('docket'); }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{c.caseNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${c.dateTerminated ? 'bg-slate-700 text-slate-400' : 'bg-green-500/10 text-green-400'}`}>
                          {c.dateTerminated ? 'Closed' : 'Active'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">{c.caseName}</h4>
                      <p className="text-xs text-slate-500 mt-1">{c.court} • {c.natureOfSuit}</p>
                      <p className="text-xs text-slate-500">Judge: {c.assignedJudge} • Filed: {c.dateFiled}</p>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-400 hover:bg-indigo-500/20 shrink-0">
                      View Docket →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Docket Tab */}
      {activeTab === 'docket' && (
        <div className="space-y-4">
          {selectedCase ? (
            <>
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-indigo-400">{selectedCase.caseNumber}</span>
                    <h3 className="text-lg font-semibold text-white mt-1">{selectedCase.caseName}</h3>
                    <p className="text-sm text-slate-400">{selectedCase.court} • Judge {selectedCase.assignedJudge}</p>
                  </div>
                  <a
                    href={`https://pacer.uscourts.gov`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm flex items-center gap-2"
                  >
                    <ExternalLink size={14} /> Open in PACER
                  </a>
                </div>
              </div>

              {isLoadingDocket ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 size={32} className="text-indigo-400 animate-spin" />
                </div>
              ) : (
                <div className="glass-card rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50">
                      <tr className="text-left">
                        <th className="px-4 py-3 text-slate-500 font-medium w-12">#</th>
                        <th className="px-4 py-3 text-slate-500 font-medium w-28">Date</th>
                        <th className="px-4 py-3 text-slate-500 font-medium">Description</th>
                        <th className="px-4 py-3 text-slate-500 font-medium w-32">Filed By</th>
                        <th className="px-4 py-3 text-slate-500 font-medium w-16">Pages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docketEntries.map((entry, i) => (
                        <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                          <td className="px-4 py-3 text-indigo-400 font-mono">{entry.entryNumber}</td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{entry.date}</td>
                          <td className="px-4 py-3 text-slate-300">{entry.description}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{entry.filedBy}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{entry.pages || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card rounded-xl p-8 text-center">
              <FileText size={48} className="mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Case Selected</h3>
              <p className="text-sm text-slate-400">Search for a case first, then click to view its docket.</p>
            </div>
          )}
        </div>
      )}

      {/* E-Filing Guide Tab */}
      {activeTab === 'filing' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">E-Filing Requirements by Document Type</h2>
          {FILING_TEMPLATES.map(template => (
            <div key={template.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" />
                  {template.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 border border-green-500/30 text-green-400">{template.fees}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">{template.courtSystem}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Requirements</p>
                  <ul className="space-y-1">
                    {template.requirements.map((req, i) => (
                      <li key={i} className="text-slate-300 flex items-start gap-1.5">
                        <CheckCircle size={12} className="text-green-400 mt-0.5 shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Format</p>
                  <p className="text-white">{template.format}</p>
                  <p className="text-xs text-slate-500 mt-2 mb-1">Max Size</p>
                  <p className="text-white">{template.maxFileSize}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Accepted File Types</p>
                  <div className="flex flex-wrap gap-1">
                    {template.acceptedTypes.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-400">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Court Directory Tab */}
      {activeTab === 'guide' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Federal Court E-Filing Systems</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'PACER', desc: 'Public Access to Court Electronic Records', url: 'https://pacer.uscourts.gov', icon: Search, cost: '$0.10/page (capped at $3/doc)' },
              { name: 'CM/ECF', desc: 'Case Management / Electronic Case Filing', url: 'https://www.uscourts.gov/court-records/electronic-filing-cmecf', icon: Upload, cost: 'Filing fees vary by document type' },
              { name: 'RECAP', desc: 'Free PACER documents via CourtListener', url: 'https://www.courtlistener.com/recap/', icon: Download, cost: 'Free (community-sourced)' },
              { name: 'Court Locator', desc: 'Find your federal court', url: 'https://www.uscourts.gov/federal-court-finder/search', icon: Globe, cost: 'Free' },
            ].map((system, i) => (
              <a key={i} href={system.url} target="_blank" rel="noopener noreferrer"
                 className="glass-card rounded-xl p-4 hover:bg-slate-800/30 transition-colors block">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10">
                    <system.icon size={16} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{system.name}</h3>
                    <p className="text-xs text-slate-400">{system.desc}</p>
                  </div>
                  <ExternalLink size={14} className="ml-auto text-slate-500" />
                </div>
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <DollarSign size={10} /> {system.cost}
                </p>
              </a>
            ))}
          </div>

          <div className="glass-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">📋 CM/ECF Filing Checklist</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {[
                'Register for a CM/ECF account with your court',
                'Complete mandatory e-filing training',
                'Convert all documents to PDF format',
                'Remove metadata and ensure accessibility',
                'Redact sensitive information (SSN, DOB, financial)',
                'Prepare separate attachments under 35MB each',
                'Draft certificate of service',
                'Have filing fee payment ready (credit/debit/ACH)',
                'Verify correct case number before filing',
                'Save confirmation receipt after filing',
              ].map((item, i) => (
                <label key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800/30 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 accent-indigo-500" />
                  <span className="text-slate-300">{item}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EFilingIntegration;
