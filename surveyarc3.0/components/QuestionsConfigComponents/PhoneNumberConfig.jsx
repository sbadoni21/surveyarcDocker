"use client";
import { useEffect, useState } from "react";

const PhoneNumberConfig = ({ config, updateConfig }) => {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCountries = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          "https://restcountries.com/v2/all?fields=name,alpha2Code,callingCodes,flag"
        );
        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Unexpected response format");
        }

        const countryList = data
          .map((c) => {
            const dial_code = c.callingCodes?.[0]
              ? `+${c.callingCodes[0]}`
              : null;

            return dial_code
              ? {
                  name: c.name,
                  code: c.alpha2Code,
                  dial_code,
                  flag: c.flag, // This is a URL now, not emoji
                }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name));

        setCountries(countryList);
      } catch (err) {
        console.error("Error fetching countries:", err.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchCountries();
  }, []);

  return (
    <div className="dark:bg-[#1A1A1E]">
      <label className="block dark:text-[#96949C] text-[14px] mb-1">
        Phone Placeholder
      </label>
      <input
        className="border dark:text-[#CBC9DE] dark:bg-[#1A1A1E] outline-none p-2 rounded w-full mb-4"
        value={config?.placeholder || ""}
        onChange={(e) => updateConfig("placeholder", e.target.value)}
        placeholder="e.g. +1 555 123 4567"
      />

      <label className="block dark:text-[#96949C] text-sm mb-1">Default Country</label>
      {loading ? (
        <p>Loading countries...</p>
      ) : (
        <select
          className="border p-2 dark:text-[#CBC9DE] dark:bg-[#1A1A1E] outline-none rounded w-full"
          value={config?.countryCode || ""}
          onChange={(e) => updateConfig("countryCode", e.target.value)}
        >
          <option value="">Select a country</option>
          {countries.map((country) => (
            <option key={country.code} value={country.dial_code}>
              {country.name} ({country.dial_code})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default PhoneNumberConfig;
