# Analytics Dashboard - Website Implementation Guide (blue-byte-booster)

## Overview
This guide details building the analytics/usage dashboard using existing backend logging (`api_request_logs`). New feature: `/dashboard` page with tabs for **Organization Global View** (totals, top models/providers) and **Per-Seat View** (table per user/seat).

**Key Features:**
- Clerk auth verifies JWT (userId, organizationId).
- Supabase client calls RPCs `get_org_analytics(orgId, start_date, end_date)` and `get_user_analytics(userId, dates)`.
- RLS ensures org members see only their data.
- Tailwind UI table/charts, date range filter.

**Prerequisites:**
- Backend migrations 012/013 applied (api_request_logs, RPCs).
- Clerk JWT template: `userId`, `organizationId` (CLERK_JWT_TEMPLATE_CONFIG.md).
- Supabase client in src/lib/supabase.ts with service_role for RPCs? No, use anon/public with RLS.
- shadcn/ui or Tailwind components ready.

## Data Flow Diagram
```mermaid
graph TD
    A[User logs in via Clerk] --> B[Get JWT claims: userId/orgId]
    B --> C[Navigate to /dashboard]
    C --> D[Query Supabase RPCs:<br/>get_org_analytics(orgId, dates)
get_user_analytics(userId, dates)]
    D --> E[RLS Filtered Data:<br/>total_requests, credits, tokens,
top_models JSONB]
    E --> F[Render Tabs:
- Org Overview: Cards/Pie charts
- Per-Seat: DataTable w/ columns]
```

## UI Design
- **Route**: `src/pages/Dashboard.tsx` (or app/dashboard/page.tsx if Next.js).
- **Tabs**: Organization Overview | Per-Seat Usage.
- **Org Tab**: Cards (total requests, credits spent, input/output tokens), pie charts top models/providers.
- **Per-Seat Tab**: DataTable columns: User Email/Name, Requests, Credits Spent, Input Tokens, Output Tokens, Top Model, Last Used.
- **Filters**: Date range picker (last 7d/30d/90d/all), search users.
- **Responsive**: Mobile stack cards/table.

## Implementation Steps

### 1. Supabase Queries (src/api/analytics.ts)
```typescript
import { createClient } from '@/lib/supabase';

export async function getOrgAnalytics(orgId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_org_analytics', {
    p_org_id: orgId,
    p_start_date: startDate,
    p_end_date: endDate
  });
  if (error) throw error;
  return data[0]; // Single row aggregate
}

export async function getOrgUsersAnalytics(orgId: string, startDate: string, endDate: string) {
  // Custom query for per-user: use daily_usage_summary or raw logs
  const { data } = await supabase
    .from('daily_usage_summary')
    .select('user_id, total_requests, total_credits, total_input_tokens, total_output_tokens')
    .eq('organization_id', orgId)
    .gte('usage_date', startDate)
    .lte('usage_date', endDate)
    .order('total_credits', { ascending: false });
  return data;
}
```

### 2. Dashboard Page (src/pages/Dashboard.tsx)
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/AnalyticsTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useUser, useOrg } from '@/contexts/AuthContext'; // Clerk hooks

import { getOrgAnalytics, getOrgUsersAnalytics } from '@/api/analytics';

export default function Dashboard() {
  const { user } = useUser();
  const { orgId } = useOrg();
  const [dateRange, setDateRange] = useState({ start: '30 days ago', end: 'now' });
  const [orgData, setOrgData] = useState(null);
  const [usersData, setUsersData] = useState([]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  async function fetchData() {
    const org = await getOrgAnalytics(orgId, dateRange.start, dateRange.end);
    setOrgData(org);
    const users = await getOrgUsersAnalytics(orgId, dateRange.start, dateRange.end);
    setUsersData(users);
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
      <DateRangePicker onChange={setDateRange} />
      <Tabs defaultValue="org">
        <TabsList>
          <TabsTrigger value="org">Organization Overview</TabsTrigger>
          <TabsTrigger value="per-seat">Per-Seat Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="org">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader><CardTitle>Total Requests</CardTitle></CardHeader>
              <CardContent>{orgData?.total_requests || 0}</CardContent>
            </Card>
            {/* Similar for credits, tokens */}
          </div>
          {/* Pie charts for top models/providers using Recharts */}
        </TabsContent>
        <TabsContent value="per-seat">
          <DataTable data={usersData} columns={userColumns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 3. DataTable Component (src/components/AnalyticsTable.tsx)
Use shadcn DataTable:
```tsx
import { DataTable } from '@/components/ui/data-table';

const columns = [
  { accessorKey: 'user_id', header: 'User' },
  { accessorKey: 'total_requests', header: 'Requests' },
  { accessorKey: 'total_credits', header: 'Credits Spent' },
  // etc.
];
```

### 4. Navigation
Add to App.tsx or sidebar: `<Link to="/dashboard">Dashboard</Link>`.

### 5. Types (src/types/analytics.ts)
```ts
export interface OrgAnalytics {
  total_requests: number;
  total_credits: number;
  top_models: Array<{model_id: string, cost: number}>;
}
```

## Testing & Deploy
1. **Local**: `bun dev`, login Clerk, check /dashboard queries console.
2. **Vercel**: Deploy, test RLS (org data only).
3. **Edge Cases**: No data, date ranges, non-org users.

## Files to Create/Update
- src/pages/Dashboard.tsx
- src/api/analytics.ts
- src/components/AnalyticsTable.tsx
- src/types/analytics.ts
- Update App.tsx nav

Contact for questions.