/**
 * Seat data interface for unified seat management
 */
export interface SeatData {
  seats_used: number;
  seats_total: number;
  availableSeats: number;
  memberCount: number;
  pendingInvitationsCount: number;
  percentUsed: number;
}

/**
 * Get seat data from Clerk as the single source of truth
 * This ensures consistency between Dashboard and Billing views
 */
export const getSeatDataFromClerk = (
  organization: any | null | undefined,
  memberships: { count: number } | null | undefined,
  invitations: { count: number } | null | undefined,
  seatsTotal: number = 0
): SeatData => {
  const memberCount = organization?.membersCount || memberships?.count || 0;
  const pendingInvitationsCount = organization?.pendingInvitationsCount || invitations?.count || 0;
  const totalUsedSeats = memberCount + pendingInvitationsCount;
  const availableSeats = Math.max(0, seatsTotal - totalUsedSeats);
  const percentUsed = seatsTotal > 0 ? Math.round((totalUsedSeats / seatsTotal) * 100) : 0;

  return {
    seats_used: totalUsedSeats,
    seats_total: seatsTotal,
    availableSeats,
    memberCount,
    pendingInvitationsCount,
    percentUsed,
  };
};

/**
 * Format seat usage for display
 */
export const formatSeatUsage = (used: number, total: number): string => {
  return `${used}/${total} seats used`;
};

/**
 * Get seat usage color based on percentage
 */
export const getSeatUsageColor = (percentUsed: number): string => {
  if (percentUsed > 80) return 'bg-red-500';
  if (percentUsed > 60) return 'bg-yellow-500';
  return 'bg-blue-600';
};

/**
 * Check if seats are available
 */
export const hasAvailableSeats = (seatData: SeatData): boolean => {
  return seatData.availableSeats > 0;
};

/**
 * Get seat availability message
 */
export const getSeatAvailabilityMessage = (seatData: SeatData): string => {
  if (seatData.availableSeats === 0) {
    return 'No seats available. Please upgrade your plan.';
  }
  if (seatData.availableSeats === 1) {
    return '1 seat available';
  }
  return `${seatData.availableSeats} seats available`;
};