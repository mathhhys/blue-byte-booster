import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SideBySideDemo = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Left Side</CardTitle>
          <CardDescription>Demo content on the left.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This is a basic side-by-side demo using the Card component.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Right Side</CardTitle>
          <CardDescription>Demo content on the right.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This demonstrates the card import is working correctly.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SideBySideDemo;