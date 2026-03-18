"use client";

import { useState, useEffect } from "react";

interface Property {
  id: number;
  address: string;
  owner_name: string;
}

interface PropertySearchProps {
  onSelect: (property: Property) => void;
  selectedId?: number;
}

export default function PropertySearch({
  onSelect,
  selectedId,
}: PropertySearchProps) {
  const [search, setSearch] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setProperties([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/properties?search=${encodeURIComponent(search)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setProperties(data);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = (property: Property) => {
    setSearch(property.address);
    setShowDropdown(false);
    onSelect(property);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search properties..."
        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      )}
      {showDropdown && properties.length > 0 && (
        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
          {properties.map((property) => (
            <button
              key={property.id}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:outline-none"
              onClick={() => handleSelect(property)}
            >
              <div className="font-medium">{property.address}</div>
              <div className="text-sm text-gray-500">{property.owner_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
