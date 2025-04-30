"use client";

import React from 'react';
import { colors, colorUsage } from '@/lib/design-system/colors';
import { typography } from '@/lib/design-system/typography';
import { spacing } from '@/lib/design-system/spacing';
import { button, card, form, badge } from '@/lib/design-system/components';
import { animationPresets } from '@/lib/design-system/animations';
import { cn } from '@/lib/utils';

/**
 * This component serves as a demonstration of the Testero Design System
 * It showcases the various design tokens and components defined in the system
 */
export const DesignSystemDemo: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Testero Design System Demo</h1>
      
      {/* Color System Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Color System</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Primary Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(colors.primary).map(([key, value]) => (
              <div key={key} className="flex flex-col items-center">
                <div 
                  className="w-16 h-16 rounded-md mb-2 border border-slate-200" 
                  style={{ backgroundColor: value }}
                />
                <span className="text-sm">{key}</span>
                <span className="text-xs text-slate-500">{value}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium mb-2">Accent Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(colors.accent).map(([key, value]) => (
              <div key={key} className="flex flex-col items-center">
                <div 
                  className="w-16 h-16 rounded-md mb-2 border border-slate-200" 
                  style={{ backgroundColor: value }}
                />
                <span className="text-sm">{key}</span>
                <span className="text-xs text-slate-500">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Typography Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Typography</h2>
        
        <div className="space-y-4">
          <div>
            <h1 className="text-7xl font-extrabold leading-tight">Heading 1</h1>
            <p className="text-slate-500">typography.heading.h1</p>
          </div>
          
          <div>
            <h2 className="text-5xl font-bold leading-tight">Heading 2</h2>
            <p className="text-slate-500">typography.heading.h2</p>
          </div>
          
          <div>
            <h3 className="text-3xl font-semibold leading-snug">Heading 3</h3>
            <p className="text-slate-500">typography.heading.h3</p>
          </div>
          
          <div>
            <h4 className="text-2xl font-semibold leading-snug">Heading 4</h4>
            <p className="text-slate-500">typography.heading.h4</p>
          </div>
          
          <div>
            <p className="text-2xl leading-relaxed">Body Large</p>
            <p className="text-slate-500">typography.body.large</p>
          </div>
          
          <div>
            <p className="text-lg leading-relaxed">Body Default</p>
            <p className="text-slate-500">typography.body.default</p>
          </div>
          
          <div>
            <p className="text-base leading-relaxed">Body Small</p>
            <p className="text-slate-500">typography.body.small</p>
          </div>
          
          <div>
            <p className="text-sm leading-relaxed">Caption</p>
            <p className="text-slate-500">typography.body.caption</p>
          </div>
        </div>
      </section>
      
      {/* Button Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Buttons</h2>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-medium">Primary Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <button className={cn(
                "px-3 py-2 bg-orange-500 text-white rounded",
                "hover:bg-orange-600 focus:ring-2 focus:ring-orange-200"
              )}>Primary Small</button>
              
              <button className={cn(
                "px-4 py-3 bg-orange-500 text-white rounded font-semibold",
                "hover:bg-orange-600 focus:ring-2 focus:ring-orange-200"
              )}>Primary Default</button>
              
              <button className={cn(
                "px-6 py-4 bg-orange-500 text-white rounded-md text-lg font-semibold",
                "hover:bg-orange-600 focus:ring-2 focus:ring-orange-200"
              )}>Primary Large</button>
              
              <button className={cn(
                "px-4 py-3 bg-orange-300 text-white rounded font-semibold cursor-not-allowed"
              )} disabled>Primary Disabled</button>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-medium">Secondary Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <button className={cn(
                "px-3 py-2 bg-slate-100 text-slate-800 rounded",
                "hover:bg-slate-200 focus:ring-2 focus:ring-slate-200"
              )}>Secondary Small</button>
              
              <button className={cn(
                "px-4 py-3 bg-slate-100 text-slate-800 rounded font-semibold",
                "hover:bg-slate-200 focus:ring-2 focus:ring-slate-200"
              )}>Secondary Default</button>
              
              <button className={cn(
                "px-6 py-4 bg-slate-100 text-slate-800 rounded-md text-lg font-semibold",
                "hover:bg-slate-200 focus:ring-2 focus:ring-slate-200"
              )}>Secondary Large</button>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-medium">Outline Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <button className={cn(
                "px-3 py-2 bg-transparent border border-slate-300 text-slate-800 rounded",
                "hover:bg-slate-100 focus:ring-2 focus:ring-slate-200"
              )}>Outline Small</button>
              
              <button className={cn(
                "px-4 py-3 bg-transparent border border-slate-300 text-slate-800 rounded font-semibold",
                "hover:bg-slate-100 focus:ring-2 focus:ring-slate-200"
              )}>Outline Default</button>
              
              <button className={cn(
                "px-6 py-4 bg-transparent border border-slate-300 text-slate-800 rounded-md text-lg font-semibold",
                "hover:bg-slate-100 focus:ring-2 focus:ring-slate-200"
              )}>Outline Large</button>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-medium">Text Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <button className={cn(
                "px-2 py-1 text-orange-500 hover:underline"
              )}>Text Button Small</button>
              
              <button className={cn(
                "px-2 py-1 text-orange-500 hover:underline font-semibold"
              )}>Text Button Default</button>
              
              <button className={cn(
                "px-2 py-1 text-orange-500 hover:underline text-lg font-semibold"
              )}>Text Button Large</button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Card Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Cards</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className={cn(
            "bg-white p-6 rounded-lg border border-slate-200 shadow"
          )}>
            <h3 className="text-lg font-semibold mb-2">Default Card</h3>
            <p>This is a standard card with default styling.</p>
          </div>
          
          <div className={cn(
            "bg-white p-6 rounded-lg border border-slate-200",
            "shadow-lg"
          )}>
            <h3 className="text-lg font-semibold mb-2">Elevated Card</h3>
            <p>This card has increased elevation with deeper shadows.</p>
          </div>
          
          <div className={cn(
            "bg-white p-6 rounded-lg border border-slate-200",
            "transform transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
          )}>
            <h3 className="text-lg font-semibold mb-2">Interactive Card</h3>
            <p>This card has hover effects for interactive elements.</p>
          </div>
        </div>
      </section>
      
      {/* Form Elements Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Form Elements</h2>
        
        <div className="space-y-6 max-w-md">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Text Input
            </label>
            <input 
              type="text" 
              className={cn(
                "w-full px-4 py-2 border border-slate-300 rounded",
                "focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500"
              )}
              placeholder="Enter text here" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Input
            </label>
            <input 
              type="email" 
              className={cn(
                "w-full px-4 py-2 border border-slate-300 rounded",
                "focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500"
              )}
              placeholder="Enter email" 
            />
            <p className="text-sm text-slate-500 mt-1">We'll never share your email with anyone else.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Select Input
            </label>
            <select 
              className={cn(
                "w-full px-4 py-2 border border-slate-300 rounded",
                "focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500"
              )}
            >
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Textarea
            </label>
            <textarea 
              className={cn(
                "w-full px-4 py-2 border border-slate-300 rounded",
                "focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500"
              )}
              rows={3}
              placeholder="Enter longer text here" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Input with Error
            </label>
            <input 
              type="text" 
              className={cn(
                "w-full px-4 py-2 border border-red-500 rounded",
                "focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500"
              )}
              placeholder="Enter text here" 
            />
            <p className="text-sm text-red-500 mt-1">This field is required</p>
          </div>
        </div>
      </section>
      
      {/* Badge Demo */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Badges</h2>
        
        <div className="flex flex-wrap gap-4">
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            "bg-slate-100 text-slate-800"
          )}>
            Default
          </span>
          
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            "bg-orange-100 text-orange-800"
          )}>
            Primary
          </span>
          
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            "bg-green-100 text-green-800"
          )}>
            Success
          </span>
          
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            "bg-yellow-100 text-yellow-800"
          )}>
            Warning
          </span>
          
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
            "bg-red-100 text-red-800"
          )}>
            Error
          </span>
        </div>
      </section>
    </div>
  );
};

export default DesignSystemDemo;
