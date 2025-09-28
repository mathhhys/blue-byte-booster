import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SeatManager } from '@/components/teams/SeatManager';

// Mock Clerk
const mockOrganization = {
  id: 'org-test-123',
  name: 'Test Organization'
};

const mockUser = {
  id: 'user-test-123'
};

jest.mock('@clerk/clerk-react', () => ({
  useOrganization: () => ({ organization: mockOrganization, isLoaded: true }),
  useAuth: () => ({
    userId: mockUser.id,
    getToken: jest.fn().mockResolvedValue('mock-token')
  }),
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

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock import.meta.env
const mockImportMeta = {
  env: {
    VITE_API_URL: 'http://localhost:3001'
  }
};
global.import = { meta: mockImportMeta };

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

describe('SeatManager Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful seats fetch
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/organizations/seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              seats_used: 2,
              seats_total: 5,
              seats: [
                {
                  user_id: 'user-1',
                  email: 'user1@example.com',
                  status: 'active',
                  role: 'admin',
                  assigned_at: '2024-01-01T00:00:00Z'
                },
                {
                  user_id: 'user-2',
                  email: 'user2@example.com',
                  status: 'active',
                  role: 'member',
                  assigned_at: '2024-01-02T00:00:00Z'
                }
              ]
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('should render seat management interface', async () => {
    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Seat Management')).toBeInTheDocument();
    });

    expect(screen.getByText('2 of 5 seats used')).toBeInTheDocument();
    expect(screen.getByText('Assign Seat')).toBeInTheDocument();
  });

  it('should display seat usage progress bar', async () => {
    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Seat Usage')).toBeInTheDocument();
    });

    expect(screen.getByText('2 / 5 seats')).toBeInTheDocument();
    expect(screen.getByText('3 seats available')).toBeInTheDocument();
  });

  it('should display assigned seats list', async () => {
    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Assigned Seats')).toBeInTheDocument();
    });

    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('should open assign seat modal', async () => {
    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Assign Seat')).toBeInTheDocument();
    });

    const assignButton = screen.getByText('Assign Seat');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign New Seat')).toBeInTheDocument();
    });

    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('should validate email input in assign modal', async () => {
    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Assign Seat')).toBeInTheDocument();
    });

    const assignButton = screen.getByText('Assign Seat');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign New Seat')).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter user\'s email address');
    const submitButton = screen.getByText('Assign Seat');

    // Button should be disabled with empty email
    expect(submitButton).toBeDisabled();

    // Enter valid email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('should handle seat assignment', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url.includes('/api/organizations/seats/assign')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      if (url.includes('/api/organizations/seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              seats_used: 2,
              seats_total: 5,
              seats: [
                {
                  user_id: 'user-1',
                  email: 'user1@example.com',
                  status: 'active',
                  role: 'admin',
                  assigned_at: '2024-01-01T00:00:00Z'
                }
              ]
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Assign Seat')).toBeInTheDocument();
    });

    const assignButton = screen.getByText('Assign Seat');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign New Seat')).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter user\'s email address');
    const submitButton = screen.getByText('Assign Seat');

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/organizations/seats/assign'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            org_id: 'org-test-123',
            email: 'newuser@example.com',
            role: 'member'
          })
        })
      );
    });
  });

  it('should open buy seats modal when assignment fails due to no seats', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url.includes('/api/organizations/seats/assign')) {
        return Promise.resolve({
          status: 402,
          json: () => Promise.resolve({ error: 'No available seats' })
        });
      }
      if (url.includes('/api/organizations/seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              seats_used: 5,
              seats_total: 5,
              seats: []
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Assign Seat')).toBeInTheDocument();
    });

    const assignButton = screen.getByText('Assign Seat');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign New Seat')).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter user\'s email address');
    const submitButton = screen.getByText('Assign Seat');

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Buy Additional Seats')).toBeInTheDocument();
    });
  });

  it('should handle quantity selection in buy seats modal', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/organizations/seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              seats_used: 5,
              seats_total: 5,
              seats: []
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Assign Seat')).toBeInTheDocument();
    });

    const assignButton = screen.getByText('Assign Seat');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign New Seat')).toBeInTheDocument();
    });

    // Trigger buy seats modal by failing assignment
    mockFetch.mockImplementationOnce((url, options) => {
      if (url.includes('/api/organizations/seats/assign')) {
        return Promise.resolve({
          status: 402,
          json: () => Promise.resolve({ error: 'No available seats' })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const emailInput = screen.getByPlaceholderText('Enter user\'s email address');
    const submitButton = screen.getByText('Assign Seat');

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Buy Additional Seats')).toBeInTheDocument();
    });

    const quantityInput = screen.getByDisplayValue('1');
    expect(quantityInput).toBeInTheDocument();

    // Change quantity
    fireEvent.change(quantityInput, { target: { value: '5' } });
    expect(quantityInput).toHaveValue(5);

    // Test validation - minimum 1
    fireEvent.change(quantityInput, { target: { value: '0' } });
    expect(quantityInput).toHaveValue(1); // Should reset to minimum

    // Test validation - maximum 100
    fireEvent.change(quantityInput, { target: { value: '150' } });
    expect(quantityInput).toHaveValue(100); // Should cap at maximum
  });

  it('should handle buy seats checkout flow', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url.includes('/api/organizations/buy-seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessionId: 'test-session-123',
            url: 'https://checkout.stripe.com/test-session'
          })
        });
      }
      if (url.includes('/api/organizations/seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              seats_used: 5,
              seats_total: 5,
              seats: []
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: '' };

    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Assign Seat')).toBeInTheDocument();
    });

    const assignButton = screen.getByText('Assign Seat');
    fireEvent.click(assignButton);

    await waitFor(() => {
      expect(screen.getByText('Assign New Seat')).toBeInTheDocument();
    });

    // Trigger buy seats modal
    mockFetch.mockImplementationOnce((url, options) => {
      if (url.includes('/api/organizations/seats/assign')) {
        return Promise.resolve({
          status: 402,
          json: () => Promise.resolve({ error: 'No available seats' })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const emailInput = screen.getByPlaceholderText('Enter user\'s email address');
    const submitButton = screen.getByText('Assign Seat');

    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Buy Additional Seats')).toBeInTheDocument();
    });

    const quantityInput = screen.getByDisplayValue('1');
    const buyButton = screen.getByText('Buy Seats');

    fireEvent.change(quantityInput, { target: { value: '3' } });
    fireEvent.click(buyButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/organizations/buy-seats'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            orgId: 'org-test-123',
            clerkUserId: 'user-test-123',
            quantity: 3
          })
        })
      );
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session');
    });
  });

  it('should handle seat revocation', async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url.includes('/api/organizations/seats/revoke')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      if (url.includes('/api/organizations/seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              seats_used: 1,
              seats_total: 5,
              seats: [
                {
                  user_id: 'user-1',
                  email: 'user1@example.com',
                  status: 'active',
                  role: 'admin',
                  assigned_at: '2024-01-01T00:00:00Z'
                }
              ]
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    const revokeButton = screen.getAllByRole('button').find(button =>
      button.querySelector('svg.lucide-trash2')
    );

    expect(revokeButton).toBeInTheDocument();
    fireEvent.click(revokeButton!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/organizations/seats/revoke'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            org_id: 'org-test-123',
            user_id: 'user-1'
          })
        })
      );
    });
  });

  it('should display loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    expect(screen.getByText('Seat Management')).toBeInTheDocument();
    // Loading skeleton should be visible
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should display empty state when no seats assigned', async () => {
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/organizations/seats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              seats_used: 0,
              seats_total: 5,
              seats: []
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(
      <TestWrapper>
        <SeatManager />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No seats assigned yet')).toBeInTheDocument();
    });

    expect(screen.getByText('Assign your first seat to get started')).toBeInTheDocument();
  });
});