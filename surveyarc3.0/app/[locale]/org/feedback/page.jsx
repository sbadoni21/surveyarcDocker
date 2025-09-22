'use client';
import React, { useState, useEffect } from 'react';
import { Star, Send, CheckCircle, MessageSquare, ThumbsUp, ThumbsDown, Sparkles, Heart, Zap, Target, Users, TrendingUp, Award, Coffee } from 'lucide-react';

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [activeFeature, setActiveFeature] = useState(null);

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
    console.log("Feedback Submitted:", { rating, feedback, email, category });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setRating(0);
      setFeedback('');
      setEmail('');
      setCategory('');
    }, 5000);
  };

  const categories = [
    { id: 'general', label: 'General Feedback', icon: <MessageSquare className="w-5 h-5" />, color: 'from-blue-400 to-blue-600' },
    { id: 'feature', label: 'Feature Request', icon: <Zap className="w-5 h-5" />, color: 'from-purple-400 to-purple-600' },
    { id: 'bug', label: 'Bug Report', icon: <Target className="w-5 h-5" />, color: 'from-red-400 to-red-600' },
    { id: 'improvement', label: 'Improvement', icon: <TrendingUp className="w-5 h-5" />, color: 'from-green-400 to-green-600' }
  ];

  const features = [
    { title: "Lightning Fast", icon: <Zap className="w-8 h-8" />, description: "Blazing fast performance" },
    { title: "User Friendly", icon: <Users className="w-8 h-8" />, description: "Intuitive design for everyone" },
    { title: "Award Winning", icon: <Award className="w-8 h-8" />, description: "Recognized excellence" },
    { title: "Always Improving", icon: <Coffee className="w-8 h-8" />, description: "Constant innovation" }
  ];

  const FloatingHeart = ({ delay = 0 }) => (
    <div 
      className="absolute opacity-20 animate-pulse pointer-events-none"
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${4 + Math.random() * 2}s`
      }}
    >
      <Heart className="w-6 h-6 text-pink-400 animate-bounce" />
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
          className="absolute w-96 h-96 rounded-full opacity-15 animate-pulse"
          style={{
            background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
            left: `${mousePosition.x - 192}px`,
            top: `${mousePosition.y - 192}px`,
            transition: 'all 0.4s ease-out'
          }}
        />
        {[...Array(15)].map((_, i) => (
          <FloatingHeart key={i} delay={i * 0.3} />
        ))}
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 bg-gradient-to-br from-pink-400/20 via-orange-400/15 to-purple-400/20 animate-pulse"
            style={{ animationDuration: '5s' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-pink-200/10 to-transparent animate-ping"
               style={{ animationDuration: '4s' }} />
        </div>
        
        <div className={`relative max-w-5xl mx-auto px-6 py-20 text-center transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-8 group">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 via-purple-500 to-orange-500 animate-spin"
                 style={{ animationDuration: '4s' }} />
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-pink-600 shadow-2xl">
              <Heart className="w-10 h-10 text-white animate-pulse" />
            </div>
            <div className="absolute -top-3 -right-3 animate-bounce">
              <Sparkles className="w-8 h-8 text-yellow-400 animate-spin" />
            </div>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-pink-500 via-orange-500 to-purple-600 bg-clip-text text-transparent animate-pulse">
            Give Feedback
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 animate-fade-in" 
             style={{ 
               color: 'var(--text-secondary)',
               animationDelay: '0.3s',
               animationFillMode: 'both'
             }}>
            Your opinion matters! Help us create something amazing together
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            {features.map((feature, index) => (
              <div 
                key={index}
                className={`group cursor-pointer transform transition-all duration-500 hover:scale-110 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onMouseEnter={() => setActiveFeature(index)}
                onMouseLeave={() => setActiveFeature(null)}
              >
                <div className="relative p-6 rounded-2xl border-2 group-hover:border-pink-300 transition-all duration-300"
                     style={{ 
                       background: 'var(--surface)',
                       borderColor: 'var(--border)'
                     }}>
                  <div className={`mb-4 text-orange-500 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 ${
                    activeFeature === index ? 'animate-bounce' : ''
                  }`}>
                    {feature.icon}
                  </div>
                  <h3 className="font-bold text-sm mb-2">{feature.title}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Feedback Form */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-400/20 via-orange-400/20 to-purple-400/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-80 transition-all duration-500" />
          
          <div className="relative rounded-3xl border-2 p-8 md:p-12 backdrop-blur-sm"
               style={{ 
                 background: 'var(--surface)',
                 borderColor: 'var(--border)'
               }}>
            
            {!submitted ? (
              <div className="space-y-10">
                {/* Rating Section */}
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
                    How would you rate your experience?
                  </h2>
                  <div className="flex justify-center space-x-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        className={`p-2 rounded-full transition-all duration-300 transform hover:scale-125 ${
                          star <= (hoverRating || rating) ? 'animate-bounce' : ''
                        }`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                      >
                        <Star
                          className={`w-10 h-10 transition-all duration-300 ${
                            star <= (hoverRating || rating)
                              ? 'text-yellow-400 fill-yellow-400 drop-shadow-lg'
                              : 'text-gray-300 hover:text-yellow-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <div className="animate-fade-in">
                      <p className="text-lg font-medium" style={{ color: 'var(--primary)' }}>
                        {rating === 5 && "🎉 Amazing! Thank you!"}
                        {rating === 4 && "😊 Great! We're thrilled!"}
                        {rating === 3 && "👍 Good! We appreciate it!"}
                        {rating === 2 && "🤔 Thanks for the honest feedback!"}
                        {rating === 1 && "😔 We'll do better! Tell us more."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Category Selection */}
                <div>
                  <h3 className="text-2xl font-bold mb-6 text-center">What type of feedback is this?</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`relative p-6 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 group ${
                          category === cat.id ? 'scale-105 shadow-xl' : ''
                        }`}
                        style={{ 
                          background: category === cat.id ? 'var(--primary)' : 'var(--surface)',
                          borderColor: category === cat.id ? 'var(--primary)' : 'var(--border)',
                          color: category === cat.id ? 'white' : 'var(--text-primary)'
                        }}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl bg-gradient-to-br ${cat.color} group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                            {React.cloneElement(cat.icon, { className: "w-5 h-5 text-white" })}
                          </div>
                          <span className="font-semibold text-lg">{cat.label}</span>
                        </div>
                        {category === cat.id && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="w-6 h-6 text-white animate-bounce" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Text */}
                <div className="relative group">
                  <h3 className="text-2xl font-bold mb-4">Share your thoughts</h3>
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-orange-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-all duration-300" />
                  <textarea
                    className="relative w-full border-2 rounded-2xl p-6 text-lg resize-none transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-pink-200 focus:scale-105 hover:scale-102"
                    rows="6"
                    placeholder="Tell us what you think! Your feedback helps us improve..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    required
                    style={{ 
                      background: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                {/* Email Input */}
                <div className="relative group">
                  <h3 className="text-2xl font-bold mb-4">Email (optional)</h3>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-all duration-300" />
                  <input
                    type="email"
                    className="relative w-full border-2 rounded-2xl p-4 text-lg transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-purple-200 focus:scale-105 hover:scale-102"
                    placeholder="your.email@example.com (if you'd like a response)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ 
                      background: 'var(--background)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                {/* Submit Button */}
                <div className="text-center">
                  <button
                    onClick={handleSubmit}
                    disabled={!rating || !feedback || !category}
                    className="relative inline-flex items-center space-x-4 px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-500 transform hover:scale-110 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed text-white overflow-hidden group"
                    style={{ 
                      background: 'linear-gradient(135deg, var(--primary), #ec4899)'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative flex items-center space-x-4">
                      <Send className="w-7 h-7 group-hover:translate-x-2 group-hover:-translate-y-1 transition-transform duration-300" />
                      <span>Send Feedback</span>
                      <Sparkles className="w-6 h-6 animate-spin" />
                    </div>
                    <div className="absolute top-0 left-0 h-full w-0 bg-white/20 skew-x-12 group-hover:w-full transition-all duration-700" />
                  </button>
                </div>
              </div>
            ) : (
              // Success State
              <div className="text-center py-16 animate-fade-in">
                <div className="relative inline-flex items-center justify-center w-32 h-32 mb-8">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 to-blue-500 animate-spin"
                       style={{ animationDuration: '3s' }} />
                  <div className="relative w-28 h-28 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-teal-500 shadow-2xl">
                    <CheckCircle className="w-16 h-16 text-white animate-bounce" />
                  </div>
                  <div className="absolute -top-4 -right-4">
                    <Heart className="w-10 h-10 text-pink-500 animate-pulse" />
                  </div>
                </div>
                
                <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent">
                  Thank You! 🎉
                </h2>
                
                <p className="text-2xl mb-8" style={{ color: 'var(--text-secondary)' }}>
                  Your feedback has been received and means the world to us!
                </p>
                
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="p-4 rounded-2xl" style={{ background: 'var(--secondary)' }}>
                    <p className="font-semibold">⭐ Rating: {rating}/5 stars</p>
                  </div>
                  <div className="p-4 rounded-2xl" style={{ background: 'var(--secondary)' }}>
                    <p className="font-semibold">📝 Category: {categories.find(c => c.id === category)?.label}</p>
                  </div>
                  {email && (
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--secondary)' }}>
                      <p className="font-semibold">📧 We'll respond to: {email}</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-12 text-lg" style={{ color: 'var(--text-secondary)' }}>
                  <p>Your feedback helps us build better experiences for everyone! 🚀</p>
                </div>
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
        
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}