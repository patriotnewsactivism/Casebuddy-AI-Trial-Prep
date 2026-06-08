import React, { useState } from 'react';
import {
  Globe, Search, TrendingUp, FileText, MapPin, Scale, Shield,
  Users, ChevronRight, ExternalLink, Eye, BarChart3, Target,
  Sparkles, CheckCircle, Copy, Download, Edit3, Zap, Star
} from 'lucide-react';
import { toast } from 'react-toastify';
import { callGeminiProxy } from '../services/apiProxy';

interface LandingPage {
  id: string;
  practiceArea: string;
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  heroSubtitle: string;
  sections: { heading: string; content: string }[];
  faqs: { question: string; answer: string }[];
  cta: string;
  keywords: string[];
  status: 'draft' | 'published';
  lastGenerated: string;
}

const PRACTICE_AREAS = [
  { name: 'Civil Rights & Police Misconduct', slug: 'civil-rights', icon: Shield, color: 'text-red-400', keywords: ['civil rights attorney', 'police brutality lawyer', '42 USC 1983', 'excessive force attorney'] },
  { name: 'Personal Injury', slug: 'personal-injury', icon: Users, color: 'text-blue-400', keywords: ['personal injury lawyer', 'car accident attorney', 'slip and fall lawyer', 'injury compensation'] },
  { name: 'Criminal Defense', slug: 'criminal-defense', icon: Scale, color: 'text-purple-400', keywords: ['criminal defense attorney', 'DUI lawyer', 'felony defense', 'drug charges lawyer'] },
  { name: 'Employment Discrimination', slug: 'employment', icon: Users, color: 'text-teal-400', keywords: ['employment lawyer', 'wrongful termination', 'workplace discrimination', 'Title VII attorney'] },
  { name: 'Family Law & Divorce', slug: 'family-law', icon: Users, color: 'text-pink-400', keywords: ['divorce attorney', 'child custody lawyer', 'family law attorney', 'spousal support'] },
  { name: 'Medical Malpractice', slug: 'medical-malpractice', icon: Shield, color: 'text-green-400', keywords: ['medical malpractice lawyer', 'doctor negligence', 'surgical error attorney', 'hospital liability'] },
  { name: 'Workers Compensation', slug: 'workers-comp', icon: Shield, color: 'text-amber-400', keywords: ['workers comp lawyer', 'workplace injury', 'on the job injury', 'workers compensation attorney'] },
  { name: 'Contract Disputes', slug: 'contracts', icon: FileText, color: 'text-indigo-400', keywords: ['contract lawyer', 'breach of contract', 'business dispute attorney', 'contract review'] },
];

