import Heropage from "@/components/frontend/Animate";
import Hero from "@/components/frontend/Hero";
import Navbar from "@/components/frontend/Navbar";
import TestSection from "@/components/frontend/QuoteCard";
import SuperiorCards from "@/components/frontend/SuperiorCards";
import React from "react";
import BrandMarquee from "@/components/frontend/BrandMarquee";
import Footer from "@/components/frontend/Footer";
import LogoCarousel from "@/components/frontend/LogoCarousel";
import WhySurveyArc from "@/components/frontend/WhyTypeForm";

export default function HomePage() {
  return (
    <div>
      <Navbar />
      <Hero />
      <LogoCarousel />
      <Heropage />
      <TestSection />
      <SuperiorCards />
      <BrandMarquee />
      <WhySurveyArc />
      <Footer />
    </div>
  );
}
