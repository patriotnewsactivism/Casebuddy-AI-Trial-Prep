import React, { useState, useMemo } from 'react';
import { Store, Search, Star, Download, Eye, Filter, Tag, TrendingUp, ShoppingCart, Heart } from 'lucide-react';

interface Template {
  id: string; title: string; author: string; category: string;
  price: number; rating: number; reviews: number; downloads: number;
  description: string; preview: string; tags: string[]; featured: boolean;
}

const TEMPLATES: Template[] = [
  { id: '1', title: 'Motion to Dismiss — Section 1983 (Qualified Immunity)', author: 'Civil Rights Law Group', category: 'Motions', price: 29, rating: 4.9, reviews: 47, downloads: 312, description: 'Comprehensive MTD template with qualified immunity arguments, Pearson v. Callahan framework, and clearly established law analysis. Includes case citations for 5th Circuit.', preview: 'COMES NOW Defendant, [NAME], by and through undersigned counsel, and respectfully moves this Court to dismiss...', tags: ['civil rights', '1983', 'qualified immunity', '5th circuit'], featured: true },
  { id: '2', title: 'Demand Letter — Personal Injury (Auto Accident)', author: 'PI Attorneys Network', category: 'Letters', price: 19, rating: 4.7, reviews: 89, downloads: 567, description: 'Battle-tested demand letter template for auto accident PI claims. Includes sections for liability, damages, medical specials, pain & suffering, and settlement demand.', preview: 'Dear [ADJUSTER NAME],\n\nPlease allow this correspondence to serve as a formal demand...', tags: ['personal injury', 'auto accident', 'demand letter'], featured: true },
  { id: '3', title: 'Deposition Outline — Police Officer (Excessive Force)', author: 'CaseBuddy Pro', category: 'Depositions', price: 39, rating: 4.8, reviews: 23, downloads: 145, description: 'Detailed deposition outline for deposing police officers in excessive force cases. Covers training, policies, use-of-force continuum, body cam procedures, and internal affairs.', preview: 'I. BACKGROUND AND TRAINING\nA. Academy Training\n1. When did you attend the police academy?...', tags: ['deposition', 'police', 'excessive force', 'civil rights'], featured: true },
  { id: '4', title: 'Motion for Summary Judgment — Employment Discrimination', author: 'Employment Law Collective', category: 'Motions', price: 34, rating: 4.6, reviews: 31, downloads: 198, description: 'MSJ template for Title VII, ADA, and ADEA claims. Includes McDonnell Douglas burden-shifting framework and pretext analysis.', preview: 'MEMORANDUM IN SUPPORT OF MOTION FOR SUMMARY JUDGMENT...', tags: ['employment', 'discrimination', 'title vii', 'summary judgment'], featured: false },
  { id: '5', title: 'FOIA Request Template — Federal Agencies', author: 'Government Accountability Project', category: 'Templates', price: 0, rating: 4.5, reviews: 156, downloads: 2341, description: 'Free FOIA request template that works for any federal agency. Includes fee waiver language, expedited processing arguments, and appeal template.', preview: 'Via Electronic Submission\n[AGENCY FOIA OFFICE]\n\nDear FOIA Officer:\n\nPursuant to the Freedom of Information Act, 5 U.S.C. § 552...', tags: ['foia', 'government', 'public records', 'free'], featured: true },
  { id: '6', title: 'Trial Brief — Criminal Defense (DUI/DWI)', author: 'DUI Defense Network', category: 'Briefs', price: 29, rating: 4.4, reviews: 18, downloads: 87, description: 'Comprehensive trial brief for DUI/DWI defense. Covers field sobriety test challenges, breathalyzer calibration issues, and rising blood alcohol defense.', preview: 'STATEMENT OF THE CASE\n\nThe Defendant, [NAME], was stopped on [DATE] at approximately [TIME]...', tags: ['criminal', 'dui', 'dwi', 'trial brief'], featured: false },
  { id: '7', title: 'Jury Instructions — Civil Rights (§1983 Excessive Force)', author: 'Federal Litigation Center', category: 'Jury', price: 24, rating: 4.8, reviews: 29, downloads: 176, description: 'Proposed jury instructions for Section 1983 excessive force claims based on 5th Circuit Pattern Jury Instructions with modifications.', preview: 'PROPOSED JURY INSTRUCTION NO. __\n\nEXCESSIVE FORCE — FOURTH AMENDMENT STANDARD...', tags: ['jury instructions', 'civil rights', '1983', 'excessive force'], featured: false },
  { id: '8', title: 'Discovery Request Package — General Civil Litigation', author: 'Litigation Resources Inc', category: 'Discovery', price: 44, rating: 4.7, reviews: 62, downloads: 423, description: 'Complete discovery package: interrogatories (25), RFPs (30), RFAs (25), and deposition notices. Customizable for any civil case.', preview: 'PLAINTIFF\'S FIRST SET OF INTERROGATORIES TO DEFENDANT\n\nINTERROGATORY NO. 1: State your full legal name...', tags: ['discovery', 'interrogatories', 'rfp', 'rfa'], featured: true },
  { id: '9', title: 'Settlement Agreement — Multi-Party Civil Rights', author: 'Mediation Professionals', category: 'Agreements', price: 49, rating: 4.9, reviews: 14, downloads: 89, description: 'Comprehensive settlement agreement template for multi-defendant civil rights cases. Includes release language, confidentiality provisions, and policy change requirements.', preview: 'SETTLEMENT AGREEMENT AND MUTUAL RELEASE\n\nThis Settlement Agreement...', tags: ['settlement', 'civil rights', 'agreement'], featured: false },
  { id: '10', title: 'Case Strategy Playbook — Police Misconduct', author: 'CaseBuddy Pro', category: 'Strategy', price: 59, rating: 5.0, reviews: 8, downloads: 45, description: 'Complete litigation strategy guide for police misconduct cases. From intake to trial, including discovery plan, expert witness guide, damages framework, and closing argument outline.', preview: 'CHAPTER 1: CASE EVALUATION\n\n1.1 Initial Assessment Checklist...', tags: ['strategy', 'police misconduct', 'civil rights', 'playbook'], featured: true },
];

