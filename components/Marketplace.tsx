import React, { useState } from 'react';
import {
  Store, Search, Star, Download, Tag, Filter, ShoppingCart,
  FileText, Scale, Users, Sparkles, TrendingUp, Clock, Shield,
  ChevronRight, Eye, Heart, DollarSign, Award, BookOpen
} from 'lucide-react';
import { toast } from 'react-toastify';

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  authorVerified: boolean;
  price: number;
  rating: number;
  reviews: number;
  downloads: number;
  type: 'template' | 'strategy' | 'checklist' | 'outline' | 'brief';
  practiceArea: string;
  jurisdiction: string;
  preview: string;
  tags: string[];
  createdAt: string;
}

const SAMPLE_ITEMS: MarketplaceItem[] = [
  { id: '1', name: 'Motion to Dismiss - Employment Discrimination', description: 'Battle-tested MTD template for Title VII employment discrimination cases. Includes all standard defenses, failure to state a claim arguments, and qualified immunity analysis. Successfully used in 12+ cases.', category: 'Motions', author: 'LegalEagle_ATL', authorVerified: true, price: 29, rating: 4.8, reviews: 47, downloads: 312, type: 'template', practiceArea: 'Employment Law', jurisdiction: 'Federal (All)', preview: 'IN THE UNITED STATES DISTRICT COURT\nFOR THE [DISTRICT]\n\n[PLAINTIFF] v. [DEFENDANT]\n\nCase No. [XX-cv-XXXXX]\n\nDEFENDANT\'S MOTION TO DISMISS\nPURSUANT TO FED. R. CIV. P. 12(b)(6)\n\nCOMES NOW the Defendant...', tags: ['MTD', 'Title VII', '12(b)(6)'], createdAt: '2026-05-15' },
  { id: '2', name: '42 USC § 1983 Civil Rights Complaint Template', description: 'Comprehensive Section 1983 complaint for excessive force, false arrest, and First Amendment retaliation. Includes Monell claim against municipality, qualified immunity analysis sections, and damages framework.', category: 'Complaints', author: 'CivilRightsLaw', authorVerified: true, price: 39, rating: 4.9, reviews: 83, downloads: 567, type: 'template', practiceArea: 'Civil Rights', jurisdiction: 'Federal (All)', preview: 'COMPLAINT FOR VIOLATION OF CIVIL RIGHTS\n42 U.S.C. § 1983\n\nI. INTRODUCTION\nThis civil rights action...', tags: ['§1983', 'Civil Rights', 'Excessive Force', 'Monell'], createdAt: '2026-04-20' },
  { id: '3', name: 'Deposition Outline: Police Misconduct', description: 'Proven deposition outline for deposing officers in police misconduct cases. 150+ strategic questions organized by topic: training, use of force policy, body camera procedures, prior complaints, and timeline of events.', category: 'Depositions', author: 'TrialPro_MS', authorVerified: false, price: 49, rating: 4.7, reviews: 31, downloads: 198, type: 'outline', practiceArea: 'Civil Rights', jurisdiction: 'All', preview: 'DEPOSITION OUTLINE - LAW ENFORCEMENT OFFICER\n\nI. BACKGROUND & TRAINING\n1. State your full name...\n2. How long have you been...', tags: ['Police', 'Deposition', 'Use of Force'], createdAt: '2026-05-01' },
  { id: '4', name: 'Personal Injury Discovery Checklist', description: 'Complete discovery checklist for PI cases: interrogatories, RFPs, RFAs, and deposition topics. Covers medical records, accident reconstruction, insurance policies, prior claims, and damages documentation.', category: 'Discovery', author: 'PIAttorney', authorVerified: true, price: 19, rating: 4.6, reviews: 62, downloads: 445, type: 'checklist', practiceArea: 'Personal Injury', jurisdiction: 'All', preview: 'PERSONAL INJURY DISCOVERY CHECKLIST\n\n□ Initial Disclosures (FRCP 26(a))\n□ Interrogatories (Set 1)...', tags: ['PI', 'Discovery', 'Checklist'], createdAt: '2026-03-10' },
  { id: '5', name: 'Criminal Defense Trial Strategy Guide', description: 'Comprehensive trial strategy framework for criminal defense. Includes voir dire questions, opening statement structure, cross-examination techniques for law enforcement, and closing argument framework.', category: 'Strategy', author: 'DefenseWins', authorVerified: true, price: 59, rating: 4.9, reviews: 29, downloads: 156, type: 'strategy', practiceArea: 'Criminal Defense', jurisdiction: 'All', preview: 'CRIMINAL DEFENSE TRIAL STRATEGY\n\nI. VOIR DIRE\nGoal: Identify jurors who...', tags: ['Criminal', 'Trial', 'Strategy'], createdAt: '2026-04-05' },
  { id: '6', name: 'Summary Judgment Brief - Qualified Immunity', description: 'Template for opposing qualified immunity at the summary judgment stage. Includes clearly established law analysis, Saucier/Pearson framework, and excessive force standards under Graham v. Connor.', category: 'Briefs', author: 'CivilRightsLaw', authorVerified: true, price: 45, rating: 4.8, reviews: 38, downloads: 234, type: 'brief', practiceArea: 'Civil Rights', jurisdiction: 'Federal (All)', preview: 'PLAINTIFF\'S MEMORANDUM IN OPPOSITION TO\nDEFENDANT\'S MOTION FOR SUMMARY JUDGMENT\nBASED ON QUALIFIED IMMUNITY...', tags: ['QI', 'Summary Judgment', '§1983'], createdAt: '2026-05-22' },
  { id: '7', name: 'Demand Letter - Police Brutality', description: 'Pre-suit demand letter template for excessive force cases. Includes factual summary framework, legal analysis, damages calculation, and settlement negotiation structure.', category: 'Letters', author: 'TrialPro_MS', authorVerified: false, price: 15, rating: 4.5, reviews: 52, downloads: 389, type: 'template', practiceArea: 'Civil Rights', jurisdiction: 'All', preview: 'VIA CERTIFIED MAIL\nRETURN RECEIPT REQUESTED\n\nRE: Demand for Compensation...', tags: ['Demand Letter', 'Police Brutality'], createdAt: '2026-02-18' },
  { id: '8', name: 'FOIA Request Templates (Federal + State)', description: '25 ready-to-use FOIA and state public records request templates. Covers police body camera footage, internal affairs files, training records, use of force reports, and personnel files.', category: 'Public Records', author: 'FOIAExpert', authorVerified: true, price: 25, rating: 4.7, reviews: 71, downloads: 512, type: 'template', practiceArea: 'Civil Rights', jurisdiction: 'All', preview: 'FREEDOM OF INFORMATION ACT REQUEST\n5 U.S.C. § 552\n\nDear FOIA Officer...', tags: ['FOIA', 'Public Records', 'Body Camera'], createdAt: '2026-01-30' },
];

