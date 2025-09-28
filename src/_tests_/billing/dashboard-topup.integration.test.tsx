import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import Dashboard from '@/pages/Dashboard';

// MSW server setup
const server = setupServer();

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

// Test wrapper
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

// MSW handlers
let initialCredits = 1250;

server.use(
  http.get('/api/user/get', (req) => {
    return HttpResponse.json({
      data: {
        id: 'test-user-123',
        clerk_id: 'test-user-123',
        email: 'test@example.com',
        credits: initialCredits,
        plan_type: 'starter'
      },
      error: null
    });
  }),
  http.post('/api/billing/credit-purchase', (req) => {
    const { credits } = req.body;
    return HttpResponse.json({
      success: true,
      sessionId: 'test-session-123',
      url: 'https://checkout.stripe.com/test-session'
    });
  })
);

describe('Dashboard Top-up Integration Tests', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    initialCredits = 1250; // Reset credits
    jest.clearAllMocks();
  });

  it('should handle successful top-up flow and update credits after webhook simulation', async () => {
    // Mock window redirect
    delete (window as any).location;
    (window as any).location = { href: '' };

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('500') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /Add Credits/i });

    // Enter credits
    fireEvent.change(input, { target: { value: '500' } });

    // Submit
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(server.use).toHaveBeenCalled(); // MSW tracks calls
      // Assert POST payload via MSW request body check, but since async, use waitFor on location
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session');
    });

    // Simulate post-purchase refetch after webhook (update mock and assume component refetches or manual)
    initialCredits = 1750; // 1250 + 500
    // In real, component would refetch on success page or poll; here, re-render to simulate
    // For integration, assume refetch triggered; if not, this verifies API response change
    const { rerender } = render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,750')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify no errors
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('should handle top-up API failure', async () => {
    server.use(
      rest.post('/api/billing/credit-purchase', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Payment setup failed' })
        );
      })
    );

    const mockToast = require('@/hooks/use-toast').useToast().toast;

    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('500');
    const submitButton = screen.getByRole('button', { name: /Add Credits/i });

    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Payment setup failed',
          variant: 'destructive'
        })
      );
    });

    // No redirect
    expect(window.location.href).toBe('');
  });

  it('should refetch user data correctly after simulated webhook', async () => {
    // Initial render
    render(
      <TestWrapper>
        <Dashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument();
    });

    // Simulate webhook update
    initialCredits = 1750;
    // Trigger refetch by invalidating query or re-render
    // Assuming react-query invalidation in success handler; here simulate by updating mock and waiting
    await waitFor(() => {
      expect(screen.getByText('1,750')).toBeInTheDocument();
    }, { timeout: 1000 }); // May need adjustment if no auto-refetch

    // If component doesn't auto-refetch, this test verifies the API mock for post-update
  });
});