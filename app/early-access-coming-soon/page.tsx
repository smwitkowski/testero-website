import React from 'react';
import Link from 'next/link';

const EarlyAccessComingSoonPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">
          Early Access Coming Soon!
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          You are logged in, but your account does not currently have early access.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ll notify you when early access is available for your account.
        </p>
        {/* Optional: Add a link back to the waitlist or home page */}
        <div className="mt-6">
          <Link href="/" className="font-medium text-orange-600 hover:text-orange-500">
            Go back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EarlyAccessComingSoonPage;
