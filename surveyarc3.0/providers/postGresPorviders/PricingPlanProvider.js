'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import pricingPlanModel from '@/models/postGresModels/pricingPlanModel';

const PricingPlanContext = createContext();

export const PricingPlanProvider = ({ children }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const allPlans = await pricingPlanModel.getAll();
        setPlans(allPlans);
      } catch (e) {
        console.error('Failed to fetch pricing plans:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const findById = async (id) => {
    try {
      return await pricingPlanModel.findById(id);
    } catch (e) {
      console.error('Failed to fetch plan by id:', e);
      return null;
    }
  };

  return (
    <PricingPlanContext.Provider value={{ plans, setPlans, loading, findById }}>
      {children}
    </PricingPlanContext.Provider>
  );
};

export const usePricingPlans = () => useContext(PricingPlanContext);
