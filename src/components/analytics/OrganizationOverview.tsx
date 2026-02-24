import React from 'react';
import { MonthlyOrgAnalytics } from '../../types/analytics';

interface Props {
  data: MonthlyOrgAnalytics | null;
}

export function OrganizationOverview({ data }: Props) {
  if (!data) {
    return <div className="p-4 border rounded-lg bg-gray-50">No data available for this month.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-sm font-medium text-gray-500">Total Credits Used</h3>
        <p className="text-3xl font-bold mt-2">{Number(data.total_credits_used).toLocaleString()}</p>
      </div>
      
      <div className="p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-sm font-medium text-gray-500">Total API Requests</h3>
        <p className="text-3xl font-bold mt-2">{data.total_requests.toLocaleString()}</p>
      </div>
      
      <div className="p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-sm font-medium text-gray-500">Active Seats</h3>
        <p className="text-3xl font-bold mt-2">{data.seat_count}</p>
      </div>

      <div className="p-6 border rounded-lg bg-white shadow-sm">
        <h3 className="text-sm font-medium text-gray-500">Avg Credits / Seat</h3>
        <p className="text-3xl font-bold mt-2">
          {data.seat_count > 0 
            ? (Number(data.total_credits_used) / data.seat_count).toFixed(2) 
            : '0'}
        </p>
      </div>
    </div>
  );
}