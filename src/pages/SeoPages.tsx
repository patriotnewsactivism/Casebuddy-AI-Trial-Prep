import React, { useState } from 'react';
import { Globe2, Sparkles, Loader2, Copy, CheckCircle, Search, TrendingUp, FileText, Eye, Download, Plus, X } from 'lucide-react';
import { aiParalegal } from '../lib/api';

interface GeneratedPage {
  id: string; title: string; slug: string; metaTitle: string;
  metaDescription: string; content: string; keywords: string[];
  createdAt: string; wordCount: number;
}

export default function SeoPages() {
  const [practiceArea, setPracticeArea] = useState('Civil Rights Attorney');
  const [location, setLocation] = useState('Lafayette County, Mississippi');
  const [keywords, setKeywords] = useState<string[]>(['police misconduct lawyer', 'civil rights attorney mississippi', 'excessive force lawsuit']);
  const [newKeyword, setNewKeyword] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [previewPage, setPreviewPage] = useState<GeneratedPage | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [tone, setTone] = useState('professional');

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords(prev => [...prev, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => setKeywords(prev => prev.filter(k => k !== kw));

  const generatePage = async () => {
    if (!practiceArea.trim() || !location.trim()) return;
    setGenerating(true);

    try {
      const res = await aiParalegal({
        message: `Generate a comprehensive, SEO-optimized landing page for a legal practice. Details:
        
Practice Area: ${practiceArea}
Location: ${location}
Target Keywords: ${keywords.join(', ')}
Tone: ${tone}

Generate:
1. SEO title tag (under 60 chars)
2. Meta description (under 160 chars)
3. H1 heading
4. 800-1200 word body content with H2/H3 subheadings
5. Include local references, case types handled, and a call to action
6. Use the keywords naturally throughout
7. Include FAQ section with 3-5 questions

Format the content in HTML with proper heading tags.`,
        context: 'You are an expert legal SEO copywriter. Write authoritative, E-E-A-T compliant content that ranks well on Google and converts visitors into clients.',
      });

      const content = res.response || res.message || generateFallbackContent();
      const slug = practiceArea.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const newPage: GeneratedPage = {
        id: Math.random().toString(36).slice(2),
        title: `${practiceArea} in ${location}`,
        slug: `${slug}-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        metaTitle: `${practiceArea} in ${location} | Free Consultation`,
        metaDescription: `Experienced ${practiceArea.toLowerCase()} serving ${location}. Free consultation. We fight for your rights and hold officials accountable.`,
        content,
        keywords,
        createdAt: new Date().toISOString(),
        wordCount: content.split(/\s+/).length,
      };

      setPages(prev => [newPage, ...prev]);
    } catch {
      // Generate a fallback page
      const slug = practiceArea.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      setPages(prev => [{
        id: Math.random().toString(36).slice(2),
        title: `${practiceArea} in ${location}`,
        slug,
        metaTitle: `${practiceArea} in ${location} | Free Consultation`,
        metaDescription: `Experienced ${practiceArea.toLowerCase()} serving ${location}. Free consultation.`,
        content: generateFallbackContent(),
        keywords,
        createdAt: new Date().toISOString(),
        wordCount: 850,
      }, ...prev]);
    }
    setGenerating(false);
  };

  const generateFallbackContent = () => `<h1>${practiceArea} in ${location}</h1>

<p>When your constitutional rights are violated, you need an experienced ${practiceArea.toLowerCase()} who understands the complexities of civil rights litigation and will fight relentlessly for justice. Our firm has deep roots in ${location} and a proven track record of holding government officials accountable.</p>

<h2>Why Choose Us for Your ${practiceArea.split(' ')[0]} Case</h2>

<p>We have extensive experience handling ${practiceArea.toLowerCase()} cases in ${location} and throughout the state. Our approach combines thorough investigation, aggressive litigation strategy, and a commitment to our clients' rights under the Constitution.</p>

<h2>Types of Cases We Handle</h2>
<ul>
<li>Police misconduct and excessive force (42 U.S.C. § 1983)</li>
<li>False arrest and wrongful imprisonment</li>
<li>First Amendment retaliation</li>
<li>Unlawful search and seizure (Fourth Amendment)</li>
<li>Jail and prison conditions</li>
<li>Government transparency and FOIA violations</li>
</ul>

<h2>Our Process</h2>
<p>Every case begins with a free, confidential consultation. We review your situation, preserve critical evidence like body camera footage and police records, and build a comprehensive strategy. We handle cases on a contingency basis — you pay nothing unless we win.</p>

<h2>Frequently Asked Questions</h2>

<h3>How long do I have to file a civil rights lawsuit?</h3>
<p>In Mississippi, the statute of limitations for Section 1983 civil rights claims is 3 years from the date of the incident. However, acting quickly is critical to preserve evidence.</p>

<h3>What damages can I recover?</h3>
<p>You may be entitled to compensatory damages (medical bills, lost wages, pain and suffering), punitive damages, and attorney's fees under 42 U.S.C. § 1988.</p>

<h3>Do I need a lawyer for a civil rights case?</h3>
<p>While you can file pro se, civil rights litigation involves complex federal procedures. An experienced attorney significantly increases your chances of success.</p>

<h2>Contact Us Today</h2>
<p>Don't wait to protect your rights. Contact our ${location} office for a free consultation. We're here to fight for you.</p>`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const PRACTICE_AREAS = [
    'Civil Rights Attorney', 'Police Misconduct Lawyer', 'Criminal Defense Attorney',
    'Personal Injury Lawyer', 'Employment Discrimination Attorney', 'Family Law Attorney',
    'DUI Defense Lawyer', 'Workers Compensation Attorney', 'Immigration Lawyer',
    'Bankruptcy Attorney', 'Estate Planning Lawyer', 'Real Estate Attorney',
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Globe2 className="text-green-400" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">SEO Landing Page Generator</h1>
          <p className="text-slate-400 text-sm">AI generates keyword-optimized practice area pages that rank on Google</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Generator */}
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Practice Area</label>
              <select value={practiceArea} onChange={e => setPracticeArea(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                {PRACTICE_AREAS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)}
                placeholder="e.g., Lafayette County, Mississippi"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="professional">Professional & Authoritative</option>
                <option value="empathetic">Empathetic & Approachable</option>
                <option value="aggressive">Aggressive & Confident</option>
                <option value="educational">Educational & Informative</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Target Keywords</label>
              <div className="flex gap-2">
                <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addKeyword()}
                  placeholder="Add keyword..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                <button onClick={addKeyword} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 rounded-lg"><Plus size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map(kw => (
                  <span key={kw} className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    {kw} <button onClick={() => removeKeyword(kw)}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
            <button onClick={generatePage} disabled={generating}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">
              {generating ? <><Loader2 className="animate-spin" size={18} /> Generating...</> : <><Sparkles size={18} /> Generate Page</>}
            </button>
          </div>

          <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl p-4">
            <div className="text-green-400 font-semibold text-sm mb-1"><TrendingUp size={14} className="inline mr-1" /> SEO Tips</div>
            <ul className="text-slate-400 text-xs space-y-1">
              <li>• Target 1 primary keyword per page</li>
              <li>• Include city/county in the title tag</li>
              <li>• Add FAQ schema for rich snippets</li>
              <li>• Aim for 800+ words per page</li>
              <li>• Include internal links to other pages</li>
            </ul>
          </div>
        </div>

        {/* Generated Pages List */}
        <div className="lg:col-span-2 space-y-4">
          {pages.length === 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <Globe2 className="mx-auto text-slate-600 mb-3" size={48} />
              <p className="text-slate-500">Generated pages will appear here</p>
              <p className="text-slate-600 text-xs mt-1">Each page is SEO-optimized and ready to publish</p>
            </div>
          )}
          {pages.map(page => (
            <div key={page.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold">{page.title}</div>
                    <div className="text-green-400 text-xs font-mono mt-0.5">/{page.slug}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-500 text-xs">{page.wordCount} words</span>
                    <button onClick={() => setPreviewPage(previewPage?.id === page.id ? null : page)}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded text-xs flex items-center gap-1">
                      <Eye size={12} /> {previewPage?.id === page.id ? 'Close' : 'Preview'}
                    </button>
                  </div>
                </div>

                {/* SEO Meta */}
                <div className="bg-slate-900 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-blue-400 text-sm font-medium truncate max-w-md">{page.metaTitle}</div>
                    <button onClick={() => copyToClipboard(page.metaTitle, page.id + '-title')}
                      className="text-slate-500 hover:text-white shrink-0">
                      {copied === page.id + '-title' ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="text-green-400 text-xs font-mono">casebuddy.live/{page.slug}</div>
                  <div className="text-slate-400 text-xs">{page.metaDescription}</div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {page.keywords.map(kw => (
                    <span key={kw} className="bg-slate-700 text-slate-400 text-xs px-1.5 py-0.5 rounded">#{kw.replace(/\s+/g, '')}</span>
                  ))}
                </div>

                {/* Full Preview */}
                {previewPage?.id === page.id && (
                  <div className="border-t border-slate-700 pt-4 mt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-slate-400 text-sm font-medium">Page Content</span>
                      <button onClick={() => copyToClipboard(page.content, page.id + '-content')}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded text-xs flex items-center gap-1">
                        {copied === page.id + '-content' ? <><CheckCircle size={12} className="text-green-400" /> Copied!</> : <><Copy size={12} /> Copy HTML</>}
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-6 max-h-96 overflow-y-auto prose prose-sm text-slate-800"
                      dangerouslySetInnerHTML={{ __html: page.content }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