const CATEGORIES = ['All', 'Motions', 'Letters', 'Depositions', 'Discovery', 'Briefs', 'Jury', 'Templates', 'Agreements', 'Strategy'];

export default function Marketplace() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'newest' | 'price'>('popular');
  const [preview, setPreview] = useState<Template | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = TEMPLATES;
    if (category !== 'All') list = list.filter(t => t.category === category);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s) ||
        t.tags.some(tag => tag.includes(s))
      );
    }
    switch (sortBy) {
      case 'popular': return [...list].sort((a, b) => b.downloads - a.downloads);
      case 'rating': return [...list].sort((a, b) => b.rating - a.rating);
      case 'price': return [...list].sort((a, b) => a.price - b.price);
      default: return list;
    }
  }, [search, category, sortBy]);

  const toggleFav = (id: string) => setFavorites(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Store className="text-purple-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">CaseBuddy Marketplace</h1>
          <p className="text-slate-400 text-sm">Legal templates, motion packages, strategy guides — by attorneys, for attorneys</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search templates, motions, strategies..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
          <option value="popular">Most Popular</option>
          <option value="rating">Highest Rated</option>
          <option value="price">Lowest Price</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              category === c ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(t => (
          <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-colors group">
            {t.featured && (
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-1 text-xs font-bold text-white flex items-center gap-1">
                <TrendingUp size={12} /> Featured
              </div>
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="text-xs text-purple-400 font-medium">{t.category}</span>
                  <h3 className="text-white font-semibold text-sm mt-0.5 line-clamp-2">{t.title}</h3>
                  <div className="text-slate-500 text-xs mt-1">by {t.author}</div>
                </div>
                <button onClick={() => toggleFav(t.id)}
                  className={`shrink-0 p-1 rounded transition-colors ${favorites.has(t.id) ? 'text-red-400' : 'text-slate-600 hover:text-slate-400'}`}>
                  <Heart size={16} fill={favorites.has(t.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p className="text-slate-400 text-xs line-clamp-2">{t.description}</p>
              <div className="flex flex-wrap gap-1">
                {t.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="bg-slate-700 text-slate-400 text-xs px-1.5 py-0.5 rounded">#{tag}</span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-white text-xs font-medium">{t.rating}</span>
                    <span className="text-slate-500 text-xs">({t.reviews})</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 text-xs">
                    <Download size={11} /> {t.downloads}
                  </div>
                </div>
                <span className={`font-bold text-sm ${t.price === 0 ? 'text-emerald-400' : 'text-white'}`}>
                  {t.price === 0 ? 'FREE' : `$${t.price}`}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreview(t)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                  <Eye size={13} /> Preview
                </button>
                <button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                  <ShoppingCart size={13} /> {t.price === 0 ? 'Download' : 'Purchase'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
          No templates found. Try a different search or category.
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs text-purple-400 font-medium">{preview.category}</span>
                <h3 className="text-xl font-bold text-white mt-1">{preview.title}</h3>
                <div className="text-slate-500 text-sm mt-1">by {preview.author}</div>
              </div>
              <span className={`font-bold text-lg ${preview.price === 0 ? 'text-emerald-400' : 'text-white'}`}>
                {preview.price === 0 ? 'FREE' : `$${preview.price}`}
              </span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                <span className="text-white text-sm font-medium">{preview.rating}</span>
                <span className="text-slate-500 text-sm">({preview.reviews} reviews)</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500 text-sm">
                <Download size={13} /> {preview.downloads} downloads
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-4">{preview.description}</p>
            <div className="bg-slate-900 rounded-lg p-4 mb-4">
              <div className="text-slate-500 text-xs mb-2 uppercase font-semibold">Preview</div>
              <pre className="text-slate-400 text-sm whitespace-pre-wrap font-mono">{preview.preview}</pre>
              <div className="text-center mt-3 text-slate-600 text-xs">... [purchase to see full document] ...</div>
            </div>
            <button onClick={() => setPreview(null)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-colors">
              {preview.price === 0 ? 'Download Free' : `Purchase for $${preview.price}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
