import React from 'react';
import { MonthlyOrgModelUsage } from '../../types/analytics';

interface Props {
  data: MonthlyOrgModelUsage[];
}

export function ModelUsageBreakdown({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-white">Model Usage Breakdown</h2>
      <div className="overflow-x-auto border border-white/10 rounded-lg">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-[#1a1a1a]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Model</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Provider</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Credits Used</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Requests</th>
            </tr>
          </thead>
          <tbody className="bg-[#2a2a2a] divide-y divide-white/10">
            {data.map((model) => (
              <tr key={model.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {model.model_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {model.provider}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-400">
                  {Number(model.total_credits_used).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-400">
                  {model.total_requests.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}