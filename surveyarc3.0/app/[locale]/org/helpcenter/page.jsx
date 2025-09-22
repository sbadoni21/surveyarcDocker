'use client';
import React, { useState, useEffect } from 'react';
import { Search, MessageCircle, Users, CreditCard, Clock, ChevronDown, ChevronUp, Send, CheckCircle, HelpCircle, Book, Zap, Star, Sparkles } from 'lucide-react';

export default function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("User Query Submitted:", query);
    setSubmitted(true);
    setQuery('');
    setTimeout(() => setSubmitted(false), 4000);
  };

  const faqs = [
    {
      id: 1,
      question: "How do I reset my password?",
      answer: "Navigate to your account settings, select the Security tab, and click on 'Reset Password'. You'll receive an email with instructions to create a new password within minutes.",
      icon: <Search className="w-5 h-5" />,
      category: "Account",
      color: "from-blue-400 to-blue-600"
    },
    {
      id: 2,
      question: "Can I invite team members?",
      answer: "Absolutely! Go to your organization dashboard and use the 'Invite' button. You can invite unlimited team members on most plans and set their permissions accordingly. Team collaboration has never been easier!",
      icon: <Users className="w-5 h-5" />,
      category: "Team",
      color: "from-green-400 to-green-600"
    },
    {
      id: 3,
      question: "How to change my subscription plan?",
      answer: "Visit your Billing Settings from the main menu and select 'Change Plan'. You can upgrade or downgrade at any time, and changes take effect immediately with prorated billing.",
      icon: <CreditCard className="w-5 h-5" />,
      category: "Billing",
      color: "from-purple-400 to-purple-600"
    },
    {
      id: 4,
      question: "What happens when my trial ends?",
      answer: "When your trial period expires, you'll automatically be moved to our free plan. You can upgrade to a paid plan at any time to unlock premium features and advanced functionality.",
      icon: <Clock className="w-5 h-5" />,
      category: "Trial",
      color: "from-pink-400 to-pink-600"
    }
  ];

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const quickActions = [
    { 
      title: "Getting Started", 
      icon: <Zap className="w-6 h-6" />, 
      description: "Learn the basics",
      gradient: "from-yellow-400 to-orange-500"
    },
    { 
      title: "Documentation", 
      icon: <Book className="w-6 h-6" />, 
      description: "Detailed guides",
      gradient: "from-blue-400 to-indigo-500"
    },
    { 
      title: "Contact Support", 
      icon: <MessageCircle className="w-6 h-6" />, 
      description: "Get direct help",
      gradient: "from-green-400 to-teal-500"
    }
  ];

  const FloatingParticle = ({ delay = 0 }) => (
    <div 
      className="absolute opacity-20 animate-pulse"
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${3 + Math.random() * 2}s`
      }}
    >
      <Star className="w-4 h-4 text-orange-400" />
    </div>
  );

  return (
    <div style={{ 
      background: 'var(--background)', 
      color: 'var(--text-primary)',
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute w-96 h-96 rounded-full opacity-10 animate-pulse"
          style={{
            background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
            left: `${mousePosition.x - 192}px`,
            top: `${mousePosition.y - 192}px`,
            transition: 'all 0.3s ease-out'
          }}
        />
        {[...Array(12)].map((_, i) => (
          <FloatingParticle key={i} delay={i * 0.5} />
        ))}
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 bg-gradient-to-br from-orange-400/20 via-pink-400/10 to-purple-400/20 animate-pulse"
            style={{ animationDuration: '4s' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-200/5 to-transparent animate-ping"
               style={{ animationDuration: '3s' }} />
        </div>
        
        <div className={`relative max-w-4xl mx-auto px-6 py-20 text-center transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <div className="relative inline-flex items-center justify-center w-20 h-20 mb-8 group">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 animate-spin"
                 style={{ animationDuration: '3s' }} />
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
                 style={{ background: 'var(--primary)' }}>
              <HelpCircle className="w-8 h-8 text-white animate-bounce" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
          </div>
          
          <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 bg-clip-text text-transparent animate-pulse">
            Help Center
          </h1>
          
          <p className="text-xl md:text-2xl mb-12 animate-fade-in" 
             style={{ 
               color: 'var(--text-secondary)',
               animationDelay: '0.3s',
               animationFillMode: 'both'
             }}>
            Find answers to your questions and get the support you need
          </p>
          
          {/* Animated Search Bar */}
          <div className="relative max-w-lg mx-auto group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-75 transition-opacity duration-300 animate-pulse" />
            <div className="relative">
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 w-6 h-6 transition-all duration-300" 
                     style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search for help..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 text-lg transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-orange-200 focus:scale-105 hover:scale-102"
                style={{ 
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)'
                }}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-ping" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-20">
        {/* Quick Actions with Staggered Animation */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {quickActions.map((action, index) => (
            <div 
              key={index}
              className={`transform transition-all duration-700 hover:scale-110 hover:-rotate-1 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
              }`}
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="relative group cursor-pointer">
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} rounded-3xl blur opacity-25 group-hover:opacity-75 transition-all duration-300 group-hover:blur-xl`} />
                <div className="relative p-8 rounded-3xl border-2 backdrop-blur-sm transition-all duration-300 hover:shadow-xl"
                     style={{ 
                       background: 'var(--surface)',
                       borderColor: 'var(--border)'
                     }}>
                  <div className="flex items-center space-x-6">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${action.gradient} group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-lg`}>
                      {React.cloneElement(action.icon, { className: "w-6 h-6 text-white" })}
                    </div>
                    <div>
                      <h3 className="font-bold text-xl mb-2 group-hover:text-orange-500 transition-colors duration-300">
                        {action.title}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)' }}>{action.description}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <Sparkles className="w-5 h-5 text-yellow-400 animate-spin" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Animated FAQs Section */}
        <div className="mb-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
              Frequently Asked Questions
            </h2>
            <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
              Quick answers to common questions
            </p>
          </div>
          
          <div className="space-y-6">
            {filteredFaqs.map((faq, index) => (
              <div 
                key={faq.id}
                className={`transform transition-all duration-700 hover:scale-102 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="relative group">
                  <div className={`absolute inset-0 bg-gradient-to-r ${faq.color} rounded-3xl blur opacity-0 group-hover:opacity-25 transition-all duration-500`} />
                  <div className="relative rounded-3xl border-2 overflow-hidden backdrop-blur-sm transition-all duration-500 hover:shadow-2xl hover:border-orange-300"
                       style={{ 
                         background: 'var(--surface)',
                         borderColor: 'var(--border)'
                       }}>
                    <button
                      className="w-full p-8 text-left flex items-center justify-between hover:bg-gradient-to-r hover:from-orange-50/10 hover:to-pink-50/10 transition-all duration-300"
                      onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                    >
                      <div className="flex items-center space-x-6">
                        <div className={`p-3 rounded-2xl bg-gradient-to-br ${faq.color} shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                          {React.cloneElement(faq.icon, { className: "w-5 h-5 text-white" })}
                        </div>
                        <div>
                          <span className="inline-block px-4 py-2 text-sm font-bold rounded-full mb-3 animate-pulse"
                                style={{ 
                                  background: 'var(--secondary)',
                                  color: 'var(--text-primary)'
                                }}>
                            {faq.category}
                          </span>
                          <h3 className="font-bold text-xl group-hover:text-orange-500 transition-colors duration-300">
                            {faq.question}
                          </h3>
                        </div>
                      </div>
                      <div className="transition-all duration-300 group-hover:scale-125">
                        {expandedFaq === faq.id ? 
                          <ChevronUp className="w-6 h-6 text-orange-500 animate-bounce" /> : 
                          <ChevronDown className="w-6 h-6 transition-colors duration-300" style={{ color: 'var(--text-secondary)' }} />
                        }
                      </div>
                    </button>
                    
                    <div className={`overflow-hidden transition-all duration-500 ${
                      expandedFaq === faq.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="px-8 pb-8 pt-2 border-t animate-fade-in" style={{ borderColor: 'var(--border)' }}>
                        <div className="pl-14">
                          <p className="text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {faq.answer}
                          </p>
                          <div className="mt-4 flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">Helpful answer</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Contact Form */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 via-pink-400/20 to-purple-400/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-all duration-500" />
          <div className="relative rounded-3xl border-2 p-12 md:p-16 backdrop-blur-sm"
               style={{ 
                 background: 'var(--surface)',
                 borderColor: 'var(--border)'
               }}>
            <div className="text-center mb-12">
              <div className="inline-flex items-center space-x-3 mb-6">
                <MessageCircle className="w-8 h-8 text-orange-500 animate-bounce" />
                <h2 className="text-4xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                  Still have questions?
                </h2>
                <Sparkles className="w-8 h-8 text-pink-500 animate-pulse" />
              </div>
              <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
                We're here to help! Send us your question and we'll get back to you soon.
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-pink-500 rounded-2xl blur opacity-0 group-hover:opacity-25 transition-all duration-300" />
                <textarea
                  className="relative w-full border-2 rounded-2xl p-6 text-lg resize-none transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-orange-200 focus:scale-105 hover:scale-102"
                  rows="6"
                  placeholder="Describe your question or issue in detail..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  required
                  style={{ 
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
              
              <div className="text-center">
                <button
                  onClick={handleSubmit}
                  disabled={submitted}
                  className="relative inline-flex items-center space-x-4 px-12 py-5 rounded-2xl font-bold text-xl transition-all duration-500 transform hover:scale-110 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed text-white overflow-hidden group"
                  style={{ 
                    background: submitted ? 'var(--secondary)' : 'var(--primary)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center space-x-4">
                    {submitted ? (
                      <>
                        <CheckCircle className="w-7 h-7 animate-bounce" />
                        <span>Submitted!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-7 h-7 group-hover:translate-x-1 transition-transform duration-300" />
                        <span>Submit Query</span>
                      </>
                    )}
                  </div>
                  {!submitted && (
                    <div className="absolute top-0 left-0 h-full w-0 bg-white/20 skew-x-12 group-hover:w-full transition-all duration-700" />
                  )}
                </button>
              </div>
            </div>
            
            {submitted && (
              <div className="mt-8 p-6 rounded-2xl text-center animate-bounce border-2 border-green-300"
                   style={{ 
                     background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                     color: 'white'
                   }}>
                <div className="flex items-center justify-center space-x-3 mb-3">
                  <CheckCircle className="w-10 h-10 text-green-200 animate-pulse" />
                  <Sparkles className="w-6 h-6 text-yellow-300 animate-spin" />
                </div>
                <p className="font-bold text-lg">Thank you! Your query has been submitted successfully.</p>
                <p className="text-sm mt-2 opacity-90">
                  We'll get back to you within 24 hours with a detailed response.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}