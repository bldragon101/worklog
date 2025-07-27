import React from 'react';

const VehiclesPage = () => {
  return (
    <div className="flex flex-col h-full space-y-4 p-6">
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="WorkLog Logo" className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold">Vehicles</h1>
          <p className="text-muted-foreground">This is the placeholder page for vehicles.</p>
        </div>
      </div>
    </div>
  );
};

export default VehiclesPage;
