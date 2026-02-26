import React from 'react';
import { MonthlySeatAnalytics } from '../../types/analytics';

interface Props {
  data: MonthlySeatAnalytics[];
}

export function SeatUsageTable({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4 text-white">Usage by Seat</h2>
      <div className="overflow-x-auto border border-white/10 rounded-lg">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-[#1a1a1a]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User ID</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Credits Used</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Requests</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total Tokens</th>
            </tr>
          </thead>
          <tbody className="bg-[#2a2a2a] divide-y divide-white/10">
            {data.map((seat) => (
              <tr key={seat.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {seat.users?.clerk_id || seat.user_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-400">
                  {Number(seat.total_credits_used).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-400">
                  {seat.total_requests.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-400">
                  {(Number(seat.total_input_tokens) + Number(seat.total_output_tokens)).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}