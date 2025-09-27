import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '@/pages/Dashboard';

// Mock the API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Clerk
const mockUser = {
  id: 'test-user-123',
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  firstName: 'Test',
  lastName: 'User'
};

jest.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: mockUser, isLoaded: true }),
  useAuth: () => ({ getToken: jest.fn().mockResolvedValue('mock-token') }),
  useOrganization: () => ({ organization: null, isLoaded: true }),
  UserButton: () => null,
  OrganizationSwitcher: () => null,
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  RedirectToSignIn: () => null,
}));

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Credit Purchase Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful user fetch
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/user/get')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              id: 'test-user-123',
              clerk_id: 'test-user-123',
              email: 'test@example.com',
              credits: 1250,
              plan_type: 'starter'
            },
            error: null
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('should render credit purchase form', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Add Credits')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('500')).toBeInTheDocument();
    expect(screen.getByText('Quick Select')).toBeInTheDocument();
  });

  it('should validate credit amount input', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('500')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('500');
    
    // Test invalid input
    fireEvent.change(input, { target: { value: '50' } });
    await waitFor(() => {
      expect(screen.getByText(/Minimum purchase is/)).toBeInTheDocument();
    });

    // Test valid input
    fireEvent.change(input, { target: { value: '500' } });
    await waitFor(() => {
      expect(screen.getByText('Cost: $7.00')).toBeInTheDocument();
    });
  });

  it('should handle credit purchase flow', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/user/get')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              id: 'test-user-123',
              clerk_id: 'test-user-123',
              email: 'test@example.com',
              credits: 1250,
              plan_type: 'starter'
            },
            error: null
          })
        });
      }
      if (url.includes('/api/billing/credit-purchase')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            sessionId: 'test-session-123',
            url: 'https://checkout.stripe.com/test-session'
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    // Mock window.location.href assignment
    delete (window as any).location;
    (window as any).location = { href: '' };

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('500')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('500');
    const submitButton = screen.getByRole('button', { name: /Add Credits/ });

    // Enter valid amount
    fireEvent.change(input, { target: { value: '500' } });
    
    // Click submit
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/billing/credit-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: 'test-user-123',
          credits: 500,
          amount: 7,
          currency: 'EUR'
        })
      });
    });
  });

  it('should handle quick select buttons', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Quick Select')).toBeInTheDocument();
    });

    // Find and click a quick select button
    const quickSelectButton = screen.getByText('500 credits').closest('button');
    expect(quickSelectButton).toBeInTheDocument();
    
    fireEvent.click(quickSelectButton!);

    const input = screen.getByPlaceholderText('500') as HTMLInputElement;
    expect(input.value).toBe('500');
  });

  it('should display current credit balance', async () => {
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });

    expect(screen.getByText('Available Credits')).toBeInTheDocument();
  });
});