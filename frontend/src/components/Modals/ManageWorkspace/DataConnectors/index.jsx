import React from 'react';
import { useAuth } from '../../../../context/AuthContext';
import PanoptoOptions from './Connectors/Panopto';
// ... other imports

export default function DataConnectors() {
  const { user } = useAuth();
  
  // Remove admin check - allow all authenticated users
  if (!user) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-white text-sm">Please login to access data connectors.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex flex-col w-full">
        <div className="flex flex-col gap-y-4">
          <div className="items-center flex gap-x-4">
            <p className="text-white text-sm font-medium">
              Data Connectors
            </p>
          </div>
          <p className="text-white/60 text-xs">
            Connect and process data from various sources.
          </p>
        </div>

        <div className="my-4 flex flex-col gap-y-4">
          <PanoptoOptions />
          {/* Other connector options */}
        </div>
      </div>
    </div>
  );
}
