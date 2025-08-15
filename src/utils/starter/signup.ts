interface ClerkUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName?: string | null;
  lastName?: string | null;
}

const API_BASE = import.meta.env?.VITE_API_URL || '';

export interface StarterSignupData {
  clerkUserId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface StarterSignupResult {
  success: boolean;
  message?: string;
  data?: {
    planType: string;
    credits: number;
    isExisting: boolean;
  };
  error?: string;
}

// Process starter plan signup
export const processStarterSignup = async (signupData: StarterSignupData): Promise<StarterSignupResult> => {
  try {
    const response = await fetch(`${API_BASE}/api/starter/process-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signupData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to process starter signup');
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message,
      data: result.data,
    };
  } catch (error) {
    console.error('Error processing starter signup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Helper function to prepare starter signup data from Clerk user
export const prepareStarterSignupData = (user: ClerkUser): StarterSignupData => {
  return {
    clerkUserId: user.id,
    email: user.emailAddresses[0]?.emailAddress,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
  };
};

// Validate starter signup data
export const validateStarterSignupData = (data: StarterSignupData): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.clerkUserId || data.clerkUserId.trim() === '') {
    errors.push('User ID is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};