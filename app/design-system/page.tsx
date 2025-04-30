import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Testero Design System',
  description: 'Design system documentation for the Testero waitlist landing page',
};

export default function DesignSystemPage() {
  // Check if we're in development mode (this is a simple implementation)
  // In a real production app, use environment variables like process.env.NODE_ENV
  // or a more robust authentication mechanism
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // If not in development mode, return 404
  if (!isDevelopment) {
    return notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Testero Design System</h1>
      
      <div className="space-y-12">
        {/* Color System */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Color System</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded">slate-50</div>
            <div className="p-4 bg-slate-100 rounded">slate-100</div>
            <div className="p-4 bg-slate-200 rounded">slate-200</div>
            <div className="p-4 bg-slate-300 rounded">slate-300</div>
            <div className="p-4 bg-slate-400 text-white rounded">slate-400</div>
            <div className="p-4 bg-slate-500 text-white rounded">slate-500</div>
            <div className="p-4 bg-slate-600 text-white rounded">slate-600</div>
            <div className="p-4 bg-slate-700 text-white rounded">slate-700</div>
            <div className="p-4 bg-slate-800 text-white rounded">slate-800</div>
            <div className="p-4 bg-slate-900 text-white rounded">slate-900</div>
            
            <div className="p-4 bg-orange-50 rounded">orange-50</div>
            <div className="p-4 bg-orange-100 rounded">orange-100</div>
            <div className="p-4 bg-orange-200 rounded">orange-200</div>
            <div className="p-4 bg-orange-300 rounded">orange-300</div>
            <div className="p-4 bg-orange-400 text-white rounded">orange-400</div>
            <div className="p-4 bg-orange-500 text-white rounded">orange-500</div>
            <div className="p-4 bg-orange-600 text-white rounded">orange-600</div>
            <div className="p-4 bg-orange-700 text-white rounded">orange-700</div>
            <div className="p-4 bg-orange-800 text-white rounded">orange-800</div>
            <div className="p-4 bg-orange-900 text-white rounded">orange-900</div>
          </div>
        </section>
        
        {/* Typography */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Typography</h2>
          <div className="space-y-4">
            <div>
              <h1 className="text-9xl">9xl Heading</h1>
              <h1 className="text-8xl">8xl Heading</h1>
              <h1 className="text-7xl">7xl Heading</h1>
              <h1 className="text-6xl">6xl Heading</h1>
              <h1 className="text-5xl">5xl Heading</h1>
              <h1 className="text-4xl">4xl Heading</h1>
              <h1 className="text-3xl">3xl Heading</h1>
              <h1 className="text-2xl">2xl Heading</h1>
              <h1 className="text-xl">xl Heading</h1>
              <h1 className="text-lg">lg Heading</h1>
              <h1 className="text-base">base Heading</h1>
              <h1 className="text-sm">sm Heading</h1>
              <h1 className="text-xs">xs Heading</h1>
            </div>
            
            <div>
              <p className="font-thin">Font weight: thin (100)</p>
              <p className="font-extralight">Font weight: extralight (200)</p>
              <p className="font-light">Font weight: light (300)</p>
              <p className="font-normal">Font weight: normal (400)</p>
              <p className="font-medium">Font weight: medium (500)</p>
              <p className="font-semibold">Font weight: semibold (600)</p>
              <p className="font-bold">Font weight: bold (700)</p>
              <p className="font-extrabold">Font weight: extrabold (800)</p>
              <p className="font-black">Font weight: black (900)</p>
            </div>
          </div>
        </section>
        
        {/* Spacing */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Spacing</h2>
          <div className="space-y-2">
            <div className="bg-slate-200 h-px w-1 inline-block"></div> <span>spacing-1 (0.25rem)</span><br />
            <div className="bg-slate-200 h-px w-2 inline-block"></div> <span>spacing-2 (0.5rem)</span><br />
            <div className="bg-slate-200 h-px w-3 inline-block"></div> <span>spacing-3 (0.75rem)</span><br />
            <div className="bg-slate-200 h-px w-4 inline-block"></div> <span>spacing-4 (1rem)</span><br />
            <div className="bg-slate-200 h-px w-5 inline-block"></div> <span>spacing-5 (1.25rem)</span><br />
            <div className="bg-slate-200 h-px w-6 inline-block"></div> <span>spacing-6 (1.5rem)</span><br />
            <div className="bg-slate-200 h-px w-8 inline-block"></div> <span>spacing-8 (2rem)</span><br />
            <div className="bg-slate-200 h-px w-10 inline-block"></div> <span>spacing-10 (2.5rem)</span><br />
            <div className="bg-slate-200 h-px w-12 inline-block"></div> <span>spacing-12 (3rem)</span><br />
            <div className="bg-slate-200 h-px w-16 inline-block"></div> <span>spacing-16 (4rem)</span><br />
          </div>
        </section>
        
        {/* Components */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Components</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-medium mb-2">Buttons</h3>
              <div className="flex flex-wrap gap-4">
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md">
                  Primary Button
                </button>
                <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-md">
                  Secondary Button
                </button>
                <button className="border border-orange-500 text-orange-500 hover:bg-orange-50 px-4 py-2 rounded-md">
                  Outline Button
                </button>
                <button className="text-orange-500 hover:text-orange-600 underline">
                  Text Button
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-medium mb-2">Cards</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-md border border-slate-100">
                  <h4 className="font-semibold mb-2">Default Card</h4>
                  <p className="text-slate-600">A simple card component with border and shadow.</p>
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-100">
                  <h4 className="font-semibold mb-2">Elevated Card</h4>
                  <p className="text-slate-600">A card with stronger shadow for emphasis.</p>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-semibold mb-2">Flat Card</h4>
                  <p className="text-slate-600">A card without shadow for subtle UI elements.</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-medium mb-2">Form Elements</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" placeholder="you@example.com" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                  <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" rows={3} placeholder="Your message"></textarea>
                </div>
                
                <div className="flex items-center">
                  <input type="checkbox" className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-slate-300 rounded" />
                  <label className="ml-2 block text-sm text-slate-700">Remember me</label>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section>
          <h2 className="text-2xl font-semibold mb-4">Animations</h2>
          <p className="mb-4">This design system includes animations for:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Entrance animations (fade-in, slide-in)</li>
            <li>Hover/interaction states</li>
            <li>Loading states</li>
            <li>Micro-interactions</li>
          </ul>
          <p className="mt-4 text-sm text-slate-500">
            See the components on the live site for animation examples. All animations follow the timing and easing values defined in the design system.
          </p>
        </section>
        
        {/* Footer with documentation link */}
        <footer className="pt-8 mt-12 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            For more details on how to use the design system, please refer to the <a href="/lib/design-system/README.md" className="text-orange-500 hover:underline">documentation</a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
