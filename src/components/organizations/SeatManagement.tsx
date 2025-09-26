import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrganizationSeats } from '@/hooks/useOrganizationSeats';

export const SeatManagement = () => {
  const { seats, revokeSeat, loading } = useOrganizationSeats();

  if (loading) {
    return (
      <Card className="bg-[#2a2a2a] border-white/10">
        <CardContent className="p-6 text-white">
          Loading seats...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#2a2a2a] border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Seat Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-white">User Email</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white">Expires At</TableHead>
              <TableHead className="text-white">Assigned By</TableHead>
              <TableHead className="text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats.map((seat) => (
              <TableRow key={seat.id}>
                <TableCell className="text-white font-medium">{seat.user_email}</TableCell>
                <TableCell>
                  <Badge className={seat.status === 'active' ? 'bg-green-600' : 'bg-red-600'}>
                    {seat.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-400">
                  {seat.expires_at ? new Date(seat.expires_at).toLocaleDateString() : 'No expiration'}
                </TableCell>
                <TableCell className="text-gray-400">{seat.assigned_by || 'System'}</TableCell>
                <TableCell>
                  {seat.status === 'active' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => revokeSeat(seat.clerk_user_id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {seats.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                  No seats assigned yet. Invite members to assign seats.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};