const CATEGORIES = ['All', 'Motions', 'Complaints', 'Depositions', 'Discovery', 'Strategy', 'Briefs', 'Letters', 'Public Records'];
const PRACTICE_AREAS = ['All', 'Civil Rights', 'Personal Injury', 'Employment Law', 'Criminal Defense', 'Family Law', 'Corporate', 'Real Estate', 'Bankruptcy'];

const Marketplace = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedArea, setSelectedArea] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest' | 'price'>('popular');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [myPurchases, setMyPurchases] = useState<string[]>([]);

  const filteredItems = SAMPLE_ITEMS
    .filter(item => {
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !item.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (selectedArea !== 'All' && item.practiceArea !== selectedArea) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return b.downloads - a.downloads;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return a.price - b.price;
    });

  const handlePurchase = (item: MarketplaceItem) => {
    setMyPurchases(prev => [...prev, item.id]);
    toast.success(`✅ Purchased: ${item.name}`);
  };

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <Store size={24} className="text-purple-400" />
            </div>
            CaseBuddy Marketplace
          </h1>
          <p className="text-slate-400 mt-1">Battle-tested legal templates, strategies, and outlines from practicing attorneys</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Templates Available</p>
            <p className="text-2xl font-bold text-white">{SAMPLE_ITEMS.length}</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search templates, strategies, outlines..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-purple-500 outline-none"
            />
          </div>
          <select
            value={selectedArea}
            onChange={e => setSelectedArea(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none"
          >
            {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price">Lowest Price</option>
          </select>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                selectedCategory === cat ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map(item => (
          <div key={item.id} className="glass-card rounded-xl p-4 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 border border-purple-500/30 text-purple-400">{item.category}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">{item.practiceArea}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mt-2">{item.name}</h3>
              </div>
              <span className="text-lg font-bold text-green-400 shrink-0 ml-3">${item.price}</span>
            </div>

            <p className="text-xs text-slate-400 mb-3 line-clamp-2">{item.description}</p>

            <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                {item.rating} ({item.reviews})
              </span>
              <span className="flex items-center gap-1">
                <Download size={12} />
                {item.downloads}
              </span>
              <span className="flex items-center gap-1">
                {item.authorVerified && <Award size={12} className="text-blue-400" />}
                {item.author}
              </span>
            </div>

            <div className="flex flex-wrap gap-1 mb-3">
              {item.tags.map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-slate-800 text-slate-500">#{tag}</span>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedItem(item)}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 flex items-center justify-center gap-1.5"
              >
                <Eye size={14} /> Preview
              </button>
              <button
                onClick={() => handlePurchase(item)}
                disabled={myPurchases.includes(item.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${
                  myPurchases.includes(item.id) ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                {myPurchases.includes(item.id) ? (
                  <><CheckCircle size={14} /> Purchased</>
                ) : (
                  <><ShoppingCart size={14} /> ${item.price}</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <Store size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Results Found</h3>
          <p className="text-sm text-slate-400">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Preview Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">{selectedItem.name}</h2>
                <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <p className="text-sm text-slate-400 mb-4">{selectedItem.description}</p>
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-xs text-slate-500 mb-2">Preview</p>
                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{selectedItem.preview}</pre>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { handlePurchase(selectedItem); setSelectedItem(null); }}
                  disabled={myPurchases.includes(selectedItem.id)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm disabled:opacity-50"
                >
                  {myPurchases.includes(selectedItem.id) ? 'Already Purchased' : `Purchase — $${selectedItem.price}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
