import { darkTheme, lightTheme } from '@/lib/theme';
import React, { createContext, useContext, useEffect, useState } from 'react';


const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState('light');

  const currentTheme = themeName === 'light' ? lightTheme : darkTheme;

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(currentTheme).forEach(([key, value]) => {
      if (key.startsWith('--')) {
        root.style.setProperty(key, value);
      }
    });
  }, [currentTheme]);

  const toggleTheme = () => {
    setThemeName(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
