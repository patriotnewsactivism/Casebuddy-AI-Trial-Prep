import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Mic, Users, BrainCircuit, TrendingUp, CheckCircle, Zap, Award, Shield, Clock, DollarSign, Star, ArrowRight, Menu, X, FileAudio, Gavel, Lock, Server, Trash2, ChevronDown, ChevronUp, Upload, Play, Target, BarChart2 } from 'lucide-react';

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Mic,
      title: 'Live Voice Trial Simulation',
      description: 'Practice with real-time AI responses and instant objections, just like in real court.'
    },
    {
      icon: Users,
      title: 'AI Jury Simulation',
      description: '12 diverse AI jurors who deliberate your case and predict verdicts with detailed reasoning.'
    },
    {
      icon: BrainCircuit,
      title: 'Real-Time Coaching',
      description: 'Get instant feedback on logical fallacies, rhetorical effectiveness, and argument strength.'
    },
    {
      icon: FileAudio,
      title: 'AI Transcription Service',
      description: 'Convert audio recordings to accurate text transcripts with speaker detection and timestamps.'
    },
    {
      icon: TrendingUp,
      title: 'Performance Analytics',
      description: 'Track your improvement with detailed metrics: objections, fallacies, rhetoric scores.'
    },
    {
      icon: Shield,
      title: 'Evidence Timeline',
      description: 'Organize chronological events and exhibits with visual timeline management.'
    }
  ];

  const howItWorks = [
    {
      step: '01',
      icon: Upload,
      title: 'Upload Your Case',
      description: 'Add case details, evidence documents, witness information, and key arguments to build your case file.'
    },
    {
      step: '02',
      icon: Play,
      title: 'Run AI Simulations',
      description: 'Practice with live voice AI, test jury reactions, run cross-examination drills, and get real-time coaching.'
    },
    {
      step: '03',
      icon: BarChart2,
      title: 'Refine Your Strategy',
      description: 'Review performance analytics, identify weak arguments, and iterate until your case is airtight.'
    },
    {
      step: '04',
      icon: Target,
      title: 'Win in Court',
      description: 'Walk into the courtroom prepared with data-driven confidence and a battle-tested strategy.'
    }
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '1 case maximum',
        '3 AI generations/month',
        '1 trial session/month',
        'Basic analytics',
        'Community support'
      ],
      cta: 'Get Started Free',
      highlight: false
    },
    {
      name: 'Pro',
      price: '$129',
      period: '/month',
      features: [
        'Unlimited cases',
        'Unlimited AI generations',
        'Unlimited trial sessions',
        'Advanced analytics',
        'Session recording & history',
        'Mock jury simulation',
        'Priority support',
        'All features unlocked',
        'Export & share reports'
      ],
      cta: 'Start Pro Trial',
      highlight: true
    },
    {
      name: 'Firm',
      price: '$299',
      period: '/month/attorney',
      features: [
        'Everything in Pro',
        'Multi-user collaboration',
        'Shared case library',
        'Admin dashboard',
        'Custom branding',
        'API access',
        'Dedicated support',
        'Volume discounts'
      ],
      cta: 'Contact Sales',
      highlight: false
    }
  ];

  const comparisonData = [
    { feature: 'Cost per trial', casebuddy: '$129/mo', consultant: '$5K–$25K', chatgpt: '$20/mo', manual: 'Your time' },
    { feature: '24/7 availability', casebuddy: true, consultant: false, chatgpt: true, manual: false },
    { feature: 'Voice simulation', casebuddy: true, consultant: false, chatgpt: false, manual: false },
    { feature: 'AI jury prediction', casebuddy: true, consultant: false, chatgpt: false, manual: false },
    { feature: 'Real-time coaching', casebuddy: true, consultant: false, chatgpt: false, manual: false },
    { feature: 'Legal accuracy', casebuddy: 'Purpose-built', consultant: 'Expert', chatgpt: 'Risk of hallucination', manual: 'Depends on you' },
    { feature: 'Case data security', casebuddy: 'Encrypted', consultant: 'Varies', chatgpt: 'Data may be used for training', manual: 'Secure' },
  ];

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'Criminal Defense Attorney',
      firm: 'Mitchell & Associates',
      quote: 'CaseBuddy\'s AI jury simulation saved us $15,000 in jury consultant fees and helped us win a difficult case.',
      rating: 5
    },
    {
      name: 'David Chen',
      role: 'Senior Litigator',
      firm: 'Chen Law Group',
      quote: 'The live voice simulation is incredible. It\'s like having a sparring partner available 24/7. CaseBuddy is a game-changer.',
      rating: 5
    },
    {
      name: 'Maria Rodriguez',
      role: 'Trial Attorney',
      firm: 'Rodriguez Legal',
      quote: 'The transcription service and real-time fallacy detection have dramatically improved my case preparation.',
      rating: 5
    }
  ];

  const faqs = [
    {
      question: 'Is my case data secure and privileged?',
      answer: 'Absolutely. CaseBuddy uses 256-bit AES encryption for all data at rest and in transit. Your case data is never used to train AI models, and we maintain strict attorney-client privilege protections. You can delete all your data at any time from your account settings.'
    },
    {
      question: 'How accurate is the AI jury simulation?',
      answer: 'Our AI jury simulation uses advanced language models trained to simulate diverse juror perspectives, demographics, and reasoning patterns. While no simulation can perfectly predict a real jury, CaseBuddy helps you identify weaknesses in your arguments and test different strategies before stepping into the courtroom.'
    },
    {
      question: 'Can I use CaseBuddy for federal and state cases?',
      answer: 'Yes. CaseBuddy supports trial preparation for cases in all 50 states and federal courts. The AI adapts to different jurisdictions, rules of evidence, and procedural requirements based on your case settings.'
    },
    {
      question: 'Does CaseBuddy replace a jury consultant?',
      answer: 'No — CaseBuddy complements your existing preparation workflow. Use it to practice 24/7, stress-test arguments, and identify weak spots before working with your consultant. Many attorneys use CaseBuddy for daily preparation and bring the insights to their jury consultant for strategic refinement.'
    },
    {
      question: 'What if opposing counsel accesses my CaseBuddy data?',
      answer: 'Your data is protected by work product doctrine and attorney-client privilege. All data is encrypted, access-controlled, and stored on secure US-based servers. We never share, sell, or expose your case data to any third party.'
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes. There are no long-term contracts or cancellation fees. You can cancel your Pro or Firm subscription at any time from your account settings. Your data remains accessible until the end of your billing period.'
    },
    {
      question: 'How does the live voice trial simulation work?',
      answer: 'Our voice simulation uses real-time AI to play the role of opposing counsel, witnesses, or the judge. You speak naturally, and the AI responds with realistic objections, cross-examination questions, and courtroom dialogue — just like practicing with a real partner, but available anytime.'
    },
    {
      question: 'Do you offer discounts for solo practitioners?',
      answer: 'Our Free tier gives solo practitioners a chance to try CaseBuddy at no cost. The Pro plan at $129/month is designed to be accessible — less than the cost of a single billable hour for most attorneys. Contact us for special arrangements if you\'re a public defender or legal aid attorney.'
    }
  ];

  const securityFeatures = [
    { icon: Lock, title: '256-bit AES Encryption', description: 'All data encrypted at rest and in transit' },
    { icon: Server, title: 'US-Based Servers', description: 'Data stored exclusively on secure US infrastructure' },
    { icon: Shield, title: 'Never Used for Training', description: 'Your case data is never used to train AI models' },
    { icon: Trash2, title: 'Right to Deletion', description: 'Delete all your data anytime from account settings' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 text-gold-500">
              <Gavel size={32} />
              <span className="text-2xl font-serif font-bold text-white">CaseBuddy</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-slate-300 hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="text-slate-300 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-slate-300 hover:text-white transition-colors">Testimonials</a>
              <a href="#faq" className="text-slate-300 hover:text-white transition-colors">FAQ</a>
              <Link
                to="/app"
                className="bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                Launch App
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-4 border-t border-slate-800">
              <a href="#features" className="block text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="block text-slate-300 hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="block text-slate-300 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="block text-slate-300 hover:text-white transition-colors">Testimonials</a>
              <a href="#faq" className="block text-slate-300 hover:text-white transition-colors">FAQ</a>
              <Link
                to="/app"
                className="block bg-gold-500 hover:bg-gold-600 text-slate-900 font-semibold px-6 py-2 rounded-lg transition-colors text-center"
              >
                Launch App
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-r from-gold-500/5 via-transparent to-gold-500/5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-900/20 border border-gold-700/30 rounded-full text-gold-400 text-sm font-medium mb-8">
              <Zap size={16} />
              <span>AI-Powered Legal Trial Preparation Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white font-serif mb-6 leading-tight">
              Your AI-Powered{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">
                Trial Preparation
              </span>{' '}
              Partner
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 mb-10 leading-relaxed max-w-3xl mx-auto">
              Practice with live voice AI, simulate jury deliberations, transcribe audio recordings, and get real-time coaching.
              CaseBuddy is the most advanced trial preparation platform for winning attorneys.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-gold-500/20"
              >
                Start Free Trial
                <ArrowRight size={20} />
              </Link>
              <a
                href="https://transcribe.casebuddy.live"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-8 py-4 rounded-lg transition-colors"
              >
                <FileAudio size={20} />
                Try Transcriber
              </a>
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-500" size={18} />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-500" size={18} />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-500" size={18} />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">10,000+</div>
              <div className="text-sm text-slate-400">Practice Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">95%</div>
              <div className="text-sm text-slate-400">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">500+</div>
              <div className="text-sm text-slate-400">Law Firms</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gold-500 mb-2">24/7</div>
              <div className="text-sm text-slate-400">AI Availability</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-4">
              Features No Competitor Has
            </h2>
            <p className="text-lg text-slate-400">
              Industry-first AI capabilities designed specifically for trial attorneys
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-gold-500/50 transition-all hover:transform hover:scale-105"
              >
                <div className="w-12 h-12 bg-gold-900/30 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="text-gold-500" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 sm:py-32 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-400">
              From case upload to courtroom confidence in four simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, i) => (
              <div key={i} className="relative text-center">
                <div className="w-16 h-16 bg-gold-900/30 border border-gold-500/30 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <step.icon className="text-gold-500" size={28} />
                </div>
                <div className="text-xs font-bold text-gold-500 tracking-widest mb-2">{step.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.description}</p>
                {i < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+48px)] w-[calc(100%-96px)] border-t border-dashed border-slate-700"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-4">
              CaseBuddy vs. The Alternatives
            </h2>
            <p className="text-lg text-slate-400">
              A jury consultant charges $5,000–$25,000 per trial. CaseBuddy costs less than a single billable hour.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-sm text-slate-400 font-medium py-4 pr-4"></th>
                  <th className="text-center text-sm font-bold text-gold-500 py-4 px-3">CaseBuddy</th>
                  <th className="text-center text-sm text-slate-400 font-medium py-4 px-3">Jury Consultant</th>
                  <th className="text-center text-sm text-slate-400 font-medium py-4 px-3">ChatGPT</th>
                  <th className="text-center text-sm text-slate-400 font-medium py-4 px-3">Manual Prep</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="text-sm text-slate-300 py-3 pr-4 font-medium">{row.feature}</td>
                    {['casebuddy', 'consultant', 'chatgpt', 'manual'].map((key) => {
                      const val = row[key as keyof typeof row];
                      return (
                        <td key={key} className="text-center py-3 px-3">
                          {val === true ? (
                            <CheckCircle className="text-green-500 mx-auto" size={18} />
                          ) : val === false ? (
                            <X className="text-slate-600 mx-auto" size={18} />
                          ) : (
                            <span className={`text-sm ${key === 'casebuddy' ? 'text-gold-400 font-semibold' : 'text-slate-400'}`}>
                              {val}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-32 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-400 mb-2">
              Choose the plan that fits your practice
            </p>
            <p className="text-sm text-slate-500">
              Less than the cost of one billable hour — a fraction of what jury consultants charge
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, i) => (
              <div
                key={i}
                className={`rounded-xl p-8 ${
                  tier.highlight
                    ? 'bg-gradient-to-b from-gold-900/30 to-slate-800 border-2 border-gold-500 transform scale-105'
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
              >
                {tier.highlight && (
                  <div className="inline-block px-3 py-1 bg-gold-500 text-slate-900 text-xs font-bold rounded-full mb-4">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  <span className="text-slate-400">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-slate-300">
                      <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/app"
                  className={`block w-full text-center py-3 rounded-lg font-semibold transition-colors ${
                    tier.highlight
                      ? 'bg-gold-500 hover:bg-gold-600 text-slate-900'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-4">
              Built for Attorney-Client Privilege
            </h2>
            <p className="text-lg text-slate-400">
              Your case data deserves the same protection you give your clients
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {securityFeatures.map((item, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-green-900/20 border border-green-700/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <item.icon className="text-green-500" size={24} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                <p className="text-xs text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 mt-8">
            CaseBuddy is a practice and preparation tool. It does not provide legal advice and is not a substitute for professional legal counsel.
          </p>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 sm:py-32 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-4">
              Trusted by Leading Attorneys
            </h2>
            <p className="text-lg text-slate-400">
              See what trial lawyers are saying about CaseBuddy
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="text-gold-500" size={16} style={{ fill: '#d4af37' }} />
                  ))}
                </div>
                <p className="text-slate-300 mb-6 italic">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-white">{testimonial.name}</div>
                  <div className="text-sm text-slate-400">{testimonial.role}</div>
                  <div className="text-xs text-slate-500">{testimonial.firm}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 sm:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-slate-400">
              Everything attorneys need to know before getting started
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/80 transition-colors"
                >
                  <span className="text-white font-medium pr-4">{faq.question}</span>
                  {openFaq === i ? (
                    <ChevronUp className="text-gold-500 flex-shrink-0" size={20} />
                  ) : (
                    <ChevronDown className="text-slate-400 flex-shrink-0" size={20} />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-sm text-slate-400 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 bg-gradient-to-r from-gold-900/20 via-slate-900/50 to-gold-900/20 border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white font-serif mb-6">
            Ready to Transform Your Trial Preparation?
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 mb-10">
            Join hundreds of attorneys using AI to win more cases.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-slate-900 font-bold px-8 py-4 rounded-lg transition-all transform hover:scale-105"
            >
              Start Free Trial
              <ArrowRight size={20} />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-8 py-4 rounded-lg transition-colors"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-gold-500">
              <Gavel size={28} />
              <span className="text-xl font-serif font-bold text-white">CaseBuddy</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-sm text-slate-400">
              <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/tos" className="hover:text-white transition-colors">Terms of Service</Link>
              <a href="https://transcribe.casebuddy.live" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Transcriber</a>
              <a href="mailto:support@casebuddy.live" className="hover:text-white transition-colors">Support</a>
            </div>
            <div className="text-sm text-slate-500">
              © 2026 CaseBuddy. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
