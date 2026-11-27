"use client"
import React from 'react';
import { ClosuresProvider } from '@/context/ClosuresContext';
import Navbar from '@/components/Home/Navbar';
import Hero from '@/components/Home/Hero';
import Features from '@/components/Home/Features';
import CTASection from '@/components/Home/CTASection';
import Footer from '@/components/Home/Footer';

export default function HomePage() {
  return (
    <ClosuresProvider>
      <div className="min-h-screen bg-white">
        <Navbar />
        <Hero />
        <Footer />
      </div>
    </ClosuresProvider>
  );
}
