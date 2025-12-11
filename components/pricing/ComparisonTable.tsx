"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Feature {
  name: string;
  basic: string | boolean;
  pro?: string | boolean;
  allAccess?: string | boolean;
}

interface FeatureCategory {
  category: string;
  features: Feature[];
}

interface ComparisonTableProps {
  categories: FeatureCategory[];
  onSelectPlan?: (planId: string) => void;
}

export function ComparisonTable({ categories, onSelectPlan }: ComparisonTableProps) {
  const renderFeatureValue = (value: string | boolean) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-5 w-5 text-green-500 mx-auto" />
      ) : (
        <X className="h-5 w-5 text-gray-300 mx-auto" />
      );
    }
    return <span className="text-sm text-gray-900">{value}</span>;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
      {/* Desktop Table */}
      <div className="hidden lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Features</th>
              <th className="px-6 py-4 text-center">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-gray-900">PMLE Readiness</div>
                  <div className="text-sm text-gray-600">$39/month</div>
                  {onSelectPlan && (
                    <button
                      onClick={() => onSelectPlan("basic")}
                      className="mt-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Start Preparing
                    </button>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <React.Fragment key={category.category}>
                <tr className="border-t-2 border-gray-200">
                  <td
                    colSpan={2}
                    className="bg-gray-50 px-6 py-3 text-sm font-semibold text-gray-900"
                  >
                    {category.category}
                  </td>
                </tr>
                {category.features.map((feature, featureIndex) => (
                  <tr
                    key={feature.name}
                    className={cn(
                      "border-t border-gray-100",
                      featureIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    )}
                  >
                    <td className="px-6 py-4 text-sm text-gray-700">{feature.name}</td>
                    <td className="px-6 py-4 text-center">{renderFeatureValue(feature.basic)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden">
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <h3 className="text-lg font-semibold text-gray-900">Feature Comparison</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {categories.map((category) => (
            <div key={category.category} className="p-4">
              <h4 className="mb-4 text-sm font-semibold text-gray-900">{category.category}</h4>
              {category.features.map((feature) => (
                <div key={feature.name} className="mb-4 last:mb-0">
                  <div className="mb-2 text-sm font-medium text-gray-700">{feature.name}</div>
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <div className="text-xs font-medium text-blue-600 mb-1">PMLE Readiness</div>
                    {renderFeatureValue(feature.basic)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