const SEOLandingPages = () => {
  const [generatedPages, setGeneratedPages] = useState<LandingPage[]>([]);
  const [selectedArea, setSelectedArea] = useState<typeof PRACTICE_AREAS[0] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPage, setSelectedPage] = useState<LandingPage | null>(null);
  const [customKeyword, setCustomKeyword] = useState('');
  const [targetLocation, setTargetLocation] = useState('');

  const generatePage = async (area: typeof PRACTICE_AREAS[0]) => {
    setIsGenerating(true);
    setSelectedArea(area);

    try {
      const prompt = `Generate a complete SEO-optimized landing page for a CaseBuddy AI legal platform page targeting the practice area: "${area.name}".
${targetLocation ? `Target location: ${targetLocation}` : ''}
${customKeyword ? `Additional keyword focus: ${customKeyword}` : ''}

Target keywords: ${area.keywords.join(', ')}

Return JSON:
{
  "practiceArea": "${area.name}",
  "slug": "${area.slug}",
  "title": "SEO-optimized page title (60 chars max)",
  "metaDescription": "compelling meta description (155 chars max)",
  "h1": "main heading with primary keyword",
  "heroSubtitle": "2-3 sentence hero subtitle that sells CaseBuddy for this practice area",
  "sections": [
    {"heading": "section H2 heading", "content": "2-3 paragraph section content with natural keyword usage. Include specific examples of how CaseBuddy helps with this practice area. Mention specific tools like the Motion Writer, Document Scanner, Deadline Engine, etc."}
  ],
  "faqs": [
    {"question": "common question about using AI for this practice area", "answer": "helpful, keyword-rich answer"}
  ],
  "cta": "compelling call-to-action text",
  "keywords": ["list of 8-10 target keywords and long-tail variations"]
}

Generate 4-5 content sections and 5-6 FAQs. Make the content compelling, authoritative, and naturally keyword-rich. Focus on how CaseBuddy AI specifically helps attorneys in this practice area win more cases.`;

      const result = await callGeminiProxy({
        prompt,
        model: 'gemini-2.5-flash',
        options: { temperature: 0.4, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      });

      const pageData = JSON.parse(result.text);
      const page: LandingPage = {
        id: crypto.randomUUID(),
        ...pageData,
        status: 'draft',
        lastGenerated: new Date().toISOString(),
      };

      setGeneratedPages(prev => [page, ...prev.filter(p => p.slug !== area.slug)]);
      setSelectedPage(page);
      toast.success(`✅ Landing page generated for ${area.name}`);
    } catch (error) {
      console.error('Page generation error:', error);
      toast.error('Failed to generate page');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyPageHTML = (page: LandingPage) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>
  <meta name="description" content="${page.metaDescription}">
  <meta name="keywords" content="${page.keywords.join(', ')}">
  <link rel="canonical" href="https://casebuddy.live/${page.slug}">
</head>
<body>
  <h1>${page.h1}</h1>
  <p>${page.heroSubtitle}</p>
  ${page.sections.map(s => `
  <section>
    <h2>${s.heading}</h2>
    <p>${s.content}</p>
  </section>`).join('')}
  <section>
    <h2>Frequently Asked Questions</h2>
    ${page.faqs.map(f => `
    <details>
      <summary>${f.question}</summary>
      <p>${f.answer}</p>
    </details>`).join('')}
  </section>
  <a href="https://casebuddy.live/signup">${page.cta}</a>
</body>
</html>`;
    navigator.clipboard.writeText(html);
    toast.success('HTML copied to clipboard');
  };

  return (
    <div className="space-y-6 animate-slideInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/30">
            <Globe size={24} className="text-green-400" />
          </div>
          SEO Landing Page Generator
        </h1>
        <p className="text-slate-400 mt-1">Generate keyword-optimized landing pages for every practice area — drive organic traffic to CaseBuddy</p>
      </div>

      {/* Location & Custom Keyword */}
      <div className="glass-card rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 uppercase mb-1 block">Target Location (optional)</label>
            <input
              type="text"
              value={targetLocation}
              onChange={e => setTargetLocation(e.target.value)}
              placeholder="e.g., Mississippi, Atlanta, Texas"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-green-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase mb-1 block">Custom Keyword Focus (optional)</label>
            <input
              type="text"
              value={customKeyword}
              onChange={e => setCustomKeyword(e.target.value)}
              placeholder="e.g., first amendment audit, police accountability"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-green-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Practice Area Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {PRACTICE_AREAS.map(area => {
          const hasPage = generatedPages.some(p => p.slug === area.slug);
          return (
            <button
              key={area.slug}
              onClick={() => generatePage(area)}
              disabled={isGenerating}
              className={`glass-card rounded-xl p-4 text-left hover:bg-slate-800/30 transition-all duration-200 disabled:opacity-50 ${
                selectedArea?.slug === area.slug && isGenerating ? 'ring-1 ring-green-500/50' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <area.icon size={16} className={area.color} />
                {hasPage && <CheckCircle size={12} className="text-green-400 ml-auto" />}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{area.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {area.keywords.slice(0, 2).map((kw, i) => (
                  <span key={i} className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{kw}</span>
                ))}
              </div>
              <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                {isGenerating && selectedArea?.slug === area.slug ? (
                  <>Generating...</>
                ) : hasPage ? (
                  <>Regenerate <ChevronRight size={10} /></>
                ) : (
                  <>Generate Page <ChevronRight size={10} /></>
                )}
              </p>
            </button>
          );
        })}
      </div>

      {/* Generated Page Preview */}
      {selectedPage && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 bg-green-500/5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs ${selectedPage.status === 'published' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                  {selectedPage.status}
                </span>
                <span className="text-xs text-slate-500">Generated: {new Date(selectedPage.lastGenerated).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">casebuddy.live/{selectedPage.slug}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copyPageHTML(selectedPage)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1">
                <Copy size={12} /> Copy HTML
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* SEO Meta Preview */}
            <div className="p-4 rounded-lg bg-white/5 border border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Google Search Preview</p>
              <p className="text-blue-400 text-sm font-medium hover:underline cursor-pointer">{selectedPage.title}</p>
              <p className="text-green-400 text-xs">casebuddy.live/{selectedPage.slug}</p>
              <p className="text-xs text-slate-400 mt-1">{selectedPage.metaDescription}</p>
            </div>

            {/* Page Content Preview */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{selectedPage.h1}</h2>
              <p className="text-slate-400">{selectedPage.heroSubtitle}</p>
            </div>

            {selectedPage.sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-lg font-semibold text-white mb-2">{section.heading}</h3>
                <p className="text-sm text-slate-400 whitespace-pre-line">{section.content}</p>
              </div>
            ))}

            {/* FAQs */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Frequently Asked Questions</h3>
              <div className="space-y-2">
                {selectedPage.faqs.map((faq, i) => (
                  <details key={i} className="group p-3 rounded-lg bg-slate-800/50 border border-slate-800">
                    <summary className="text-sm font-medium text-white cursor-pointer">{faq.question}</summary>
                    <p className="text-sm text-slate-400 mt-2">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Target Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedPage.keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 border border-green-500/30 text-green-400">{kw}</span>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center p-6 rounded-xl bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-500/20">
              <p className="text-lg font-bold text-white mb-3">{selectedPage.cta}</p>
              <button className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium text-sm">
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {generatedPages.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">📊 SEO Coverage</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-400">{generatedPages.length}</p>
              <p className="text-xs text-slate-500">Pages Generated</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{generatedPages.reduce((sum, p) => sum + p.keywords.length, 0)}</p>
              <p className="text-xs text-slate-500">Keywords Targeted</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{PRACTICE_AREAS.length - generatedPages.length}</p>
              <p className="text-xs text-slate-500">Areas Remaining</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SEOLandingPages;
